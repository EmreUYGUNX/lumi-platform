/* eslint-disable unicorn/no-null */
import { describe, expect, it, jest } from "@jest/globals";
import { InventoryPolicy, Prisma, ProductStatus } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

import type { EmailService } from "@/lib/email/email.service.js";

import type { CartCache, CartCacheScope } from "../cart.cache.js";
import type { CartRepository, CartWithRelations } from "../cart.repository.js";
import { CartService } from "../cart.service.js";
import type { CartSummaryView, CartValidationReport } from "../cart.types.js";
import { CART_ITEM_MAX_QUANTITY } from "../cart.validators.js";

const createCartFixture = (): CartWithRelations => {
  const timestamp = new Date("2025-03-01T10:00:00.000Z");

  return {
    id: "ckcartfixture000000000000001",
    userId: "ckuserfixture0000000000001",
    sessionId: "cksessionfixture00000000001",
    status: "ACTIVE",
    expiresAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    items: [
      {
        id: "ckitemfixture000000000000001",
        cartId: "ckcartfixture000000000000001",
        productVariantId: "ckvariantfixture00000000001",
        quantity: 5,
        unitPrice: new Prisma.Decimal("199.00"),
        createdAt: timestamp,
        updatedAt: timestamp,
        productVariant: {
          id: "ckvariantfixture00000000001",
          title: "Aurora Lamp Variant",
          sku: "SKU-FIXTURE",
          price: new Prisma.Decimal("199.00"),
          compareAtPrice: null,
          stock: 2,
          attributes: null,
          weightGrams: null,
          isPrimary: true,
          createdAt: timestamp,
          updatedAt: timestamp,
          product: {
            id: "ckproductfixture00000000001",
            title: "Aurora Lamp",
            slug: "aurora-lamp",
            price: new Prisma.Decimal("199.00"),
            compareAtPrice: null,
            currency: "TRY",
            status: ProductStatus.ACTIVE,
            inventoryPolicy: InventoryPolicy.TRACK,
          },
        },
      },
    ],
    user: {
      id: "ckuserfixture0000000000001",
      email: "user@example.com",
      firstName: "Test",
      lastName: "User",
    },
  } as unknown as CartWithRelations;
};

interface ServiceOverrides {
  cart?: CartWithRelations;
  repository?: Partial<CartRepository>;
}

const createService = (overrides: ServiceOverrides = {}) => {
  const cart = overrides.cart ?? createCartFixture();
  const repository = {
    findActiveCartByUser: jest.fn(async () => cart),
    create: jest.fn(),
    findById: jest.fn(async () => cart),
    withTransaction: jest.fn(async (callback: (repo: CartRepository, tx: unknown) => unknown) =>
      callback(repository as unknown as CartRepository, {}),
    ),
    ...overrides.repository,
  } as unknown as CartRepository;

  const cacheGetMock = jest.fn(
    async (_scope: CartCacheScope, _key: string) => undefined as CartSummaryView | undefined,
  );
  const cacheSetMock = jest.fn(async () => {});
  const cacheInvalidateMock = jest.fn(async () => {});
  const cacheInvalidateByCartIdMock = jest.fn(async () => {});
  const cacheShutdownMock = jest.fn(async () => {});
  const cache: CartCache = {
    get: cacheGetMock as CartCache["get"],
    set: cacheSetMock as CartCache["set"],
    invalidate: cacheInvalidateMock as CartCache["invalidate"],
    invalidateByCartId: cacheInvalidateByCartIdMock as CartCache["invalidateByCartId"],
    shutdown: cacheShutdownMock as CartCache["shutdown"],
  };

  const emailService = {
    sendCartRecoveryEmail: jest.fn(async () => {}),
  } as unknown as EmailService;

  const service = new CartService({
    repository,
    cache,
    prisma: {} as PrismaClient,
    disableCleanupJob: true,
    now: () => new Date("2025-03-01T10:00:00.000Z"),
    emailService,
  });

  return {
    service,
    repository,
    cache,
    cacheMocks: {
      get: cacheGetMock,
      set: cacheSetMock,
    },
    cart,
  };
};

describe("CartService", () => {
  it("evaluates stock shortages during cart validation", async () => {
    const { service } = createService();

    const report = await service.validateCart({ userId: "user_fixture" });

    expect(report.valid).toBe(false);
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "out_of_stock", variantId: "ckvariantfixture00000000001" }),
      ]),
    );
  });

  it("caches cart responses for subsequent requests", async () => {
    const {
      service,
      cacheMocks: { get: cacheGet, set: cacheSet },
    } = createService();

    const first = await service.getCart({ userId: "user_fixture", sessionId: "session_fixture" });
    expect(first.cart.id).toBe("ckcartfixture000000000000001");
    expect(cacheSet).toHaveBeenCalledTimes(2); // user+session scopes

    cacheGet.mockResolvedValueOnce(first);

    const second = await service.getCart({ userId: "user_fixture", sessionId: "session_fixture" });
    expect(cacheGet).toHaveBeenCalled();
    expect(second).toBe(first);
  });

  it("computes stock warnings when inventory is running low", () => {
    const lowStockCart = createCartFixture();
    const item = lowStockCart.items[0];
    if (!item) {
      throw new Error("Cart item fixture missing");
    }

    const variant = item.productVariant;
    if (!variant) {
      throw new Error("Variant fixture missing");
    }

    variant.stock = 4;
    item.quantity = 3;

    const { service } = createService({ cart: lowStockCart });
    const internals = service as unknown as {
      computeStockStatus: (cart: CartWithRelations) => CartSummaryView["stock"];
    };

    const stock = internals.computeStockStatus(lowStockCart);
    expect(stock.status).toBe("warning");
    expect(stock.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "low_stock",
          availableQuantity: 4,
          requestedQuantity: 3,
        }),
      ]),
    );
  });

  it("flags unavailable variants and returns backorder delivery estimates", () => {
    const variantMissing = createCartFixture();
    const item = variantMissing.items[0];
    if (!item) {
      throw new Error("Cart item fixture missing");
    }
    // eslint-disable-next-line unicorn/no-null -- emulate variant removal
    item.productVariant = null as unknown as typeof item.productVariant;

    const { service } = createService({ cart: variantMissing });
    const internals = service as unknown as {
      computeStockStatus: (cart: CartWithRelations) => CartSummaryView["stock"];
      estimateDelivery: (
        stock: CartSummaryView["stock"],
        cart: CartWithRelations,
      ) => CartSummaryView["delivery"];
    };

    const stock = internals.computeStockStatus(variantMissing);
    expect(stock.status).toBe("error");
    const delivery = internals.estimateDelivery(stock, variantMissing);
    expect(delivery.status).toBe("backorder");
  });

  it("detects price mismatches during cart evaluation", () => {
    const mismatchCart = createCartFixture();
    const item = mismatchCart.items[0];
    if (!item) {
      throw new Error("Cart item fixture missing");
    }

    const variant = item.productVariant;
    if (!variant) {
      throw new Error("Variant fixture missing");
    }
    variant.stock = 10;
    variant.product.status = ProductStatus.ACTIVE;
    item.unitPrice = new Prisma.Decimal("209.00");

    const { service } = createService({ cart: mismatchCart });
    const internals = service as unknown as {
      evaluateCart: (cart: CartWithRelations) => CartValidationReport;
    };

    const report = internals.evaluateCart(mismatchCart);
    expect(report.valid).toBe(true);
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "price_mismatch",
          expectedUnitPrice: { amount: "199.00", currency: "TRY" },
        }),
      ]),
    );
  });
});

const createVariant = (
  overrides: Partial<NonNullable<CartWithRelations["items"][number]["productVariant"]>> = {},
): NonNullable<CartWithRelations["items"][number]["productVariant"]> => {
  const timestamp = new Date("2025-03-01T10:00:00.000Z");
  return {
    id: "variant-base",
    title: "Aurora Variant",
    sku: "SKU-V1",
    price: new Prisma.Decimal("199.00"),
    compareAtPrice: null,
    stock: 10,
    attributes: null,
    weightGrams: null,
    isPrimary: true,
    productId: "product-base",
    createdAt: timestamp,
    updatedAt: timestamp,
    product: {
      id: "product-base",
      title: "Aurora Lamp",
      slug: "aurora-lamp",
      sku: "SKU-P1",
      summary: null,
      description: null,
      price: new Prisma.Decimal("199.00"),
      compareAtPrice: null,
      currency: "TRY",
      status: ProductStatus.ACTIVE,
      inventoryPolicy: InventoryPolicy.TRACK,
      attributes: null,
      searchKeywords: [],
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    },
    ...overrides,
  };
};

const createCartWithItems = ({
  id,
  variant,
  quantity,
  sessionId,
}: {
  id: string;
  variant: NonNullable<CartWithRelations["items"][number]["productVariant"]>;
  quantity: number;
  sessionId?: string | null;
}): CartWithRelations => {
  const timestamp = new Date("2025-03-01T10:00:00.000Z");
  return {
    id,
    userId: "user-fixture",
    sessionId: sessionId ?? null,
    status: "ACTIVE",
    expiresAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    items: [
      {
        id: `${id}-item`,
        cartId: id,
        productVariantId: variant.id,
        quantity,
        unitPrice: variant.price,
        createdAt: timestamp,
        updatedAt: timestamp,
        productVariant: variant,
      },
    ],
    user: {
      id: "user-fixture",
      email: "user@example.com",
      firstName: "Cart",
      lastName: "User",
    },
  } as unknown as CartWithRelations;
};

const createMergeTransaction = (
  variants: NonNullable<CartWithRelations["items"][number]["productVariant"]>[],
) => {
  const variantMap = new Map(variants.map((variant) => [variant.id, variant]));
  return {
    productVariant: {
      findUnique: jest.fn(
        async ({ where: { id } }: { where: { id: string } }) => variantMap.get(id) ?? null,
      ),
    },
    cartItem: {
      update: jest.fn(async () => {}),
      create: jest.fn(async () => {}),
      deleteMany: jest.fn(async () => {}),
    },
    cart: {
      update: jest.fn(async () => {}),
    },
  };
};

describe("CartService.applyMergeCarts", () => {
  it("reconciles existing items when merging with sum strategy", async () => {
    const baseVariant = createVariant({ id: "variant-sum" });
    const guestCart = createCartWithItems({
      id: "guest-cart",
      variant: baseVariant,
      quantity: 3,
    });
    guestCart.items.push({
      id: "guest-item-2",
      cartId: guestCart.id,
      productVariantId: baseVariant.id,
      quantity: 4,
      unitPrice: baseVariant.price,
      createdAt: guestCart.createdAt,
      updatedAt: guestCart.updatedAt,
      productVariant: baseVariant,
    } as unknown as (typeof guestCart.items)[number]);

    const userCart = createCartWithItems({
      id: "user-cart",
      variant: baseVariant,
      quantity: 2,
    });

    const transaction = createMergeTransaction([baseVariant]);
    const { service } = createService();
    const internals = service as unknown as {
      applyMergeCarts: (
        tx: Prisma.TransactionClient,
        guest: CartWithRelations,
        user: CartWithRelations,
        strategy: "sum" | "replace",
      ) => Promise<{ mergedItems: number }>;
    };

    const result = await internals.applyMergeCarts(
      transaction as unknown as Prisma.TransactionClient,
      guestCart,
      userCart,
      "sum",
    );

    const userItem = userCart.items[0];
    if (!userItem) {
      throw new Error("User cart item missing");
    }

    expect(transaction.cartItem.update).toHaveBeenCalledWith({
      where: { id: userItem.id },
      data: expect.objectContaining({
        quantity: { set: Math.min(2 + 3 + 4, CART_ITEM_MAX_QUANTITY) },
      }),
    });
    expect(transaction.cart.update).toHaveBeenCalledWith({
      where: { id: guestCart.id },
      data: expect.objectContaining({ status: "ABANDONED" }),
    });
    expect(transaction.cartItem.deleteMany).toHaveBeenCalledWith({
      where: { cartId: guestCart.id },
    });
    expect(result.mergedItems).toBe(2);
  });

  it("creates new cart items when merging distinct variants", async () => {
    const userVariant = createVariant({ id: "variant-existing" });
    const guestVariant = createVariant({ id: "variant-new" });

    const userCart = createCartWithItems({
      id: "user-cart",
      variant: userVariant,
      quantity: 1,
    });
    const guestCart = createCartWithItems({
      id: "guest-cart",
      variant: guestVariant,
      quantity: 2,
    });

    const txDistinct = createMergeTransaction([userVariant, guestVariant]);
    const { service } = createService();
    const internals = service as unknown as {
      applyMergeCarts: (
        tx: Prisma.TransactionClient,
        guest: CartWithRelations,
        user: CartWithRelations,
        strategy: "sum" | "replace",
      ) => Promise<{ mergedItems: number }>;
    };

    const result = await internals.applyMergeCarts(
      txDistinct as unknown as Prisma.TransactionClient,
      guestCart,
      userCart,
      "sum",
    );

    expect(txDistinct.cartItem.create).toHaveBeenCalledWith({
      data: {
        cartId: userCart.id,
        productVariantId: guestVariant.id,
        quantity: 2,
        unitPrice: guestVariant.price,
      },
    });
    expect(result.mergedItems).toBe(1);
  });

  it("replaces quantities when using replace strategy", async () => {
    const variant = createVariant({ id: "variant-replace" });
    const userCart = createCartWithItems({
      id: "user-cart",
      variant,
      quantity: 9,
    });
    const guestCart = createCartWithItems({
      id: "guest-cart",
      variant,
      quantity: 4,
    });

    const txReplace = createMergeTransaction([variant]);
    const { service } = createService();
    const internals = service as unknown as {
      applyMergeCarts: (
        tx: Prisma.TransactionClient,
        guest: CartWithRelations,
        user: CartWithRelations,
        strategy: "sum" | "replace",
      ) => Promise<{ mergedItems: number }>;
    };

    await internals.applyMergeCarts(
      txReplace as unknown as Prisma.TransactionClient,
      guestCart,
      userCart,
      "replace",
    );

    const userItem = userCart.items[0];
    if (!userItem) {
      throw new Error("User cart item missing");
    }

    expect(txReplace.cartItem.update).toHaveBeenCalledWith({
      where: { id: userItem.id },
      data: expect.objectContaining({
        quantity: { set: 4 },
        unitPrice: variant.price,
      }),
    });
  });
});
