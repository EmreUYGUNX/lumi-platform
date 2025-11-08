/* eslint-disable sonarjs/cognitive-complexity, unicorn/no-null */
import { randomUUID } from "node:crypto";

import {
  InventoryPolicy,
  OrderStatus,
  type Payment,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  type PrismaClient,
} from "@prisma/client";

import { getConfig } from "@/config/index.js";
import { createEmailService } from "@/lib/email/email.service.js";
import type { EmailService } from "@/lib/email/email.service.js";
import type { OrderNotificationEmailPayload } from "@/lib/email/types.js";
import { ConflictError, NotFoundError, UnauthorizedError } from "@/lib/errors.js";
import { createChildLogger } from "@/lib/logger.js";
import { getPrismaClient } from "@/lib/prisma.js";
import {
  recordOrderCreatedMetric,
  recordOrderRefundMetric,
  recordOrderStatusTransitionMetric,
} from "@/observability/index.js";
import {
  type MoneyDTO,
  type OrderDetailDTO,
  type OrderSummaryDTO,
  type OrderWithRelations,
  type PaymentSummaryDTO,
  mapOrderToDetail,
  mapOrderToSummary,
  mapPaymentToSummary,
} from "@lumi/shared/dto";

import { AddressRepository } from "../address/address.repository.js";
import type { CartWithRelations } from "../cart/cart.repository.js";
import type { CartContext } from "../cart/cart.service.js";
import { CartService } from "../cart/cart.service.js";
import { PaymentRepository } from "../payment/payment.repository.js";
import { OrderRepository } from "./order.repository.js";
import {
  type AdminOrderListQuery,
  type CreateOrderInput,
  type OrderCancellationInput,
  type OrderListQuery,
  type OrderNoteInput,
  type OrderRefundInput,
  type OrderStatsQuery,
  type OrderStatusUpdateInput,
  type OrderTrackingParams,
} from "./order.validators.js";

type PrismaClientLike = PrismaClient | Prisma.TransactionClient;

export interface OrderContext {
  userId: string;
  sessionId?: string | null;
  email?: string | null;
  firstName?: string | null;
}

export interface OrderListSummary {
  totalRevenue: MoneyDTO;
  averageOrderValue: MoneyDTO;
  totalOrders: number;
}

export interface CreateOrderResult {
  order: OrderDetailDTO;
  payment?: PaymentSummaryDTO;
}

export interface OrderListResult {
  items: OrderSummaryDTO[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  summary?: OrderListSummary;
}

export interface OrderStats {
  totalOrders: Record<OrderStatus, number>;
  revenue: {
    total: string;
    currency: string;
  };
  averageOrderValue: string;
  revenueSeries: { date: string; total: string }[];
  topProducts: { productId: string; title: string; quantity: number }[];
  conversionRate: number;
}

export interface OrderExportResult {
  filename: string;
  content: string;
}

interface PaymentGateway {
  refund(
    payment: Payment,
    payload: { amount: Prisma.Decimal; reason?: string | null },
  ): Promise<{
    status: "COMPLETED" | "FAILED";
    referenceId?: string;
    failureReason?: string | null;
  }>;
}

export interface OrderServiceOptions {
  prisma?: PrismaClient;
  repository?: OrderRepository;
  paymentRepository?: PaymentRepository;
  cartService?: CartService;
  addressRepository?: AddressRepository;
  emailService?: EmailService;
  logger?: ReturnType<typeof createChildLogger>;
  paymentGateway?: PaymentGateway;
}

interface InternalNote {
  id: string;
  authorId: string;
  message: string;
  createdAt: string;
}

interface ShipmentMetadata {
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  carrier?: string | null;
  estimatedDelivery?: string | null;
}

interface OrderMetadata {
  internalNotes?: InternalNote[];
  shipment?: ShipmentMetadata;
  [key: string]: unknown;
}

const DEFAULT_CURRENCY = "TRY";
const ORDER_CANCELLATION_WINDOW_MINUTES = 60;
const ORDER_EXPORT_DEFAULT_LIMIT = 1000;
const ORDER_NOT_FOUND_ERROR = "Order not found.";

const ALLOWED_STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ["PAID", "CANCELLED"],
  PAID: ["FULFILLED", "CANCELLED"],
  FULFILLED: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

const buildUserCartContext = (context: OrderContext): CartContext => ({
  userId: context.userId,
  sessionId: context.sessionId ?? undefined,
});

const normaliseOptionalString = (input: unknown): string | null => {
  if (typeof input !== "string") {
    return null;
  }
  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const noopPaymentGateway: PaymentGateway = {
  async refund() {
    return { status: "COMPLETED" as const };
  },
};

export class OrderService {
  private readonly prisma: PrismaClient;

  private readonly repository: OrderRepository;

  private readonly paymentRepository: PaymentRepository;

  private readonly cartService: CartService;

  private readonly addressRepository: AddressRepository;

  private readonly emailService: EmailService;

  private readonly logger: ReturnType<typeof createChildLogger>;

  private readonly paymentGateway: PaymentGateway;

  constructor(options: OrderServiceOptions = {}) {
    this.prisma = options.prisma ?? getPrismaClient();
    this.repository = options.repository ?? new OrderRepository(this.prisma);
    this.paymentRepository = options.paymentRepository ?? new PaymentRepository(this.prisma);
    this.cartService =
      options.cartService ??
      new CartService({
        prisma: this.prisma,
        disableCleanupJob: true,
      });
    this.addressRepository = options.addressRepository ?? new AddressRepository(this.prisma);
    this.emailService = options.emailService ?? createEmailService();
    this.logger = options.logger ?? createChildLogger("order:service");
    this.paymentGateway = options.paymentGateway ?? noopPaymentGateway;
  }

  private static isInventoryTracked(item: CartWithRelations["items"][number]): boolean {
    const inventoryPolicy = item.productVariant?.product?.inventoryPolicy ?? InventoryPolicy.TRACK;
    return inventoryPolicy !== InventoryPolicy.CONTINUE;
  }

  private static normaliseMoney(amount = "0"): Prisma.Decimal {
    return new Prisma.Decimal(amount);
  }

  private static toMoneyDTO(amount: Prisma.Decimal, currency: string): MoneyDTO {
    return {
      amount: amount.toFixed(2),
      currency,
    };
  }

  private static escapeCsvValue(value: string): string {
    if (value.includes('"') || value.includes(",") || value.includes("\n")) {
      return `"${value.replaceAll('"', '""')}"`;
    }

    return value;
  }

  private static sanitiseShipmentMetadata(value: unknown): ShipmentMetadata | undefined {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return undefined;
    }

    const source = value as Record<string, unknown>;

    const estimatedDelivery = (() => {
      const raw = source.estimatedDelivery;
      if (raw instanceof Date) {
        return raw.toISOString();
      }
      if (typeof raw === "string" && raw.trim().length > 0) {
        const parsed = new Date(raw);
        return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
      }
      return null;
    })();

    return {
      trackingNumber: normaliseOptionalString(source.trackingNumber),
      trackingUrl: normaliseOptionalString(source.trackingUrl),
      carrier: normaliseOptionalString(source.carrier),
      estimatedDelivery,
    };
  }

  private static sanitiseMetadata(metadata: unknown): OrderMetadata {
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
      return {};
    }

    const payload: OrderMetadata = { ...(metadata as Record<string, unknown>) };

    if (payload.shipment) {
      const shipment = OrderService.sanitiseShipmentMetadata(payload.shipment);
      if (shipment) {
        payload.shipment = shipment;
      } else {
        delete payload.shipment;
      }
    }

    if (payload.internalNotes && !Array.isArray(payload.internalNotes)) {
      delete payload.internalNotes;
    }

    return payload;
  }

  private static stripInternalMetadata<T extends { metadata?: unknown }>(order: T): T {
    if (!order.metadata || typeof order.metadata !== "object") {
      return order;
    }

    const metadata = { ...(order.metadata as Record<string, unknown>) };
    delete metadata.internalNotes;

    return {
      ...order,
      metadata: Object.keys(metadata).length > 0 ? metadata : null,
    };
  }

  private static mergeShipmentMetadata(
    metadata: OrderMetadata,
    updates: Partial<ShipmentMetadata>,
  ): OrderMetadata {
    const shipment = metadata.shipment ?? ({} as ShipmentMetadata);
    return {
      ...metadata,
      shipment: {
        ...shipment,
        ...updates,
      },
    };
  }

  private async generateReference(client: PrismaClientLike = this.prisma): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = `LM-${Date.now().toString(36).toUpperCase()}-${Math.random()
        .toString(36)
        .slice(2, 6)
        .toUpperCase()}`;

      // eslint-disable-next-line no-await-in-loop -- sequential uniqueness check is required
      const existing = await client.order.findFirst({
        where: { reference: candidate },
        select: { id: true },
      });

      if (!existing) {
        return candidate;
      }
    }

    throw new ConflictError("Unable to generate unique order reference.");
  }

  private async ensureAddresses(userId: string, input: CreateOrderInput, tx: PrismaClientLike) {
    const shippingId = input.shippingAddressId;
    const billingId = input.billingAddressId ?? input.shippingAddressId;

    const [shipping, billing] = await Promise.all([
      shippingId
        ? tx.address.findFirst({ where: { id: shippingId, userId } })
        : this.addressRepository.getDefaultAddress(userId),
      billingId
        ? tx.address.findFirst({ where: { id: billingId, userId } })
        : this.addressRepository.getDefaultAddress(userId),
    ]);

    if (!shipping) {
      throw new NotFoundError("Shipping address not found.", {
        details: { shippingAddressId: shippingId },
      });
    }

    if (!billing) {
      throw new NotFoundError("Billing address not found.", {
        details: { billingAddressId: billingId },
      });
    }

    return { shippingId: shipping.id, billingId: billing.id };
  }

  private static async loadCart(cartId: string, tx: PrismaClientLike): Promise<CartWithRelations> {
    const cart = await tx.cart.findFirst({
      where: { id: cartId },
      include: {
        items: {
          include: {
            productVariant: {
              include: {
                product: true,
              },
            },
          },
        },
        user: true,
      },
    });

    if (!cart) {
      throw new NotFoundError("Cart not found.", { details: { cartId } });
    }

    return cart as CartWithRelations;
  }

  private static buildOrderItems(
    cart: CartWithRelations,
    currency: string,
  ): Prisma.OrderItemCreateManyInput[] {
    return cart.items.map((item) => {
      const product = item.productVariant?.product;
      if (!product || !item.productVariant) {
        throw new NotFoundError("Product information missing for cart item.", {
          details: { itemId: item.id },
        });
      }

      if (OrderService.isInventoryTracked(item) && item.productVariant.stock < item.quantity) {
        throw new ConflictError("Insufficient inventory for one or more items.", {
          details: { productId: product.id, variantId: item.productVariant.id },
        });
      }

      return {
        orderId: "pending",
        productId: product.id,
        productVariantId: item.productVariant.id,
        quantity: item.quantity,
        unitPrice: new Prisma.Decimal(item.unitPrice),
        currency,
        titleSnapshot: product.title,
        variantSnapshot: {
          sku: item.productVariant.sku,
          attributes: item.productVariant.attributes,
        },
      } satisfies Prisma.OrderItemCreateManyInput;
    });
  }

  private static async decrementInventory(
    tx: PrismaClientLike,
    orderItems: Prisma.OrderItemCreateManyInput[],
  ): Promise<void> {
    await Promise.all(
      orderItems.map(async (item) => {
        await tx.productVariant.update({
          where: { id: item.productVariantId },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });
      }),
    );
  }

  private static async restockInventory(tx: PrismaClientLike, orderId: string): Promise<void> {
    const items = await tx.orderItem.findMany({
      where: { orderId },
      select: {
        productVariantId: true,
        quantity: true,
      },
    });

    await Promise.all(
      items.map(async (item) => {
        await tx.productVariant.update({
          where: { id: item.productVariantId },
          data: {
            stock: {
              increment: item.quantity,
            },
          },
        });
      }),
    );
  }

  private async sendOrderEmail(
    order: OrderDetailDTO,
    context: OrderContext,
    status: "confirmed" | "updated" | "refunded",
  ): Promise<void> {
    if (!context.email) {
      return;
    }

    const payload: OrderNotificationEmailPayload = {
      to: context.email,
      firstName: context.firstName ?? null,
      orderReference: order.reference,
      orderUrl: `${getConfig().app.frontendUrl.replace(/\/+$/, "")}/orders/${order.reference}`,
      total: order.totalAmount,
      estimatedDelivery: order.deliveredAt ?? order.shippedAt ?? order.fulfilledAt,
      items: order.items.map((item) => {
        const lineTotal = new Prisma.Decimal(item.unitPrice.amount).mul(item.quantity);
        return {
          title: item.titleSnapshot,
          quantity: item.quantity,
          total: {
            amount: lineTotal.toFixed(2),
            currency: item.unitPrice.currency,
          },
        };
      }),
      status,
    };

    try {
      if (status === "refunded") {
        await this.emailService.sendOrderRefundEmail(payload);
      } else if (status === "updated") {
        await this.emailService.sendOrderUpdateEmail(payload);
      } else {
        await this.emailService.sendOrderConfirmationEmail(payload);
      }
    } catch (error) {
      this.logger.warn("Failed to dispatch order email", {
        orderId: order.id,
        reference: order.reference,
        status,
        error,
      });
    }
  }

  async createOrder(context: OrderContext, input: CreateOrderInput): Promise<CreateOrderResult> {
    if (!context.userId) {
      throw new UnauthorizedError("Authentication required to create orders.");
    }

    const cartContext = buildUserCartContext(context);
    const validation = await this.cartService.validateCart(cartContext, {
      reserveInventory: true,
    });

    if (!validation.valid) {
      throw new ConflictError("Cart contains invalid items. Please refresh before checkout.", {
        details: { issues: validation.issues },
      });
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const { shippingId, billingId } = await this.ensureAddresses(context.userId, input, tx);
      const cart = await OrderService.loadCart(validation.cartId, tx);

      if (cart.userId !== context.userId) {
        throw new UnauthorizedError("You cannot checkout another user's cart.");
      }

      if (cart.items.length === 0) {
        throw new ConflictError("Cannot create an order from an empty cart.");
      }

      const reference = await this.generateReference(tx);
      const currency = cart.items[0]?.productVariant?.product?.currency ?? DEFAULT_CURRENCY;
      const orderItems = OrderService.buildOrderItems(cart, currency);
      const subtotal = OrderService.normaliseMoney(validation.totals.subtotal.amount);
      const tax = OrderService.normaliseMoney(validation.totals.tax.amount);
      const discount = OrderService.normaliseMoney(validation.totals.discount.amount);
      const total = OrderService.normaliseMoney(validation.totals.total.amount);

      const order = await tx.order.create({
        data: {
          reference,
          userId: context.userId,
          cartId: cart.id,
          status: OrderStatus.PENDING,
          subtotalAmount: subtotal,
          taxAmount: tax,
          discountAmount: discount,
          totalAmount: total,
          currency,
          shippingAddressId: shippingId,
          billingAddressId: billingId,
          notes: input.notes ?? null,
          metadata: input.metadata ?? Prisma.JsonNull,
        },
      });

      await tx.orderItem.createMany({
        data: orderItems.map((item) => ({
          ...item,
          orderId: order.id,
        })),
      });

      await OrderService.decrementInventory(tx, orderItems);

      await tx.cart.update({
        where: { id: cart.id },
        data: {
          status: "CHECKED_OUT",
          updatedAt: new Date(),
        },
      });

      await tx.cartItem.deleteMany({
        where: { cartId: cart.id },
      });

      await tx.inventoryReservation.updateMany({
        where: { cartId: cart.id, status: { in: ["PENDING", "ACTIVE"] } },
        data: { status: "RELEASED" },
      });

      let payment: Payment | undefined;
      if (input.payment) {
        payment = await tx.payment.create({
          data: {
            orderId: order.id,
            userId: context.userId,
            provider: input.payment.provider ?? PaymentProvider.MANUAL,
            status: PaymentStatus.INITIATED,
            transactionId: input.payment.transactionId ?? randomUUID(),
            amount: total,
            currency,
            paymentChannel: input.payment.paymentChannel ?? null,
            paymentGroup: input.payment.paymentGroup ?? null,
            cardToken: input.payment.cardToken ?? null,
          },
        });
      }

      const fullOrder = await tx.order.findFirst({
        where: { id: order.id },
        include: {
          items: {
            include: {
              product: true,
              productVariant: true,
            },
          },
          payments: true,
          shippingAddress: true,
          billingAddress: true,
          user: true,
        },
      });

      if (!fullOrder) {
        throw new NotFoundError("Order not found after creation.");
      }

      return {
        order: fullOrder,
        payment,
      };
    });

    const detail = OrderService.stripInternalMetadata(
      mapOrderToDetail(result.order as unknown as OrderWithRelations),
    );
    recordOrderCreatedMetric();
    await this.sendOrderEmail(detail, context, "confirmed");

    return {
      order: detail,
      payment: result.payment ? mapPaymentToSummary(result.payment) : undefined,
    };
  }

  async listUserOrders(userId: string, query: OrderListQuery): Promise<OrderListResult> {
    const pagination = {
      page: query.page,
      pageSize: query.pageSize,
    };

    const filters: Prisma.OrderWhereInput = {};

    if (query.status && query.status.length > 0) {
      filters.status = { in: query.status };
    }

    if (query.from || query.to) {
      filters.createdAt = {
        gte: query.from ? new Date(query.from) : undefined,
        lte: query.to ? new Date(query.to) : undefined,
      };
    }

    const { items, meta } = await this.repository.listForUser(userId, pagination, filters);
    return {
      items: items.map((item) =>
        OrderService.stripInternalMetadata(
          mapOrderToSummary(item as unknown as OrderWithRelations),
        ),
      ),
      meta,
    };
  }

  async getUserOrder(userId: string, orderId: string): Promise<OrderDetailDTO> {
    const order = await this.repository.findById(orderId, {
      include: {
        items: {
          include: {
            product: true,
            productVariant: true,
          },
        },
        payments: true,
        shippingAddress: true,
        billingAddress: true,
        user: true,
      },
    });

    if (order === null || order.userId !== userId) {
      throw new NotFoundError(ORDER_NOT_FOUND_ERROR);
    }

    return OrderService.stripInternalMetadata(
      mapOrderToDetail(order as unknown as OrderWithRelations),
    );
  }

  async cancelOrder(
    context: OrderContext,
    orderId: string,
    input: OrderCancellationInput = {},
  ): Promise<OrderDetailDTO> {
    if (!context.userId) {
      throw new UnauthorizedError("Authentication required.");
    }

    const order = (await this.repository.findById(orderId, {
      include: {
        items: true,
        payments: true,
        shippingAddress: true,
        billingAddress: true,
      },
    })) as OrderWithRelations | null;

    if (order === null || order.userId !== context.userId) {
      throw new NotFoundError(ORDER_NOT_FOUND_ERROR);
    }

    if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.PAID) {
      throw new ConflictError("This order can no longer be cancelled.");
    }

    const cancellationDeadline = new Date(
      order.createdAt.getTime() + ORDER_CANCELLATION_WINDOW_MINUTES * 60 * 1000,
    );
    if (new Date() > cancellationDeadline) {
      throw new ConflictError("The cancellation window for this order has expired.", {
        details: { deadline: cancellationDeadline.toISOString() },
      });
    }

    const paymentToRefund = order.payments?.[0];
    const refundAmount = new Prisma.Decimal(order.totalAmount);
    const gatewayResult =
      order.status === OrderStatus.PAID && paymentToRefund
        ? await this.paymentGateway.refund(paymentToRefund as Payment, {
            amount: refundAmount,
            reason: input.reason ?? null,
          })
        : undefined;

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.CANCELLED,
          cancelledAt: new Date(),
          notes: input.reason ?? order.notes,
          version: { increment: 1 },
        },
      });

      await OrderService.restockInventory(tx, order.id);

      if (order.status === OrderStatus.PAID) {
        await tx.payment.updateMany({
          where: { orderId: order.id },
          data: {
            status: PaymentStatus.REFUNDED,
            failureReason: input.reason ?? null,
          },
        });
        if (paymentToRefund) {
          await tx.paymentRefund.create({
            data: {
              paymentId: paymentToRefund.id,
              amount: refundAmount,
              currency: paymentToRefund.currency,
              reason: input.reason ?? "Customer cancellation",
              status: gatewayResult?.status ?? "COMPLETED",
              refundId: gatewayResult?.referenceId ?? null,
              processedAt: new Date(),
              failureReason: gatewayResult?.failureReason ?? null,
            },
          });
        }
        recordOrderRefundMetric({ type: "user_cancelled" });
      }

      return tx.order.findFirst({
        where: { id: order.id },
        include: {
          items: {
            include: {
              product: true,
              productVariant: true,
            },
          },
          payments: true,
          shippingAddress: true,
          billingAddress: true,
          user: true,
        },
      });
    });

    if (!updated) {
      throw new NotFoundError(ORDER_NOT_FOUND_ERROR);
    }

    recordOrderStatusTransitionMetric({
      from: order.status,
      to: OrderStatus.CANCELLED,
    });

    const detail = OrderService.stripInternalMetadata(
      mapOrderToDetail(updated as unknown as OrderWithRelations),
    );
    const emailStatus = order.status === OrderStatus.PAID ? "refunded" : "updated";
    await this.sendOrderEmail(detail, context, emailStatus);
    return detail;
  }

  async trackOrder(params: OrderTrackingParams) {
    const order = await this.repository.findByReference(params.reference, {
      include: {
        items: true,
      },
    });

    if (order === null) {
      throw new NotFoundError(ORDER_NOT_FOUND_ERROR);
    }

    const metadata = OrderService.sanitiseMetadata(order.metadata);
    const shipment = metadata.shipment ?? {};
    const estimatedDelivery =
      shipment.estimatedDelivery ??
      order.deliveredAt?.toISOString() ??
      order.shippedAt?.toISOString() ??
      order.fulfilledAt?.toISOString() ??
      null;

    return {
      reference: order.reference,
      status: order.status,
      placedAt: order.createdAt.toISOString(),
      estimatedDelivery,
      tracking: {
        trackingNumber: shipment.trackingNumber ?? null,
        trackingUrl: shipment.trackingUrl ?? null,
        carrier: shipment.carrier ?? null,
      },
      timeline: [
        { status: "PENDING", timestamp: order.createdAt },
        order.placedAt ? { status: "PAID", timestamp: order.placedAt } : null,
        order.fulfilledAt ? { status: "FULFILLED", timestamp: order.fulfilledAt } : null,
        order.shippedAt ? { status: "SHIPPED", timestamp: order.shippedAt } : null,
        order.deliveredAt ? { status: "DELIVERED", timestamp: order.deliveredAt } : null,
        order.cancelledAt ? { status: "CANCELLED", timestamp: order.cancelledAt } : null,
      ]
        .filter(Boolean)
        .map((entry) => ({
          status: entry!.status,
          timestamp: entry!.timestamp.toISOString(),
        })),
    };
  }

  async listAdminOrders(query: AdminOrderListQuery): Promise<OrderListResult> {
    const where = OrderService.buildAdminWhere(query);
    const { items, meta } = await this.repository.paginate({
      page: query.page,
      pageSize: query.pageSize,
      where,
    });

    const summary =
      query.includeStats === false ? undefined : await this.computeOrderSummary(where);

    return {
      items: items.map((item) => mapOrderToSummary(item as unknown as OrderWithRelations)),
      meta,
      summary,
    };
  }

  async exportAdminOrders(query: AdminOrderListQuery): Promise<OrderExportResult> {
    const where = OrderService.buildAdminWhere(query);
    const limit = Math.min(
      query.exportLimit ?? ORDER_EXPORT_DEFAULT_LIMIT,
      ORDER_EXPORT_DEFAULT_LIMIT,
    );

    const orders = await this.prisma.order.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      take: limit,
      include: {
        user: true,
      },
    });

    const header = ["Reference", "Status", "Total", "Currency", "Customer Email", "Created At"];
    const rows = orders.map((order) => [
      order.reference,
      order.status,
      new Prisma.Decimal(order.totalAmount).toFixed(2),
      order.currency,
      order.user?.email ?? "",
      order.createdAt.toISOString(),
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((value) => OrderService.escapeCsvValue(value)).join(","))
      .join("\n");

    const filename = `orders-${new Date().toISOString().replaceAll(/[.:]/gu, "-")}.csv`;
    return { filename, content: csv };
  }

  async getAdminOrder(orderId: string): Promise<OrderDetailDTO> {
    const order = await this.repository.findById(orderId, {
      include: {
        items: {
          include: {
            product: true,
            productVariant: true,
          },
        },
        payments: true,
        shippingAddress: true,
        billingAddress: true,
        user: true,
      },
    });

    if (order === null) {
      throw new NotFoundError(ORDER_NOT_FOUND_ERROR);
    }

    return mapOrderToDetail(order as unknown as OrderWithRelations);
  }

  async updateOrderStatus(orderId: string, input: OrderStatusUpdateInput): Promise<OrderDetailDTO> {
    const order = (await this.repository.findById(orderId)) as OrderWithRelations | null;
    if (order === null) {
      throw new NotFoundError(ORDER_NOT_FOUND_ERROR);
    }

    const allowed = ALLOWED_STATUS_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(input.status)) {
      throw new ConflictError("Invalid status transition.", {
        details: { from: order.status, to: input.status },
      });
    }

    if (input.version !== undefined && order.version !== input.version) {
      throw new ConflictError("Order version conflict detected.", {
        details: { expected: input.version, actual: order.version },
      });
    }

    let metadata = OrderService.sanitiseMetadata(order.metadata);
    const shipmentUpdates: Partial<ShipmentMetadata> = {};

    if (input.trackingNumber !== undefined) {
      shipmentUpdates.trackingNumber = input.trackingNumber ?? null;
    }
    if (input.trackingUrl !== undefined) {
      shipmentUpdates.trackingUrl = input.trackingUrl ?? null;
    }
    if (input.carrier !== undefined) {
      shipmentUpdates.carrier = input.carrier ?? null;
    }
    if (input.estimatedDelivery) {
      shipmentUpdates.estimatedDelivery = input.estimatedDelivery.toISOString();
    }

    if (Object.keys(shipmentUpdates).length > 0) {
      metadata = OrderService.mergeShipmentMetadata(metadata, shipmentUpdates);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: input.status,
          version: { increment: 1 },
          ...(Object.keys(shipmentUpdates).length > 0
            ? { metadata: metadata as Prisma.InputJsonValue }
            : {}),
        },
      });

      if (input.status === OrderStatus.CANCELLED) {
        await OrderService.restockInventory(tx, orderId);
      }
    });

    recordOrderStatusTransitionMetric({ from: order.status, to: input.status });

    const updated = await this.getAdminOrder(orderId);

    await this.sendOrderEmail(
      OrderService.stripInternalMetadata(updated),
      {
        userId: order.userId ?? "system",
        email: order.user?.email ?? null,
        firstName: order.user?.firstName ?? null,
      },
      "updated",
    );

    return updated;
  }

  async addInternalNote(
    orderId: string,
    input: OrderNoteInput,
    actorId: string,
  ): Promise<OrderDetailDTO> {
    const order = await this.repository.findById(orderId);
    if (order === null) {
      throw new NotFoundError(ORDER_NOT_FOUND_ERROR);
    }

    const metadata = OrderService.sanitiseMetadata(order.metadata);
    const notes = metadata.internalNotes ?? [];

    const newNote: InternalNote = {
      id: randomUUID(),
      authorId: actorId,
      message: input.message,
      createdAt: new Date().toISOString(),
    };

    metadata.internalNotes = [newNote, ...notes];

    await this.repository.update({
      where: { id: orderId },
      data: {
        metadata: metadata as Prisma.InputJsonValue,
      },
    });

    return this.getAdminOrder(orderId);
  }

  async processRefund(orderId: string, input: OrderRefundInput): Promise<OrderDetailDTO> {
    const order = (await this.repository.findById(orderId, {
      include: {
        items: {
          include: {
            product: true,
            productVariant: true,
          },
        },
        payments: true,
        shippingAddress: true,
        billingAddress: true,
        user: true,
      },
    })) as OrderWithRelations | null;

    if (order === null) {
      throw new NotFoundError(ORDER_NOT_FOUND_ERROR);
    }

    if (!order.payments || order.payments.length === 0) {
      throw new ConflictError("Order does not have any payments to refund.");
    }

    const payment =
      input.paymentId === undefined
        ? order.payments[0]
        : order.payments.find((entry) => entry.id === input.paymentId);

    if (payment === undefined) {
      throw new ConflictError("Specified payment record was not found for this order.");
    }

    const refundAmount = input.amount
      ? new Prisma.Decimal(input.amount.amount)
      : new Prisma.Decimal(order.totalAmount);

    if (refundAmount.lte(0)) {
      throw new ConflictError("Refund amount must be greater than zero.");
    }

    if (refundAmount.gt(new Prisma.Decimal(payment.amount))) {
      throw new ConflictError("Refund amount cannot exceed the captured payment amount.");
    }

    const matchesOrderTotal = refundAmount.eq(new Prisma.Decimal(order.totalAmount));
    const refundType = input.type ?? (matchesOrderTotal ? "full" : "partial");
    if (refundType === "full" && matchesOrderTotal === false) {
      throw new ConflictError("Full refunds must match the order total.");
    }

    const gatewayResponse = await this.paymentGateway.refund(payment as Payment, {
      amount: refundAmount,
      reason: input.reason ?? null,
    });

    const shouldCancelOrder = refundType === "full";

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: shouldCancelOrder ? PaymentStatus.REFUNDED : payment.status,
          failureReason: input.reason ?? null,
        },
      });

      await tx.paymentRefund.create({
        data: {
          paymentId: payment.id,
          amount: refundAmount,
          currency: payment.currency,
          reason: input.reason ?? null,
          status: gatewayResponse.status,
          refundId: gatewayResponse.referenceId ?? null,
          processedAt: new Date(),
          failureReason: gatewayResponse.failureReason ?? null,
        },
      });

      await tx.order.update({
        where: { id: order.id },
        data: shouldCancelOrder
          ? {
              status: OrderStatus.CANCELLED,
              cancelledAt: new Date(),
            }
          : {
              notes: input.reason ?? order.notes,
            },
      });

      if (shouldCancelOrder) {
        await OrderService.restockInventory(tx, order.id);
      }
    });

    recordOrderRefundMetric({ type: refundType });
    const detail = await this.getAdminOrder(orderId);
    await this.sendOrderEmail(
      detail,
      {
        userId: order.userId ?? "system",
        email: order.user?.email ?? null,
        firstName: order.user?.firstName ?? null,
      },
      "refunded",
    );
    return detail;
  }

  async getOrderStats(query: OrderStatsQuery): Promise<OrderStats> {
    const now = new Date();
    let since: Date;
    switch (query.range) {
      case "7d": {
        since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      }
      case "90d": {
        since = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      }
      default: {
        since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      }
    }

    const totals = await this.prisma.order.groupBy({
      by: ["status"],
      where: {
        createdAt: { gte: since },
      },
      _count: { _all: true },
    });

    const revenueAggregate = await this.prisma.order.aggregate({
      where: {
        createdAt: { gte: since },
        status: {
          in: [OrderStatus.PAID, OrderStatus.FULFILLED, OrderStatus.SHIPPED, OrderStatus.DELIVERED],
        },
      },
      _avg: {
        totalAmount: true,
      },
      _sum: {
        totalAmount: true,
      },
    });

    const totalOrders: Record<OrderStatus, number> = {
      PENDING: 0,
      PAID: 0,
      FULFILLED: 0,
      SHIPPED: 0,
      DELIVERED: 0,
      CANCELLED: 0,
    };
    totals.forEach((entry) => {
      // eslint-disable-next-line no-underscore-dangle -- Prisma aggregate metadata uses prefixed fields
      totalOrders[entry.status] = entry._count._all;
    });

    return {
      totalOrders,
      revenue: {
        // eslint-disable-next-line no-underscore-dangle -- Prisma aggregate metadata uses prefixed fields
        total: revenueAggregate._sum.totalAmount?.toFixed(2) ?? "0.00",
        currency: DEFAULT_CURRENCY,
      },
      // eslint-disable-next-line no-underscore-dangle -- Prisma aggregate metadata uses prefixed fields
      averageOrderValue: revenueAggregate._avg.totalAmount?.toFixed(2) ?? "0.00",
      revenueSeries: await this.buildRevenueSeries(since),
      topProducts: await this.getTopProducts(since),
      conversionRate: OrderService.calculateConversionRate(totalOrders),
    };
  }

  private static calculateConversionRate(totals: Record<OrderStatus, number>): number {
    const completedStatuses: OrderStatus[] = [
      OrderStatus.PAID,
      OrderStatus.FULFILLED,
      OrderStatus.SHIPPED,
      OrderStatus.DELIVERED,
    ];

    const totalOrderCount = Object.values(totals).reduce((acc, value) => acc + value, 0);
    if (totalOrderCount === 0) {
      return 0;
    }

    const completedOrders = completedStatuses.reduce(
      // eslint-disable-next-line security/detect-object-injection -- status values originate from trusted enum
      (acc, status) => acc + (totals[status] ?? 0),
      0,
    );
    return Number((completedOrders / totalOrderCount).toFixed(4));
  }

  private async buildRevenueSeries(since: Date): Promise<{ date: string; total: string }[]> {
    const orders = await this.prisma.order.findMany({
      where: {
        createdAt: { gte: since },
        status: {
          in: [OrderStatus.PAID, OrderStatus.FULFILLED, OrderStatus.SHIPPED, OrderStatus.DELIVERED],
        },
      },
      select: { createdAt: true, totalAmount: true },
    });

    const seriesMap = new Map<string, Prisma.Decimal>();
    orders.forEach((entry) => {
      const bucket = entry.createdAt.toISOString().split("T")[0]!;
      const current = seriesMap.get(bucket) ?? new Prisma.Decimal(0);
      seriesMap.set(bucket, current.plus(entry.totalAmount));
    });

    return [...seriesMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amount]) => ({
        date,
        total: amount.toFixed(2),
      }));
  }

  private async getTopProducts(
    since: Date,
  ): Promise<{ productId: string; title: string; quantity: number }[]> {
    const topProductGroups = await this.prisma.orderItem.groupBy({
      by: ["productId"],
      where: {
        order: {
          createdAt: { gte: since },
          status: {
            in: [
              OrderStatus.PAID,
              OrderStatus.FULFILLED,
              OrderStatus.SHIPPED,
              OrderStatus.DELIVERED,
            ],
          },
        },
      },
      _sum: {
        quantity: true,
      },
      orderBy: {
        // eslint-disable-next-line no-underscore-dangle -- Prisma aggregate metadata uses prefixed fields
        _sum: {
          quantity: "desc",
        },
      },
      take: 5,
    });

    const productIds = topProductGroups.map((group) => group.productId);
    if (productIds.length === 0) {
      return [];
    }

    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, title: true },
    });
    const productTitleMap = new Map(products.map((product) => [product.id, product.title]));

    return topProductGroups.map((group) => ({
      productId: group.productId,
      title: productTitleMap.get(group.productId) ?? "Unknown",
      // eslint-disable-next-line no-underscore-dangle -- Prisma aggregate metadata uses prefixed fields
      quantity: group._sum.quantity ?? 0,
    }));
  }

  private async computeOrderSummary(where: Prisma.OrderWhereInput): Promise<OrderListSummary> {
    const [aggregate, totalOrders] = await Promise.all([
      this.prisma.order.aggregate({
        where,
        _sum: { totalAmount: true },
        _avg: { totalAmount: true },
      }),
      this.prisma.order.count({ where }),
    ]);

    // eslint-disable-next-line no-underscore-dangle -- Prisma aggregate metadata uses prefixed fields
    const totalAmount = aggregate._sum.totalAmount ?? new Prisma.Decimal(0);
    // eslint-disable-next-line no-underscore-dangle -- Prisma aggregate metadata uses prefixed fields
    const averageAmount = aggregate._avg.totalAmount ?? new Prisma.Decimal(0);

    return {
      totalRevenue: OrderService.toMoneyDTO(totalAmount, DEFAULT_CURRENCY),
      averageOrderValue: OrderService.toMoneyDTO(averageAmount, DEFAULT_CURRENCY),
      totalOrders,
    };
  }

  private static buildAdminWhere(query: AdminOrderListQuery): Prisma.OrderWhereInput {
    const where: Prisma.OrderWhereInput = {};
    const { filter, userEmail, minTotal, maxTotal } = query;

    if (filter?.status && filter.status.length > 0) {
      where.status = { in: filter.status };
    }

    if (filter?.userId) {
      where.userId = filter.userId;
    }

    if (filter?.reference) {
      where.reference = filter.reference;
    }

    if (filter?.createdAt) {
      where.createdAt = {
        gte: filter.createdAt.from ? new Date(filter.createdAt.from) : undefined,
        lte: filter.createdAt.to ? new Date(filter.createdAt.to) : undefined,
      };
    }

    if (filter?.updatedAt) {
      where.updatedAt = {
        gte: filter.updatedAt.from ? new Date(filter.updatedAt.from) : undefined,
        lte: filter.updatedAt.to ? new Date(filter.updatedAt.to) : undefined,
      };
    }

    const amountFilter: Prisma.DecimalFilter<"Order"> = {};
    if (filter?.totalAmount?.min) {
      amountFilter.gte = new Prisma.Decimal(filter.totalAmount.min);
    }
    if (filter?.totalAmount?.max) {
      amountFilter.lte = new Prisma.Decimal(filter.totalAmount.max);
    }

    if (userEmail) {
      where.user = {
        email: userEmail.toLowerCase(),
      };
    }

    if (minTotal) {
      amountFilter.gte = new Prisma.Decimal(minTotal);
    }

    if (maxTotal) {
      amountFilter.lte = new Prisma.Decimal(maxTotal);
    }

    if (Object.keys(amountFilter).length > 0) {
      where.totalAmount = amountFilter;
    }

    return where;
  }
}
