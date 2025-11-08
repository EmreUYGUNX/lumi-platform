import { Prisma } from "@prisma/client";
import type { Order, OrderStatus, PrismaClient } from "@prisma/client";

import { ConflictError, NotFoundError } from "@/lib/errors.js";
import {
  BaseRepository,
  type CursorPaginatedResult,
  type PaginatedResult,
  type PaginationOptions,
  type RepositoryContext,
} from "@/lib/repository/base.repository.js";

type OrderRepositoryContext = RepositoryContext<
  Prisma.OrderDelegate,
  Prisma.OrderWhereInput,
  Prisma.OrderOrderByWithRelationInput
>;

const ORDER_DEFAULT_INCLUDE = Prisma.validator<Prisma.OrderInclude>()({
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
});

const ORDER_DEFAULT_SORT: Prisma.OrderOrderByWithRelationInput[] = [{ createdAt: "desc" }];

const ORDER_HISTORY_SELECT = {
  id: true,
  reference: true,
  status: true,
  totalAmount: true,
  subtotalAmount: true,
  taxAmount: true,
  discountAmount: true,
  currency: true,
  placedAt: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  items: {
    select: {
      id: true,
      quantity: true,
      unitPrice: true,
      productId: true,
      productVariantId: true,
      titleSnapshot: true,
      variantSnapshot: true,
    },
    take: 25,
  },
  payments: {
    orderBy: { createdAt: "desc" },
    take: 3,
    select: {
      id: true,
      status: true,
      amount: true,
      createdAt: true,
    },
  },
  shippingAddress: {
    select: {
      id: true,
      fullName: true,
      city: true,
      country: true,
    },
  },
  billingAddress: {
    select: {
      id: true,
      fullName: true,
      city: true,
      country: true,
    },
  },
} satisfies Prisma.OrderSelect;

const STATUS_TIMESTAMP_FIELDS: Partial<Record<OrderStatus, keyof Prisma.OrderUpdateInput>> = {
  PAID: "placedAt",
  FULFILLED: "fulfilledAt",
  SHIPPED: "shippedAt",
  DELIVERED: "deliveredAt",
  CANCELLED: "cancelledAt",
};

type OrderHistorySummary = Prisma.OrderGetPayload<{ select: typeof ORDER_HISTORY_SELECT }>;

export class OrderRepository extends BaseRepository<
  Prisma.OrderDelegate,
  Prisma.OrderWhereInput,
  Prisma.OrderOrderByWithRelationInput,
  Prisma.OrderSelect,
  Prisma.OrderInclude
> {
  constructor(
    private readonly prisma: PrismaClient,
    context?: OrderRepositoryContext,
  ) {
    super(
      context ?? {
        modelName: "Order",
        delegate: prisma.order,
        getDelegate: (client) => client.order,
        runInTransaction: (callback) => prisma.$transaction(callback),
        primaryKey: "id",
        defaultSort: ORDER_DEFAULT_SORT,
      },
    );
  }

  // eslint-disable-next-line class-methods-use-this -- Controlled factory ensures Prisma dependency reuse
  protected createWithContext(context: OrderRepositoryContext): this {
    return new OrderRepository(this.prisma, context) as this;
  }

  async findByReference(
    reference: string,
    options: { include?: Prisma.OrderInclude; select?: Prisma.OrderSelect } = {},
  ) {
    return this.findFirst({
      where: { reference },
      include: options.include ?? ORDER_DEFAULT_INCLUDE,
      select: options.select,
    });
  }

  async requireByReference(reference: string, options: { include?: Prisma.OrderInclude } = {}) {
    const order = await this.findByReference(reference, options);
    if (!order) {
      throw new NotFoundError("Order not found.", { details: { reference } });
    }

    return order;
  }

  async listByStatus(
    status: OrderStatus,
    pagination: Omit<
      PaginationOptions<
        Prisma.OrderWhereInput,
        Prisma.OrderOrderByWithRelationInput,
        Prisma.OrderSelect,
        Prisma.OrderInclude
      >,
      "where"
    > = {},
  ): Promise<PaginatedResult<Prisma.OrderGetPayload<{ include: Prisma.OrderInclude }>>> {
    return this.paginate({
      ...pagination,
      where: { status },
      include: pagination.include ?? ORDER_DEFAULT_INCLUDE,
      orderBy: pagination.orderBy ?? ORDER_DEFAULT_SORT,
    }) as Promise<PaginatedResult<Prisma.OrderGetPayload<{ include: Prisma.OrderInclude }>>>;
  }

  async listForUser(
    userId: string,
    pagination: Omit<
      PaginationOptions<
        Prisma.OrderWhereInput,
        Prisma.OrderOrderByWithRelationInput,
        Prisma.OrderSelect,
        Prisma.OrderInclude
      >,
      "where"
    > = {},
    filters: Prisma.OrderWhereInput = {},
  ): Promise<PaginatedResult<Prisma.OrderGetPayload<{ include: Prisma.OrderInclude }>>> {
    const where: Prisma.OrderWhereInput = {
      ...filters,
      userId,
    };

    return this.paginate({
      ...pagination,
      where,
      include: pagination.include ?? ORDER_DEFAULT_INCLUDE,
      orderBy: pagination.orderBy ?? ORDER_DEFAULT_SORT,
    }) as Promise<PaginatedResult<Prisma.OrderGetPayload<{ include: Prisma.OrderInclude }>>>;
  }

  async listForUserHistory(
    userId: string,
    pagination: Omit<
      PaginationOptions<
        Prisma.OrderWhereInput,
        Prisma.OrderOrderByWithRelationInput,
        Prisma.OrderSelect,
        Prisma.OrderInclude
      >,
      "where"
    > = {},
  ): Promise<PaginatedResult<OrderHistorySummary>> {
    return this.paginate({
      ...pagination,
      where: { userId },
      select: ORDER_HISTORY_SELECT,
      orderBy: pagination.orderBy ?? ORDER_DEFAULT_SORT,
    }) as Promise<PaginatedResult<OrderHistorySummary>>;
  }

  async listForUserCursor(
    userId: string,
    pagination: Omit<
      PaginationOptions<
        Prisma.OrderWhereInput,
        Prisma.OrderOrderByWithRelationInput,
        Prisma.OrderSelect,
        Prisma.OrderInclude
      >,
      "where"
    > = {},
  ): Promise<CursorPaginatedResult<OrderHistorySummary>> {
    const result = await this.paginateWithCursor({
      ...pagination,
      where: { userId },
      select: ORDER_HISTORY_SELECT,
      orderBy: pagination.orderBy ?? ([{ createdAt: "desc" }, { id: "desc" }] as const),
    });

    return result as unknown as CursorPaginatedResult<OrderHistorySummary>;
  }

  async updateStatus(
    id: string,
    status: OrderStatus,
    options: { version?: number } = {},
  ): Promise<Order> {
    /* eslint-disable security/detect-object-injection */
    return this.withTransaction(async (repo, tx) => {
      const order = await repo.findById(id);
      if (!order) {
        throw new NotFoundError("Order not found.", { details: { id } });
      }

      if (options.version !== undefined && order.version !== options.version) {
        throw new ConflictError("Order version conflict detected.", {
          details: { expected: options.version, actual: order.version },
        });
      }

      const timestampField = STATUS_TIMESTAMP_FIELDS[status];
      // eslint-disable-next-line security/detect-object-injection -- Controlled mapping of enum keys
      const data: Prisma.OrderUpdateInput = {
        status,
        version: { increment: 1 },
      };

      if (timestampField) {
        data[timestampField] = new Date();
      }

      return tx.order.update({
        where: { id },
        data,
      });
    });
    /* eslint-enable security/detect-object-injection */
  }

  async attachPayment(orderId: string, paymentId: string): Promise<void> {
    await this.update({
      where: { id: orderId },
      data: {
        payments: {
          connect: { id: paymentId },
        },
      },
    });
  }
}
