import type { Payment, PaymentStatus, Prisma, PrismaClient } from "@prisma/client";

import { NotFoundError } from "@/lib/errors.js";
import { BaseRepository, type RepositoryContext } from "@/lib/repository/base.repository.js";

type PaymentRepositoryContext = RepositoryContext<
  Prisma.PaymentDelegate,
  Prisma.PaymentWhereInput,
  Prisma.PaymentOrderByWithRelationInput
>;

const PAYMENT_DEFAULT_INCLUDE: Prisma.PaymentInclude = {
  refunds: true,
  order: {
    include: {
      items: true,
    },
  },
};

export class PaymentRepository extends BaseRepository<
  Prisma.PaymentDelegate,
  Prisma.PaymentWhereInput,
  Prisma.PaymentOrderByWithRelationInput,
  Prisma.PaymentSelect,
  Prisma.PaymentInclude
> {
  constructor(
    private readonly prisma: PrismaClient,
    context?: PaymentRepositoryContext,
  ) {
    super(
      context ?? {
        modelName: "Payment",
        delegate: prisma.payment,
        getDelegate: (client) => client.payment,
        runInTransaction: (callback) => prisma.$transaction(callback),
        primaryKey: "id",
        defaultSort: [{ createdAt: "desc" }],
      },
    );
  }

  // eslint-disable-next-line class-methods-use-this -- Explicit factory retains Prisma dependency injection
  protected createWithContext(context: PaymentRepositoryContext): this {
    return new PaymentRepository(this.prisma, context) as this;
  }

  async findByTransactionId(transactionId: string) {
    return this.findFirst({
      where: { transactionId },
      include: PAYMENT_DEFAULT_INCLUDE,
    });
  }

  async listForOrder(orderId: string) {
    return this.findMany({
      where: { orderId },
      include: PAYMENT_DEFAULT_INCLUDE,
      orderBy: [{ createdAt: "desc" }],
    });
  }

  async updateStatus(
    paymentId: string,
    status: PaymentStatus,
    data: Partial<Prisma.PaymentUpdateInput> = {},
  ): Promise<Payment> {
    const payment = await this.findById(paymentId);
    if (!payment) {
      throw new NotFoundError("Payment not found.", { details: { paymentId } });
    }

    return this.update({
      where: { id: paymentId },
      data: {
        status,
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  async recordRefund(
    paymentId: string,
    refund: Prisma.PaymentRefundCreateWithoutPaymentInput,
  ): Promise<void> {
    await this.withTransaction(async (_repo, tx) => {
      await tx.paymentRefund.create({
        data: {
          ...refund,
          paymentId,
        },
      });
    });
  }
}
