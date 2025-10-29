// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { describe, expect, it, jest } from "@jest/globals";
import { Prisma, type PrismaClient } from "@prisma/client";

import { ValidationError } from "@/lib/errors.js";
import { prismaMiddlewaresInternals } from "@/lib/prisma/middleware";

type DelegateStubs = Record<string, Record<string, jest.Mock>>;

const createPrismaStub = (delegates: DelegateStubs): unknown => {
  const base: Record<string, unknown> = {
    $use: jest.fn(),
    $transaction: jest.fn((callback: (client: unknown) => unknown) => callback(base)),
  };

  Object.entries(delegates).forEach(([key, value]) => {
    base[key] = value;
  });

  return base;
};

describe("Prisma middleware validation", () => {
  it("rejects invalid user email addresses", async () => {
    const prisma = createPrismaStub({
      user: {
        findUnique: jest.fn(),
      },
    });

    const middleware = prismaMiddlewaresInternals.createValidationMiddleware(
      prisma as unknown as PrismaClient,
    );

    await expect(
      middleware(
        { model: "User", action: "create", args: { data: { email: "invalid-email" } } },
        async () => ({}),
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects negative product prices", async () => {
    const prisma = createPrismaStub({
      product: {
        findUnique: jest.fn(),
      },
    });

    const middleware = prismaMiddlewaresInternals.createValidationMiddleware(
      prisma as unknown as PrismaClient,
    );

    await expect(
      middleware(
        {
          model: "Product",
          action: "create",
          args: { data: { price: new Prisma.Decimal("-1") } },
        },
        async () => ({}),
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("prevents creating product variants without an existing primary variant", async () => {
    const prisma = createPrismaStub({
      product: {
        findUnique: jest.fn().mockResolvedValue({ id: "prod-1" }),
      },
      productVariant: {
        count: jest.fn().mockResolvedValue(0),
      },
    });

    const business = prismaMiddlewaresInternals.createBusinessRulesMiddleware(
      prisma as unknown as PrismaClient,
    );
    const validation = prismaMiddlewaresInternals.createValidationMiddleware(
      prisma as unknown as PrismaClient,
    );

    const params = {
      model: "ProductVariant",
      action: "create",
      args: {
        data: {
          productId: "prod-1",
          price: new Prisma.Decimal("10"),
          isPrimary: false,
        },
      },
    };

    await expect(validation(params, async () => ({}))).resolves.toBeDefined();

    await expect(business(params, async () => ({}))).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects payment creation when amount does not match order total", async () => {
    const prisma = createPrismaStub({
      order: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: "order-1", totalAmount: new Prisma.Decimal("100") }),
      },
      payment: {
        findUnique: jest.fn(),
      },
    });

    const validation = prismaMiddlewaresInternals.createValidationMiddleware(
      prisma as unknown as PrismaClient,
    );
    const business = prismaMiddlewaresInternals.createBusinessRulesMiddleware(
      prisma as unknown as PrismaClient,
    );

    const params = {
      model: "Payment",
      action: "create",
      args: {
        data: {
          orderId: "order-1",
          amount: new Prisma.Decimal("50"),
        },
      },
    };

    await expect(validation(params, async () => ({}))).resolves.toBeDefined();
    await expect(business(params, async () => ({}))).rejects.toBeInstanceOf(ValidationError);
  });

  it("prevents circular category hierarchies", async () => {
    const prisma = createPrismaStub({
      category: {
        findUnique: jest
          .fn()
          .mockImplementation(({ where }: { where: { id: string } }) =>
            where.id === "cat-parent" ? { id: "cat-parent", parentId: "cat-1" } : undefined,
          ),
      },
    });

    const business = prismaMiddlewaresInternals.createBusinessRulesMiddleware(
      prisma as unknown as PrismaClient,
    );

    await expect(
      business(
        {
          model: "Category",
          action: "update",
          args: { where: { id: "cat-1" }, data: { parentId: "cat-parent" } },
        },
        async () => ({}),
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("enforces coupon usage limits", async () => {
    const prisma = createPrismaStub({
      coupon: {
        findUnique: jest.fn().mockResolvedValue({ id: "coupon-1", usageLimit: 1 }),
      },
      couponUsage: {
        count: jest.fn().mockResolvedValue(1),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: "user-1" }),
      },
      order: {
        findUnique: jest.fn().mockResolvedValue({ id: "order-1" }),
      },
    });

    const validation = prismaMiddlewaresInternals.createValidationMiddleware(
      prisma as unknown as PrismaClient,
    );
    const business = prismaMiddlewaresInternals.createBusinessRulesMiddleware(
      prisma as unknown as PrismaClient,
    );

    const params = {
      model: "CouponUsage",
      action: "create",
      args: {
        data: {
          couponId: "coupon-1",
          userId: "user-1",
          orderId: "order-1",
          discountAmount: new Prisma.Decimal("10"),
        },
      },
    };

    await expect(validation(params, async () => ({}))).resolves.toBeDefined();
    await expect(business(params, async () => ({}))).rejects.toBeInstanceOf(ValidationError);
  });

  it("validates foreign key existence for cart items", async () => {
    const prisma = createPrismaStub({
      cart: {
        findUnique: jest.fn().mockResolvedValue(),
      },
      productVariant: {
        findUnique: jest.fn().mockResolvedValue({ id: "variant-1" }),
      },
    });

    const validation = prismaMiddlewaresInternals.createValidationMiddleware(
      prisma as unknown as PrismaClient,
    );

    await expect(
      validation(
        {
          model: "CartItem",
          action: "create",
          args: {
            data: {
              cartId: "cart-1",
              productVariantId: "variant-1",
              unitPrice: new Prisma.Decimal("10"),
            },
          },
        },
        async () => ({}),
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
