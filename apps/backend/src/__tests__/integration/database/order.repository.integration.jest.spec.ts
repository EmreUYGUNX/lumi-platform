import { beforeAll, beforeEach, describe, expect, it } from "@jest/globals";
import type { PrismaClient } from "@prisma/client";
import { OrderStatus } from "@prisma/client";

import { ConflictError } from "@/lib/errors.js";
import { OrderRepository } from "@/modules/order/order.repository.js";

import {
  createCart,
  createCartItem,
  createOrder,
  createProductBundle,
  createUser,
} from "../../fixtures/index.js";
import { getTestDatabaseManager } from "../../helpers/db.js";

describe("OrderRepository (database)", () => {
  const testDatabase = getTestDatabaseManager();
  let prisma: PrismaClient;
  let repository: OrderRepository;

  beforeAll(async () => {
    prisma = await testDatabase.getPrismaClient();
  });

  beforeEach(() => {
    repository = new OrderRepository(prisma);
  });

  it("lists orders by status with pagination metadata", async () => {
    const user = await createUser(prisma);
    const { product, primaryVariant } = await createProductBundle(prisma);

    await createOrder(prisma, {
      user,
      items: [{ product, variant: primaryVariant, quantity: 1 }],
      status: OrderStatus.PENDING,
    });

    const result = await repository.listByStatus(OrderStatus.PENDING, { page: 1, pageSize: 10 });

    expect(result.items).toHaveLength(1);
    expect(result.meta.totalItems).toBeGreaterThanOrEqual(1);
    expect(result.meta.page).toBe(1);
  });

  it("enforces optimistic concurrency when updating status", async () => {
    const user = await createUser(prisma);
    const { product, primaryVariant } = await createProductBundle(prisma);
    const order = await createOrder(prisma, {
      user,
      items: [{ product, variant: primaryVariant, quantity: 2 }],
      status: OrderStatus.PENDING,
    });

    const fulfilled = await repository.updateStatus(order.id, OrderStatus.FULFILLED, {
      version: order.version,
    });

    expect(fulfilled.status).toBe(OrderStatus.FULFILLED);
    expect(fulfilled.version).toBe(order.version + 1);
    expect(fulfilled.fulfilledAt).toBeInstanceOf(Date);

    await expect(
      repository.updateStatus(order.id, OrderStatus.PAID, { version: order.version }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("attaches payments to orders and hydrates relations", async () => {
    const user = await createUser(prisma);
    const { product, primaryVariant } = await createProductBundle(prisma);
    const cart = await createCart(prisma, { user });
    await createCartItem(prisma, { cart, variant: primaryVariant, quantity: 1 });
    const order = await createOrder(prisma, {
      user,
      cart,
      items: [{ product, variant: primaryVariant, quantity: 1 }],
      status: OrderStatus.PENDING,
    });

    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        provider: "IYZICO",
        status: "AUTHORIZED",
        amount: order.totalAmount,
        transactionId: `txn-${order.id}`,
        currency: order.currency,
      },
    });

    await repository.attachPayment(order.id, payment.id);
    const refreshed = await repository.requireByReference(order.reference, { include: undefined });
    const payments = await prisma.payment.findMany({ where: { orderId: order.id } });

    expect(refreshed).not.toBeNull();
    expect(payments).toHaveLength(1);
    expect(payments[0]?.id).toBe(payment.id);
  });
});
