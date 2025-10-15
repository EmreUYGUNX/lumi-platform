import { beforeAll, beforeEach, describe, expect, it } from "@jest/globals";
import type { Prisma, PrismaClient } from "@prisma/client";
import { PaymentStatus } from "@prisma/client";

import { NotFoundError } from "@/lib/errors.js";
import { PaymentRepository } from "@/modules/payment/payment.repository.js";

import {
  createOrder,
  createPayment,
  createProductBundle,
  createUser,
} from "../../fixtures/index.js";
import { getTestDatabaseManager } from "../../helpers/db.js";

describe("PaymentRepository (database)", () => {
  const testDatabase = getTestDatabaseManager();
  let prisma: PrismaClient;
  let repository: PaymentRepository;

  beforeAll(async () => {
    prisma = await testDatabase.getPrismaClient();
  });

  beforeEach(() => {
    repository = new PaymentRepository(prisma);
  });

  it("finds payments by transaction id with related data", async () => {
    const user = await createUser(prisma);
    const { product, primaryVariant } = await createProductBundle(prisma);
    const order = await createOrder(prisma, {
      user,
      items: [{ product, variant: primaryVariant, quantity: 1 }],
    });
    const payment = await createPayment(prisma, { order, user });

    const found = (await repository.findByTransactionId(
      payment.transactionId,
    )) as Prisma.PaymentGetPayload<{
      include: { order: true; refunds: true };
    }> | null;
    const orderPayments = await repository.listForOrder(order.id);
    expect(found?.order?.id).toBe(order.id);
    expect(found?.refunds).toHaveLength(0);
    expect(orderPayments).toHaveLength(1);
  });

  it("updates payment status with optimistic checks", async () => {
    const user = await createUser(prisma);
    const { product, primaryVariant } = await createProductBundle(prisma);
    const order = await createOrder(prisma, {
      user,
      items: [{ product, variant: primaryVariant, quantity: 1 }],
    });
    const payment = await createPayment(prisma, { order, user });

    const updated = await repository.updateStatus(payment.id, PaymentStatus.SETTLED, {
      settledAt: new Date(),
    });

    expect(updated.status).toBe(PaymentStatus.SETTLED);
    expect(updated.settledAt).toBeInstanceOf(Date);

    await expect(
      repository.updateStatus("missing-payment", PaymentStatus.FAILED),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("records refunds within a transaction boundary", async () => {
    const user = await createUser(prisma);
    const { product, primaryVariant } = await createProductBundle(prisma);
    const order = await createOrder(prisma, {
      user,
      items: [{ product, variant: primaryVariant, quantity: 1 }],
    });
    const payment = await createPayment(prisma, { order, user });

    await repository.recordRefund(payment.id, {
      amount: payment.amount,
      currency: payment.currency,
      status: "COMPLETED",
      reason: "Test refund",
    });

    const refunds = await prisma.paymentRefund.findMany({ where: { paymentId: payment.id } });
    expect(refunds).toHaveLength(1);
    expect(refunds[0]?.status).toBe("COMPLETED");
  });
});
