import { beforeAll, beforeEach, describe, expect, it } from "@jest/globals";
import type { Prisma, PrismaClient } from "@prisma/client";
import { CartStatus } from "@prisma/client";

import { NotFoundError } from "@/lib/errors.js";
import { CartRepository } from "@/modules/cart/cart.repository.js";

import {
  createCart,
  createCartItem,
  createProductBundle,
  createUser,
} from "../../fixtures/index.js";
import { getTestDatabaseManager } from "../../helpers/db.js";

describe("CartRepository (database)", () => {
  const testDatabase = getTestDatabaseManager();
  let prisma: PrismaClient;
  let repository: CartRepository;

  beforeAll(async () => {
    prisma = await testDatabase.getPrismaClient();
  });

  beforeEach(() => {
    repository = new CartRepository(prisma);
  });

  it("adds or updates cart items atomically", async () => {
    const user = await createUser(prisma);
    const { primaryVariant } = await createProductBundle(prisma);
    const cart = await createCart(prisma, { user });

    const updated = await repository.addOrUpdateItem(
      cart.id,
      primaryVariant.id,
      2,
      primaryVariant.price,
    );

    expect(updated.items).toHaveLength(1);
    expect(updated.items[0]?.productVariantId).toBe(primaryVariant.id);
    expect((updated.items[0]?.unitPrice as Prisma.Decimal).toNumber()).toBe(
      primaryVariant.price.toNumber(),
    );
  });

  it("merges carts and accumulates quantities", async () => {
    const user = await createUser(prisma);
    const { primaryVariant } = await createProductBundle(prisma);
    const source = await createCart(prisma, { user });
    const target = await createCart(prisma, { user });

    await createCartItem(prisma, { cart: source, variant: primaryVariant, quantity: 1 });
    await createCartItem(prisma, { cart: target, variant: primaryVariant, quantity: 1 });

    await repository.mergeCarts(source.id, target.id);

    const merged = await repository.ensureActiveCart(target.id);
    expect(merged.items[0]?.quantity).toBe(2);

    const sourceRecord = await prisma.cart.findUniqueOrThrow({ where: { id: source.id } });
    expect(sourceRecord.status).toBe(CartStatus.CHECKED_OUT);
  });

  it("rejects expired carts", async () => {
    const user = await createUser(prisma);
    const { id } = await createCart(prisma, {
      user,
      expiresAt: new Date(Date.now() - 60_000),
    });

    await expect(repository.ensureActiveCart(id)).rejects.toBeInstanceOf(NotFoundError);
  });
});
