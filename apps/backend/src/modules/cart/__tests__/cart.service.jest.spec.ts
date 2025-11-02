/* eslint-disable unicorn/no-null */
import { describe, expect, it, jest } from "@jest/globals";
import { InventoryPolicy, Prisma, ProductStatus } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

import type { EmailService } from "@/lib/email/email.service.js";

import type { CartCache, CartCacheScope } from "../cart.cache.js";
import type { CartRepository, CartWithRelations } from "../cart.repository.js";
import { CartService } from "../cart.service.js";
import type { CartSummaryView, CartValidationReport } from "../cart.types.js";

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
