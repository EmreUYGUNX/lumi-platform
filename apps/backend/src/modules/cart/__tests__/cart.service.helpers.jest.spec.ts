import { describe, expect, it, jest } from "@jest/globals";
import { InventoryPolicy, Prisma, ProductStatus } from "@prisma/client";

import type { EmailService } from "@/lib/email/email.service.js";

import { createCartCache } from "../cart.cache.js";
import type { CartRepository } from "../cart.repository.js";
import { CartService } from "../cart.service.js";
import type { CartDeliveryEstimate, CartStockIssue, CartStockStatus } from "../cart.types.js";

interface TestProduct {
  id: string;
  title: string;
  slug: string;
  sku?: string;
  price: Prisma.Decimal;
  compareAtPrice?: Prisma.Decimal;
  currency: string;
  status: ProductStatus;
  inventoryPolicy: InventoryPolicy;
  attributes?: Prisma.JsonValue;
  searchKeywords: string[];
  summary?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

interface TestVariant {
  id: string;
  title: string;
  sku: string;
  price: Prisma.Decimal;
  compareAtPrice?: Prisma.Decimal;
  stock: number;
  attributes?: Prisma.JsonValue;
  weightGrams?: number;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
  product?: TestProduct;
}

interface TestCartItem {
  id: string;
  cartId: string;
  productVariantId: string;
  quantity: number;
  unitPrice: Prisma.Decimal;
  createdAt: Date;
  updatedAt: Date;
  productVariant?: TestVariant;
}

interface TestCart {
  id: string;
  userId?: string;
  sessionId?: string;
  status: "ACTIVE";
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  items: TestCartItem[];
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
}

const FIXED_NOW = new Date("2024-01-01T00:00:00.000Z");

interface CartServiceHelperAccess {
  computeStockStatus(cart: TestCart): CartStockStatus;
  estimateDelivery(stock: CartStockStatus, cart: TestCart): CartDeliveryEstimate;
}

const createCartService = () => {
  const emailService = {
    sendCartRecoveryEmail: jest.fn(),
  } as unknown as EmailService;

  const instance = new CartService({
    repository: {} as CartRepository,
    cache: createCartCache(),
    emailService,
    disableCleanupJob: true,
    now: () => new Date(FIXED_NOW),
  });

  return instance as unknown as CartServiceHelperAccess;
};

const createProduct = (overrides: Partial<TestProduct> = {}): TestProduct => ({
  id: "product-default",
  title: "Aurora Lamp",
  slug: "aurora-lamp",
  sku: "PROD-1",
  price: new Prisma.Decimal("199.00"),
  compareAtPrice: undefined,
  currency: "TRY",
  status: ProductStatus.ACTIVE,
  inventoryPolicy: InventoryPolicy.CONTINUE,
  attributes: undefined,
  searchKeywords: [],
  summary: undefined,
  description: undefined,
  createdAt: FIXED_NOW,
  updatedAt: FIXED_NOW,
  deletedAt: undefined,
  ...overrides,
});

const createVariant = (overrides: Partial<TestVariant> = {}): TestVariant => ({
  id: "variant-default",
  title: "Default Variant",
  sku: "VAR-1",
  price: new Prisma.Decimal("199.00"),
  compareAtPrice: undefined,
  stock: 5,
  attributes: undefined,
  weightGrams: undefined,
  isPrimary: true,
  createdAt: FIXED_NOW,
  updatedAt: FIXED_NOW,
  product: createProduct(),
  ...overrides,
});

const createCart = (overrides: Partial<TestCart> = {}): TestCart => ({
  id: "cart-1",
  userId: "user-1",
  sessionId: "session-1",
  status: "ACTIVE",
  expiresAt: undefined,
  createdAt: FIXED_NOW,
  updatedAt: FIXED_NOW,
  items: [],
  user: undefined,
  ...overrides,
});

describe("CartService helper operations", () => {
  it("evaluates stock issues across multiple scenarios", () => {
    const service = createCartService();

    const cart = createCart({
      items: [
        {
          id: "missing-variant",
          cartId: "cart-1",
          productVariantId: "variant-x",
          quantity: 1,
          unitPrice: new Prisma.Decimal("10"),
          createdAt: FIXED_NOW,
          updatedAt: FIXED_NOW,
          productVariant: undefined,
        },
        {
          id: "inactive-product",
          cartId: "cart-1",
          productVariantId: "variant-y",
          quantity: 1,
          unitPrice: new Prisma.Decimal("10"),
          createdAt: FIXED_NOW,
          updatedAt: FIXED_NOW,
          productVariant: createVariant({
            id: "variant-y",
            product: createProduct({ id: "product-y", status: ProductStatus.ARCHIVED }),
          }),
        },
        {
          id: "out-of-stock",
          cartId: "cart-1",
          productVariantId: "variant-z",
          quantity: 3,
          unitPrice: new Prisma.Decimal("10"),
          createdAt: FIXED_NOW,
          updatedAt: FIXED_NOW,
          productVariant: createVariant({
            id: "variant-z",
            stock: 1,
            product: createProduct({ id: "product-z" }),
          }),
        },
        {
          id: "low-stock",
          cartId: "cart-1",
          productVariantId: "variant-low",
          quantity: 4,
          unitPrice: new Prisma.Decimal("10"),
          createdAt: FIXED_NOW,
          updatedAt: FIXED_NOW,
          productVariant: createVariant({
            id: "variant-low",
            stock: 5,
            product: createProduct({ id: "product-low" }),
          }),
        },
      ],
    });

    const stock = service.computeStockStatus(cart);
    const issueTypes = stock.issues.map((issue: CartStockIssue) => issue.type);

    expect(stock.status).toBe("error");
    expect(issueTypes).toEqual([
      "variant_unavailable",
      "variant_unavailable",
      "out_of_stock",
      "low_stock",
    ]);
    stock.issues.forEach((issue: CartStockIssue) => {
      expect(issue).toHaveProperty("itemId");
      expect(issue.message).toBeDefined();
    });
    expect(stock.checkedAt).toBe(FIXED_NOW.toISOString());
  });

  it("derives delivery estimates based on stock health", () => {
    const service = createCartService();
    const cart = createCart();

    const states: {
      status: CartStockStatus["status"];
      expected: CartDeliveryEstimate["status"];
    }[] = [
      { status: "error", expected: "backorder" },
      { status: "warning", expected: "delayed" },
      { status: "ok", expected: "standard" },
    ];

    states.forEach(({ status, expected }) => {
      const estimate = service.estimateDelivery(
        {
          status,
          issues: [],
          checkedAt: FIXED_NOW.toISOString(),
        },
        cart,
      );
      expect(estimate.status).toBe(expected);
      expect(estimate.message).toMatch(/delivery/i);
      if (estimate.estimatedDeliveryDate) {
        expect(new Date(estimate.estimatedDeliveryDate).getTime()).toBeGreaterThan(
          FIXED_NOW.getTime(),
        );
      }
    });
  });
});
