/* eslint-disable unicorn/no-null */
import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeAll, describe, expect, it, jest } from "@jest/globals";
import type { Request, RequestHandler } from "express";
import jestOpenAPI from "jest-openapi";
import request from "supertest";
import type { Response as SupertestResponse } from "supertest";
import { parse as parseYaml } from "yaml";

import type * as ErrorsModule from "@/lib/errors.js";
import { NotFoundError } from "@/lib/errors.js";
import type { AuthenticatedUser } from "@/modules/auth/token.types.js";
import type { CartService } from "@/modules/cart/cart.service.js";
import type { CartSummaryView } from "@/modules/cart/cart.types.js";
import type { CatalogService } from "@/modules/catalog/catalog.service.js";
import type { OrderService } from "@/modules/order/order.service.js";
import { withTestApp } from "@/testing/index.js";

const SPEC_PATH = path.resolve(
  __dirname,
  "../../../../../packages/shared/src/api-schemas/openapi.yaml",
);

let openApiDocument: unknown;

beforeAll(() => {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- SPEC_PATH is a static OpenAPI file within the repo
  const rawSpec = readFileSync(SPEC_PATH, "utf8");
  openApiDocument = parseYaml(rawSpec);
  // @ts-expect-error jest-openapi accepts generic OpenAPI document objects
  jestOpenAPI(openApiDocument);
});

type NextHandler = Parameters<RequestHandler>[2];

const parseUserHeader = (req: Request): AuthenticatedUser | undefined => {
  const header = req.get("x-auth-user");
  if (!header) {
    return undefined;
  }

  try {
    return JSON.parse(header) as AuthenticatedUser;
  } catch {
    return undefined;
  }
};

jest.mock("@/middleware/auth/requireAuth.js", () => {
  const { UnauthorizedError } = jest.requireActual<typeof ErrorsModule>("@/lib/errors.js");

  const requireAuthMiddleware = (req: Request, _res: Request, next: NextHandler) => {
    const user = parseUserHeader(req);
    if (!user) {
      next(new UnauthorizedError("Authentication required."));
      return;
    }

    req.user = user;
    next();
  };

  return {
    createRequireAuthMiddleware: () => requireAuthMiddleware,
  };
});

jest.mock("@/middleware/auth/requireRole.js", () => ({
  createRequireRoleMiddleware: () => ((_req, _res, next) => next()) as RequestHandler,
}));

jest.mock("@/middleware/rateLimiter.js", () => ({
  createScopedRateLimiter: () => ({
    middleware: ((_req, _res, next) => next()) as RequestHandler,
  }),
}));

const contractUser: AuthenticatedUser = {
  id: "cjld2cjxh0020qzrmn831i7rn",
  email: "contract-user@example.com",
  sessionId: "cjld2cjxh0021qzrmn831i7rn",
  permissions: [],
  roles: [{ id: "role_customer", name: "customer" }],
  token: {
    sub: "cjld2cjxh0020qzrmn831i7rn",
    email: "contract-user@example.com",
    roleIds: ["role_customer"],
    permissions: [],
    sessionId: "cjld2cjxh0021qzrmn831i7rn",
    jti: "contract-user-session",
    iat: 0,
    exp: 0,
  },
};

const contractUserHeader = JSON.stringify(contractUser);

const contractIds = {
  cart: "cjld2cjxh0022qzrmn831i7rn",
  cartItem: "cjld2cjxh0023qzrmn831i7rn",
  order: "cjld2cjxh0024qzrmn831i7rn",
  product: "cjld2cjxh0025qzrmn831i7rn",
  variant: "cjld2cjxh0026qzrmn831i7rn",
  payment: "cjld2cjxh0027qzrmn831i7rn",
  address: "cjld2cjxh0028qzrmn831i7rn",
} as const;

const createCartContractService = (): jest.Mocked<CartService> => {
  const timestamp = new Date("2025-02-01T10:00:00.000Z").toISOString();
  const cartView: CartSummaryView = {
    cart: {
      id: contractIds.cart,
      userId: contractUser.id,
      sessionId: contractUser.sessionId,
      status: "ACTIVE",
      expiresAt: null,
      items: [
        {
          id: contractIds.cartItem,
          cartId: contractIds.cart,
          productVariantId: contractIds.variant,
          quantity: 1,
          unitPrice: { amount: "199.00", currency: "TRY" },
          product: {
            id: contractIds.product,
            title: "Aurora Lamp",
            slug: "aurora-lamp",
            status: "ACTIVE",
            inventoryPolicy: "TRACK",
            price: { amount: "199.00", currency: "TRY" },
            currency: "TRY",
          },
          variant: {
            id: contractIds.variant,
            title: "Default",
            sku: "VAR-1",
            price: { amount: "199.00", currency: "TRY" },
            compareAtPrice: undefined,
            stock: 6,
            attributes: null,
            weightGrams: 2500,
            isPrimary: true,
            createdAt: timestamp,
            updatedAt: timestamp,
          },
          availableStock: 6,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
      totals: {
        subtotal: { amount: "199.00", currency: "TRY" },
        tax: { amount: "0.00", currency: "TRY" },
        discount: { amount: "0.00", currency: "TRY" },
        total: { amount: "199.00", currency: "TRY" },
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    stock: {
      status: "ok",
      issues: [],
      checkedAt: timestamp,
    },
    delivery: {
      status: "standard",
      minHours: 24,
      maxHours: 72,
      estimatedDeliveryDate: new Date("2025-02-04T10:00:00.000Z").toISOString(),
      message: "Standard delivery",
    },
  };

  return {
    getCart: jest.fn(async () => cartView),
    addItem: jest.fn(async () => cartView),
    updateItem: jest.fn(async () => cartView),
    removeItem: jest.fn(async () => cartView),
    clearCart: jest.fn(async () => cartView),
    mergeCart: jest.fn(async () => cartView),
    validateCart: jest.fn(async () => ({
      cartId: contractIds.cart,
      valid: true,
      issues: [],
      stock: cartView.stock,
      totals: cartView.cart.totals,
      checkedAt: timestamp,
    })),
  } as unknown as jest.Mocked<CartService>;
};

const createOrderContractService = (): jest.Mocked<OrderService> => {
  const now = new Date("2025-02-01T10:15:00.000Z").toISOString();
  const address = {
    id: contractIds.address,
    label: "Home",
    fullName: "Ada Lovelace",
    phone: "+90 555 000 0000",
    line1: "10 Downing St",
    line2: null,
    city: "London",
    state: null,
    postalCode: "SW1A 2AA",
    country: "GB",
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  };

  const orderDetail = {
    id: contractIds.order,
    reference: "LM-CONTRACT-1",
    status: "PENDING",
    totalAmount: { amount: "199.00", currency: "TRY" },
    subtotalAmount: { amount: "199.00", currency: "TRY" },
    taxAmount: { amount: "0.00", currency: "TRY" },
    discountAmount: { amount: "0.00", currency: "TRY" },
    currency: "TRY",
    items: [
      {
        id: "cjld2cjxh0029qzrmn831i7rn",
        orderId: contractIds.order,
        productId: contractIds.product,
        productVariantId: contractIds.variant,
        quantity: 1,
        unitPrice: { amount: "199.00", currency: "TRY" },
        titleSnapshot: "Aurora Lamp",
        createdAt: now,
        updatedAt: now,
      },
    ],
    itemsCount: 1,
    shippingAddressId: address.id,
    billingAddressId: address.id,
    createdAt: now,
    updatedAt: now,
    shippingAddress: address,
    billingAddress: address,
    payments: [
      {
        id: contractIds.payment,
        provider: "MANUAL",
        status: "INITIATED",
        amount: { amount: "199.00", currency: "TRY" },
        currency: "TRY",
        transactionId: "txn_contract_1",
        createdAt: now,
        updatedAt: now,
      },
    ],
    timeline: [
      {
        status: "PENDING",
        timestamp: now,
      },
    ],
    tracking: {
      trackingNumber: null,
      trackingUrl: null,
      carrier: null,
      estimatedDelivery: null,
    },
  };

  return {
    createOrder: jest.fn(async () => ({
      order: orderDetail,
      payment: orderDetail.payments[0],
    })),
  } as unknown as jest.Mocked<OrderService>;
};

const expectQ2Success = (response: SupertestResponse) => {
  expect(response.body).toMatchObject({
    success: true,
    data: expect.anything(),
    meta: expect.objectContaining({
      timestamp: expect.any(String),
      requestId: expect.any(String),
    }),
  });
};

const expectQ2Error = (response: SupertestResponse) => {
  expect(response.body).toMatchObject({
    success: false,
    error: expect.objectContaining({
      code: expect.any(String),
      message: expect.any(String),
    }),
    meta: expect.objectContaining({
      timestamp: expect.any(String),
      requestId: expect.any(String),
    }),
  });
};

const createCatalogContractService = () => {
  const product = {
    id: "prod_contract",
    title: "Aurora Lamp",
    slug: "aurora-lamp",
    sku: null,
    summary: "Ambient lighting",
    description: null,
    status: "ACTIVE",
    price: { amount: "199.00", currency: "TRY" },
    currency: "TRY",
    inventoryPolicy: "TRACK",
    searchKeywords: ["lamp"],
    attributes: null,
    variants: [
      {
        id: "variant_contract",
        title: "Default",
        sku: "VAR-1",
        price: { amount: "199.00", currency: "TRY" },
        compareAtPrice: undefined,
        stock: 12,
        attributes: null,
        weightGrams: 2000,
        isPrimary: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    categories: [],
    media: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
  };

  const catalogService: Partial<CatalogService> = {};

  catalogService.listPublicProducts = jest.fn(async () => ({
    items: [product],
    meta: {
      page: 1,
      pageSize: 24,
      totalItems: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    },
  })) as CatalogService["listPublicProducts"];

  catalogService.listPopularProducts = jest.fn(async () => [
    product,
  ]) as CatalogService["listPopularProducts"];

  catalogService.getProductDetail = jest.fn(async () => ({
    product,
    reviewSummary: { totalReviews: 0, averageRating: 0, ratingBreakdown: {} },
  })) as CatalogService["getProductDetail"];

  catalogService.listProductVariants = jest.fn() as CatalogService["listProductVariants"];
  catalogService.createProduct = jest.fn() as CatalogService["createProduct"];
  catalogService.updateProduct = jest.fn() as CatalogService["updateProduct"];
  catalogService.archiveProduct = jest.fn() as CatalogService["archiveProduct"];
  catalogService.addVariant = jest.fn() as CatalogService["addVariant"];
  catalogService.updateVariant = jest.fn() as CatalogService["updateVariant"];
  catalogService.deleteVariant = jest.fn() as CatalogService["deleteVariant"];
  catalogService.listCategories = jest.fn(async () => []) as CatalogService["listCategories"];
  catalogService.getCategoryDetail = jest.fn() as CatalogService["getCategoryDetail"];
  catalogService.createCategory = jest.fn() as CatalogService["createCategory"];
  catalogService.updateCategory = jest.fn() as CatalogService["updateCategory"];
  catalogService.deleteCategory = jest.fn() as CatalogService["deleteCategory"];

  return catalogService as CatalogService;
};

describe("API contract", () => {
  it("matches the health endpoint spec", async () => {
    await withTestApp(async ({ app }) => {
      const response = await request(app).get("/api/v1/health");

      // @ts-expect-error matcher provided by jest-openapi
      expect(response).toSatisfyApiSpec();
    });
  });

  it("matches the product listing schema with pagination metadata", async () => {
    const catalogService = createCatalogContractService();

    await withTestApp(
      async ({ app }) => {
        const response = await request(app).get("/api/v1/products").expect(200);

        // @ts-expect-error matcher provided by jest-openapi
        expect(response).toSatisfyApiSpec();
        expect(catalogService.listPublicProducts).toHaveBeenCalled();
      },
      {
        apiOptions: {
          catalogOptions: { service: catalogService },
        },
      },
    );
  });

  it("returns documented 404 payloads for unknown products", async () => {
    const catalogService = createCatalogContractService();
    catalogService.getProductDetail = (async () => {
      throw new NotFoundError("Product not found.");
    }) as CatalogService["getProductDetail"];

    await withTestApp(
      async ({ app }) => {
        const response = await request(app).get("/api/v1/products/missing-product").expect(404);

        // @ts-expect-error matcher provided by jest-openapi
        expect(response).toSatisfyApiSpec();
      },
      {
        apiOptions: {
          catalogOptions: { service: catalogService },
        },
      },
    );
  });

  it("matches the cart item creation schema and Q2 contract", async () => {
    const cartService = createCartContractService();

    await withTestApp(
      async ({ app }) => {
        const response = await request(app)
          .post("/api/cart/items")
          .set("x-auth-user", contractUserHeader)
          .send({ productVariantId: contractIds.variant, quantity: 1 })
          .expect(201);

        expectQ2Success(response);
        // @ts-expect-error matcher provided by jest-openapi
        expect(response).toSatisfyApiSpec();
        expect(cartService.addItem).toHaveBeenCalled();
      },
      {
        apiOptions: {
          cartOptions: { service: cartService },
        },
      },
    );
  });

  it("rejects invalid cart payloads with validation errors", async () => {
    const cartService = createCartContractService();

    await withTestApp(
      async ({ app }) => {
        const response = await request(app)
          .post("/api/cart/items")
          .set("x-auth-user", contractUserHeader)
          .send({})
          .expect(422);

        expectQ2Error(response);
        expect(response.body.error.code).toBe("VALIDATION_ERROR");
      },
      {
        apiOptions: {
          cartOptions: { service: cartService },
        },
      },
    );
  });

  it("matches the order creation schema defined in OpenAPI", async () => {
    const catalogService = createCatalogContractService();
    const orderService = createOrderContractService();

    await withTestApp(
      async ({ app }) => {
        const response = await request(app)
          .post("/api/orders")
          .set("x-auth-user", contractUserHeader)
          .send({
            cartId: contractIds.cart,
            shippingAddressId: contractIds.address,
          })
          .expect(201);

        expectQ2Success(response);
        // @ts-expect-error matcher provided by jest-openapi
        expect(response).toSatisfyApiSpec();
        expect(orderService.createOrder).toHaveBeenCalled();
      },
      {
        apiOptions: {
          catalogOptions: { service: catalogService },
          orderOptions: { service: orderService },
        },
      },
    );
  });
});
