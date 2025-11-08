/* eslint-disable unicorn/no-null */
import { describe, expect, it, jest } from "@jest/globals";
import {
  InventoryPolicy,
  OrderStatus,
  type Payment,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  type PrismaClient,
  ProductStatus,
  UserStatus,
} from "@prisma/client";

import type { EmailService } from "@/lib/email/email.service.js";
import { ConflictError } from "@/lib/errors.js";
import type { OrderWithRelations } from "@lumi/shared/dto";

import type { AddressRepository } from "../../address/address.repository.js";
import type { CartWithRelations } from "../../cart/cart.repository.js";
import type { CartService } from "../../cart/cart.service.js";
import type { PaymentRepository } from "../../payment/payment.repository.js";
import type { OrderRepository } from "../order.repository.js";
import { OrderService } from "../order.service.js";
import type { CreateOrderInput } from "../order.validators.js";

type AsyncRepositoryMock = jest.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
type CartServiceContract = Pick<CartService, "validateCart">;
type AddressRepositoryContract = Pick<AddressRepository, "getDefaultAddress">;

interface OrderRepositoryMock {
  listForUser: AsyncRepositoryMock;
  findById: AsyncRepositoryMock;
  findByReference: AsyncRepositoryMock;
  update: AsyncRepositoryMock;
}

interface EmailServiceContract {
  sendOrderConfirmationEmail: EmailService["sendOrderConfirmationEmail"];
  sendOrderUpdateEmail: EmailService["sendOrderUpdateEmail"];
  sendOrderRefundEmail: EmailService["sendOrderRefundEmail"];
}

const createTransactionMock = () => ({
  order: {
    update: jest.fn(async () => ({})),
    create: jest.fn(async () => ({})),
    findFirst: jest.fn(async () => null),
  },
  orderItem: {
    findMany: jest.fn(async () => [] as { productVariantId: string; quantity: number }[]),
    createMany: jest.fn(async () => ({})),
  },
  productVariant: {
    update: jest.fn(async () => ({})),
  },
  payment: {
    update: jest.fn(async () => ({})),
    updateMany: jest.fn(async () => ({})),
    create: jest.fn(async () => ({})),
  },
  paymentRefund: {
    create: jest.fn(async () => ({})),
  },
  cart: {
    update: jest.fn(async () => ({})),
  },
  cartItem: {
    deleteMany: jest.fn(async () => ({})),
  },
  inventoryReservation: {
    updateMany: jest.fn(async () => ({})),
  },
  address: {
    findFirst: jest.fn(async () => null),
  },
});

type TransactionMock = ReturnType<typeof createTransactionMock>;

interface PrismaFactoryResult {
  prisma: PrismaClient;
  tx: TransactionMock;
}

const FIXTURE_TIMESTAMP = new Date("2025-01-05T10:00:00.000Z");

const ensureCuid = (value: string): string => {
  const normalized = value.replaceAll(/[^\da-z]/gi, "").toLowerCase() || "fixture";
  const repeatCount = Math.ceil(25 / normalized.length);
  return `c${normalized.repeat(repeatCount).slice(0, 24)}`;
};

const ORDER_ID = ensureCuid("ord_fixture");
const ORDER_ITEM_ID = ensureCuid("item_fixture");
const PRODUCT_ID = ensureCuid("prod_fixture");
const VARIANT_ID = ensureCuid("variant_fixture");
const USER_ID = ensureCuid("usr_fixture");
const CART_ID = ensureCuid("cart_fixture");
const SHIPPING_ADDRESS_ID = ensureCuid("addr_ship");
const BILLING_ADDRESS_ID = ensureCuid("addr_bill");
const PAYMENT_ID = ensureCuid("pay_fixture");

const createPrismaClientMock = (): PrismaFactoryResult => {
  const tx = createTransactionMock();
  const prisma = {
    $transaction: jest.fn(
      async (callback: (client: TransactionMock) => Promise<unknown> | unknown) => {
        return callback(tx);
      },
    ),
    order: {
      groupBy: jest.fn(),
      aggregate: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    orderItem: {
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },
    product: {
      findMany: jest.fn(),
    },
    payment: {
      update: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
    },
    paymentRefund: {
      create: jest.fn(),
    },
  } as unknown as PrismaClient;

  return {
    prisma,
    tx,
  };
};

const createOrderRepositoryMock = (): OrderRepositoryMock => ({
  listForUser: jest.fn(async () => ({})) as AsyncRepositoryMock,
  findById: jest.fn(async () => ({})) as AsyncRepositoryMock,
  findByReference: jest.fn(async () => ({})) as AsyncRepositoryMock,
  update: jest.fn(async () => ({})) as AsyncRepositoryMock,
});

const createEmailServiceMock = () =>
  ({
    sendOrderConfirmationEmail: jest.fn(),
    sendOrderUpdateEmail: jest.fn(),
    sendOrderRefundEmail: jest.fn(),
  }) as jest.Mocked<EmailServiceContract>;

const createPaymentGatewayMock = () => ({
  refund: jest.fn(async () => ({ status: "COMPLETED" as const })),
});

const createService = (
  overrides: {
    repository?: OrderRepositoryMock;
    prismaFactory?: () => PrismaFactoryResult;
    emailService?: jest.Mocked<EmailServiceContract>;
    paymentGateway?: ReturnType<typeof createPaymentGatewayMock>;
    cartService?: CartServiceContract;
    addressRepository?: AddressRepositoryContract;
  } = {},
) => {
  const repository = overrides.repository ?? createOrderRepositoryMock();
  const { prisma, tx } = (overrides.prismaFactory ?? createPrismaClientMock)();
  const emailService = overrides.emailService ?? createEmailServiceMock();
  const paymentGateway = overrides.paymentGateway ?? createPaymentGatewayMock();

  const cartServiceImpl = overrides.cartService ?? { validateCart: jest.fn() };
  const addressRepositoryImpl = overrides.addressRepository ?? { getDefaultAddress: jest.fn() };
  const cartService = cartServiceImpl as CartService;
  const addressRepository = addressRepositoryImpl as AddressRepository;
  const paymentRepository = {} as unknown as PaymentRepository;

  const service = new OrderService({
    prisma,
    repository: repository as unknown as OrderRepository,
    paymentRepository,
    cartService,
    addressRepository,
    emailService: emailService as unknown as EmailService,
    paymentGateway,
  });

  return {
    service,
    repository,
    emailService,
    paymentGateway,
    prisma,
    tx,
    cartService: cartServiceImpl,
    addressRepository: addressRepositoryImpl,
  };
};

const createProductFixture = () => ({
  id: PRODUCT_ID,
  title: "Fixture Lamp",
  slug: "fixture-lamp",
  sku: null,
  description: null,
  summary: null,
  status: ProductStatus.ACTIVE,
  price: new Prisma.Decimal("140.00"),
  compareAtPrice: null,
  currency: "TRY",
  inventoryPolicy: InventoryPolicy.TRACK,
  searchKeywords: [],
  attributes: null,
  deletedAt: null,
  createdAt: FIXTURE_TIMESTAMP,
  updatedAt: FIXTURE_TIMESTAMP,
});

const createVariantFixture = () => ({
  id: VARIANT_ID,
  productId: PRODUCT_ID,
  title: "Fixture Lamp Variant",
  sku: "SKU-FIXTURE",
  price: new Prisma.Decimal("140.00"),
  compareAtPrice: null,
  stock: 5,
  attributes: null,
  weightGrams: null,
  isPrimary: true,
  createdAt: FIXTURE_TIMESTAMP,
  updatedAt: FIXTURE_TIMESTAMP,
});

const createAddressFixture = (id: string) => ({
  id,
  userId: USER_ID,
  label: "Home",
  fullName: "Test User",
  phone: null,
  line1: "Test Street 1",
  line2: null,
  city: "Istanbul",
  state: null,
  postalCode: "34000",
  country: "TR",
  isDefault: true,
  createdAt: FIXTURE_TIMESTAMP,
  updatedAt: FIXTURE_TIMESTAMP,
});

const createUserFixture = () => ({
  id: USER_ID,
  email: "user@example.com",
  passwordHash: "hash",
  firstName: "Test",
  lastName: "User",
  phone: null,
  emailVerified: true,
  emailVerifiedAt: FIXTURE_TIMESTAMP,
  failedLoginCount: 0,
  lockoutUntil: null,
  twoFactorSecret: null,
  twoFactorEnabled: false,
  status: UserStatus.ACTIVE,
  createdAt: FIXTURE_TIMESTAMP,
  updatedAt: FIXTURE_TIMESTAMP,
});

const createPaymentFixture = (overrides: Partial<Payment> = {}): Payment => ({
  id: PAYMENT_ID,
  orderId: ORDER_ID,
  userId: USER_ID,
  provider: PaymentProvider.MANUAL,
  status: PaymentStatus.SETTLED,
  transactionId: "txn_fixture",
  conversationId: null,
  amount: new Prisma.Decimal("140.00"),
  paidPrice: null,
  currency: "TRY",
  installment: null,
  paymentChannel: null,
  paymentGroup: null,
  cardToken: null,
  cardAssociation: null,
  cardFamily: null,
  cardType: null,
  cardBankName: null,
  cardHolderName: null,
  binNumber: null,
  lastFourDigits: null,
  threeDSHtmlContent: null,
  ipAddress: null,
  deviceId: null,
  fraudScore: null,
  riskFlags: null,
  authorizedAt: FIXTURE_TIMESTAMP,
  settledAt: FIXTURE_TIMESTAMP,
  failedAt: null,
  failureReason: null,
  failureCode: null,
  rawPayload: null,
  createdAt: FIXTURE_TIMESTAMP,
  updatedAt: FIXTURE_TIMESTAMP,
  ...overrides,
});

const createOrderFixture = (overrides: Partial<OrderWithRelations> = {}): OrderWithRelations => {
  const base: OrderWithRelations = {
    id: ORDER_ID,
    reference: "LM-ORDER-1",
    userId: USER_ID,
    cartId: CART_ID,
    status: OrderStatus.PENDING,
    totalAmount: new Prisma.Decimal("140.00"),
    subtotalAmount: new Prisma.Decimal("120.00"),
    taxAmount: new Prisma.Decimal("20.00"),
    discountAmount: new Prisma.Decimal("0.00"),
    currency: "TRY",
    shippingAddressId: SHIPPING_ADDRESS_ID,
    billingAddressId: BILLING_ADDRESS_ID,
    placedAt: null,
    fulfilledAt: null,
    shippedAt: null,
    deliveredAt: null,
    cancelledAt: null,
    notes: null,
    metadata: {},
    version: 1,
    createdAt: FIXTURE_TIMESTAMP,
    updatedAt: FIXTURE_TIMESTAMP,
    items: [
      {
        id: ORDER_ITEM_ID,
        orderId: ORDER_ID,
        productId: PRODUCT_ID,
        productVariantId: VARIANT_ID,
        quantity: 1,
        unitPrice: new Prisma.Decimal("140.00"),
        currency: "TRY",
        titleSnapshot: "Fixture Lamp",
        variantSnapshot: { sku: "SKU-FIXTURE", attributes: null },
        createdAt: FIXTURE_TIMESTAMP,
        updatedAt: FIXTURE_TIMESTAMP,
        product: createProductFixture(),
        productVariant: createVariantFixture(),
      },
    ],
    payments: [],
    shippingAddress: createAddressFixture(SHIPPING_ADDRESS_ID),
    billingAddress: createAddressFixture(BILLING_ADDRESS_ID),
    user: createUserFixture(),
  };

  return { ...base, ...overrides } as OrderWithRelations;
};

const createCartFixture = (): CartWithRelations =>
  ({
    id: CART_ID,
    userId: USER_ID,
    sessionId: "session-fixture",
    status: "ACTIVE",
    expiresAt: null,
    createdAt: FIXTURE_TIMESTAMP,
    updatedAt: FIXTURE_TIMESTAMP,
    items: [
      {
        id: ensureCuid("cart-item"),
        cartId: CART_ID,
        productVariantId: VARIANT_ID,
        quantity: 1,
        unitPrice: new Prisma.Decimal("140.00"),
        createdAt: FIXTURE_TIMESTAMP,
        updatedAt: FIXTURE_TIMESTAMP,
        productVariant: {
          ...createVariantFixture(),
          product: createProductFixture(),
        },
      },
    ],
    user: {
      id: USER_ID,
      email: "user@example.com",
      firstName: "Test",
      lastName: "User",
    },
  }) as unknown as CartWithRelations;

const expectMetadataToContainNote = (repository: OrderRepositoryMock, message: string) => {
  const updateArgs = repository.update.mock.calls[0]?.[0] as
    | { data?: { metadata?: { internalNotes?: { message: string; authorId: string }[] } } }
    | undefined;
  expect(updateArgs?.data?.metadata?.internalNotes?.[0]).toMatchObject({
    message,
  });
};

describe("OrderService", () => {
  it("creates orders from valid carts using checkout flow", async () => {
    const cartService = { validateCart: jest.fn() };
    const addressRepository = { getDefaultAddress: jest.fn() };
    const { service, tx, emailService } = createService({
      cartService: cartService as CartServiceContract,
      addressRepository: addressRepository as AddressRepositoryContract,
    });

    const validateCartMock = cartService.validateCart as jest.MockedFunction<
      CartServiceContract["validateCart"]
    >;
    validateCartMock.mockResolvedValue({
      valid: true,
      cartId: CART_ID,
      totals: {
        subtotal: { amount: "120.00", currency: "TRY" },
        tax: { amount: "20.00", currency: "TRY" },
        discount: { amount: "0.00", currency: "TRY" },
        total: { amount: "140.00", currency: "TRY" },
      },
      issues: [],
      stock: {
        status: "ok",
        issues: [],
        checkedAt: new Date("2025-01-05T10:00:00.000Z").toISOString(),
      },
      checkedAt: new Date("2025-01-05T10:00:00.000Z").toISOString(),
    });

    const addressLookup = tx.address.findFirst as jest.MockedFunction<
      (args?: unknown) => Promise<unknown>
    >;
    addressLookup
      .mockResolvedValueOnce({ id: SHIPPING_ADDRESS_ID, userId: USER_ID })
      .mockResolvedValueOnce({ id: BILLING_ADDRESS_ID, userId: USER_ID });

    const loadCartSpy = jest.spyOn(
      OrderService as unknown as {
        loadCart: (...args: unknown[]) => Promise<CartWithRelations>;
      },
      "loadCart",
    ) as unknown as jest.MockedFunction<(...args: unknown[]) => Promise<CartWithRelations>>;
    loadCartSpy.mockResolvedValue(createCartFixture());
    const decrementSpy = jest.spyOn(
      OrderService as unknown as {
        decrementInventory: (...args: unknown[]) => Promise<void>;
      },
      "decrementInventory",
    ) as unknown as jest.MockedFunction<(...args: unknown[]) => Promise<void>>;
    decrementSpy.mockResolvedValue();

    tx.order.create.mockResolvedValue({ id: ORDER_ID });
    const orderFindFirst = tx.order.findFirst as jest.MockedFunction<
      (args?: unknown) => Promise<unknown>
    >;
    orderFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(createOrderFixture({ payments: [createPaymentFixture()] }));
    const paymentCreateMock = tx.payment.create as jest.MockedFunction<
      (args?: unknown) => Promise<unknown>
    >;
    paymentCreateMock.mockResolvedValue(createPaymentFixture());

    const input = {
      cartId: CART_ID,
      shippingAddressId: SHIPPING_ADDRESS_ID,
      payment: { provider: PaymentProvider.MANUAL },
      notes: "Leave at door",
    } as CreateOrderInput;

    const result = await service.createOrder(
      { userId: USER_ID, email: "user@example.com", sessionId: "sess-1" },
      input,
    );

    expect(cartService.validateCart).toHaveBeenCalledWith(
      { userId: USER_ID, sessionId: "sess-1" },
      { reserveInventory: true },
    );
    expect(tx.order.create).toHaveBeenCalled();
    expect(tx.cart.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CART_ID },
        data: expect.objectContaining({ status: "CHECKED_OUT" }),
      }),
    );
    expect(result.order.reference).toBe("LM-ORDER-1");
    expect(result.payment?.provider).toBe(PaymentProvider.MANUAL);
    expect(emailService.sendOrderConfirmationEmail).toHaveBeenCalledWith(
      expect.objectContaining({ status: "confirmed", orderReference: "LM-ORDER-1" }),
    );

    loadCartSpy.mockRestore();
    decrementSpy.mockRestore();
  });

  it("filters user orders with metadata sanitisation", async () => {
    const repository = createOrderRepositoryMock();
    repository.listForUser.mockResolvedValue({
      items: [
        createOrderFixture({
          metadata: {
            shipment: { trackingNumber: "TRK-1" },
            internalNotes: [{ id: "note-1", authorId: "admin", message: "secret" }],
          },
        }),
      ],
      meta: {
        page: 2,
        pageSize: 5,
        totalItems: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: true,
      },
    });

    const { service } = createService({ repository });

    const result = await service.listUserOrders(USER_ID, {
      page: 2,
      pageSize: 5,
      status: [OrderStatus.PAID],
      from: new Date("2025-01-01T00:00:00.000Z"),
      to: new Date("2025-02-01T00:00:00.000Z"),
    });

    expect(repository.listForUser).toHaveBeenCalledWith(
      USER_ID,
      { page: 2, pageSize: 5 },
      expect.objectContaining({
        status: { in: [OrderStatus.PAID] },
        createdAt: {
          gte: expect.any(Date),
          lte: expect.any(Date),
        },
      }),
    );

    expect(result.items[0]?.metadata).toEqual({
      shipment: expect.objectContaining({ trackingNumber: "TRK-1" }),
    });
  });

  it("builds public tracking summaries with shipment details", async () => {
    const repository = createOrderRepositoryMock();
    repository.findByReference.mockResolvedValue(
      createOrderFixture({
        status: OrderStatus.SHIPPED,
        placedAt: FIXTURE_TIMESTAMP,
        fulfilledAt: new Date("2025-01-06T10:00:00.000Z"),
        shippedAt: new Date("2025-01-07T10:00:00.000Z"),
        metadata: {
          shipment: {
            trackingNumber: "TRK-123",
            trackingUrl: "https://tracking.example/TRK-123",
            carrier: "Lumi Logistics",
            estimatedDelivery: "2025-01-12T10:00:00.000Z",
          },
        },
      }),
    );

    const { service } = createService({ repository });
    const summary = await service.trackOrder({ reference: "LM-ORDER-1" });

    expect(summary.reference).toBe("LM-ORDER-1");
    expect(summary.tracking).toEqual({
      trackingNumber: "TRK-123",
      trackingUrl: "https://tracking.example/TRK-123",
      carrier: "Lumi Logistics",
    });
    expect(summary.timeline.map((entry) => entry.status)).toEqual([
      "PENDING",
      "PAID",
      "FULFILLED",
      "SHIPPED",
    ]);
    expect(summary.estimatedDelivery).toBe("2025-01-12T10:00:00.000Z");
  });

  it("rejects invalid admin status transitions", async () => {
    const repository = createOrderRepositoryMock();
    repository.findById.mockResolvedValue(
      createOrderFixture({
        status: OrderStatus.DELIVERED,
      }),
    );

    const { service } = createService({ repository });

    await expect(service.updateOrderStatus(ORDER_ID, { status: OrderStatus.PAID })).rejects.toThrow(
      ConflictError,
    );
  });

  it("updates statuses with shipment metadata and restocks on cancellation", async () => {
    const repository = createOrderRepositoryMock();
    const initialOrder = createOrderFixture({
      status: OrderStatus.PAID,
      version: 5,
      metadata: {
        shipment: { trackingNumber: "OLD" },
      },
    });
    const updatedOrder = createOrderFixture({
      status: OrderStatus.CANCELLED,
      cancelledAt: new Date("2025-01-08T10:00:00.000Z"),
      metadata: {
        shipment: {
          trackingNumber: "NEW-TRACK",
          trackingUrl: "https://tracking.example/NEW-TRACK",
          carrier: "Lumi Logistics",
        },
      },
    });
    repository.findById.mockResolvedValueOnce(initialOrder).mockResolvedValueOnce(updatedOrder);

    const { service, emailService, tx } = createService({ repository });
    tx.orderItem.findMany.mockResolvedValue([{ productVariantId: VARIANT_ID, quantity: 1 }]);

    const result = await service.updateOrderStatus(initialOrder.id, {
      status: OrderStatus.CANCELLED,
      trackingNumber: "NEW-TRACK",
      trackingUrl: "https://tracking.example/NEW-TRACK",
      carrier: "Lumi Logistics",
      estimatedDelivery: new Date("2025-02-01T10:00:00.000Z"),
      version: initialOrder.version,
    });

    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: initialOrder.id },
      data: expect.objectContaining({
        status: OrderStatus.CANCELLED,
        metadata: expect.objectContaining({
          shipment: expect.objectContaining({ trackingNumber: "NEW-TRACK" }),
        }),
      }),
    });
    expect(tx.productVariant.update).toHaveBeenCalledWith({
      where: { id: VARIANT_ID },
      data: { stock: { increment: 1 } },
    });
    expect(emailService.sendOrderUpdateEmail).toHaveBeenCalled();
    expect(result.status).toBe(OrderStatus.CANCELLED);
  });

  it("adds internal notes for admins", async () => {
    const repository = createOrderRepositoryMock();
    repository.findById
      .mockResolvedValueOnce(
        createOrderFixture({
          metadata: {
            internalNotes: [
              {
                id: "existing-note",
                authorId: "admin",
                message: "Existing",
                createdAt: "2025-01-01",
              },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(createOrderFixture());

    const { service } = createService({ repository });

    await service.addInternalNote(ORDER_ID, { message: "Investigate payment" }, "admin-1");

    expect(repository.update).toHaveBeenCalledWith({
      where: { id: ORDER_ID },
      data: expect.any(Object),
    });
    expectMetadataToContainNote(repository, "Investigate payment");
  });

  it("processes full refunds and restores inventory", async () => {
    const repository = createOrderRepositoryMock();
    const payment = createPaymentFixture();
    const initialOrder = createOrderFixture({
      status: OrderStatus.PAID,
      payments: [payment],
    });
    const refundedOrder = createOrderFixture({
      status: OrderStatus.CANCELLED,
      cancelledAt: new Date("2025-01-09T10:00:00.000Z"),
      payments: [payment],
    });
    repository.findById.mockResolvedValueOnce(initialOrder).mockResolvedValueOnce(refundedOrder);

    const paymentGateway = createPaymentGatewayMock();
    const { service, emailService, tx } = createService({ repository, paymentGateway });
    tx.orderItem.findMany.mockResolvedValue([{ productVariantId: VARIANT_ID, quantity: 1 }]);

    const result = await service.processRefund(initialOrder.id, {
      paymentId: payment.id,
      amount: { amount: "140.00", currency: "TRY" },
      type: "full",
    });

    expect(paymentGateway.refund).toHaveBeenCalledWith(
      expect.objectContaining({ id: payment.id }),
      expect.objectContaining({ amount: expect.any(Prisma.Decimal) }),
    );
    expect(tx.payment.update).toHaveBeenCalledWith({
      where: { id: payment.id },
      data: expect.objectContaining({ status: PaymentStatus.REFUNDED }),
    });
    expect(tx.paymentRefund.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ paymentId: payment.id }),
      }),
    );
    expect(tx.productVariant.update).toHaveBeenCalled();
    expect(emailService.sendOrderRefundEmail).toHaveBeenCalled();
    expect(result.status).toBe(OrderStatus.CANCELLED);
  });

  it("computes order statistics for recent activity", async () => {
    const { service, prisma } = createService();
    jest.useFakeTimers().setSystemTime(new Date("2025-02-01T00:00:00.000Z"));

    const prismaOrderGroupBy = prisma.order.groupBy as jest.MockedFunction<
      (args?: unknown) => Promise<unknown>
    >;
    prismaOrderGroupBy.mockResolvedValue([
      { status: OrderStatus.PAID, _count: { _all: 3 } },
      { status: OrderStatus.CANCELLED, _count: { _all: 1 } },
    ]);
    const prismaOrderAggregate = prisma.order.aggregate as jest.MockedFunction<
      (args?: unknown) => Promise<unknown>
    >;
    prismaOrderAggregate.mockResolvedValue({
      _avg: { totalAmount: new Prisma.Decimal("150.00") },
      _sum: { totalAmount: new Prisma.Decimal("450.00") },
    });
    const prismaOrderFindMany = prisma.order.findMany as jest.MockedFunction<
      (args?: unknown) => Promise<unknown>
    >;
    prismaOrderFindMany.mockResolvedValue([
      {
        createdAt: new Date("2025-01-30T00:00:00.000Z"),
        totalAmount: new Prisma.Decimal("200.00"),
      },
      {
        createdAt: new Date("2025-01-31T00:00:00.000Z"),
        totalAmount: new Prisma.Decimal("250.00"),
      },
    ]);
    const prismaOrderItemGroupBy = prisma.orderItem.groupBy as jest.MockedFunction<
      (args?: unknown) => Promise<unknown>
    >;
    prismaOrderItemGroupBy.mockResolvedValue([{ productId: PRODUCT_ID, _sum: { quantity: 4 } }]);
    const prismaProductFindMany = prisma.product.findMany as jest.MockedFunction<
      (args?: unknown) => Promise<unknown>
    >;
    prismaProductFindMany.mockResolvedValue([{ id: PRODUCT_ID, title: "Fixture Lamp" }]);

    const stats = await service.getOrderStats({ range: "7d" });

    expect(stats.revenue.total).toBe("450.00");
    expect(stats.averageOrderValue).toBe("150.00");
    expect(stats.revenueSeries).toHaveLength(2);
    expect(stats.topProducts[0]).toMatchObject({ productId: PRODUCT_ID, quantity: 4 });
    expect(stats.conversionRate).toBeGreaterThan(0);
    expect(prisma.order.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({ gte: expect.any(Date) }),
        }),
      }),
    );

    jest.useRealTimers();
  });
});
