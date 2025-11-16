/* eslint-disable unicorn/no-null */
import { describe, expect, it, jest } from "@jest/globals";
import type { Request, RequestHandler, Response } from "express";
import request from "supertest";
import type { Response as SupertestResponse } from "supertest";

import type * as ErrorsModule from "@/lib/errors.js";
import { successResponse } from "@/lib/response.js";
import type * as RateLimiterModule from "@/middleware/rateLimiter.js";
import type { AuthController } from "@/modules/auth/auth.controller.js";
import type { AuthenticatedUser } from "@/modules/auth/token.types.js";
import type { CartContext, CartService } from "@/modules/cart/cart.service.js";
import type { AddCartItemInput } from "@/modules/cart/cart.validators.js";
import type { CatalogService } from "@/modules/catalog/catalog.service.js";
import type { OrderService } from "@/modules/order/order.service.js";
import { withTestApp } from "@/testing/index.js";

type NextHandler = Parameters<RequestHandler>[2];

const averageIds = {
  user: "cjld2cjxh0000qzrmn831i7rn",
  session: "cjld2cjxh0001qzrmn831i7rn",
  product: "cjld2cjxh0002qzrmn831i7rn",
  variant: "cjld2cjxh0003qzrmn831i7rn",
  cart: "cjld2cjxh0004qzrmn831i7rn",
  cartItem: "cjld2cjxh0005qzrmn831i7rn",
  reservation: "cjld2cjxh0006qzrmn831i7rn",
  order: "cjld2cjxh0007qzrmn831i7rn",
  payment: "cjld2cjxh0008qzrmn831i7rn",
} as const;

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

jest.mock("@/middleware/rateLimiter.js", () => {
  const actual = jest.requireActual<typeof RateLimiterModule>("@/middleware/rateLimiter.js");
  return {
    ...actual,
    createScopedRateLimiter: () => ({
      middleware: ((_req, _res, next) => next()) as RequestHandler,
    }),
  };
});

const sendNotImplemented = (_req: Request, res: Response, next: NextHandler) => {
  next();
  return res;
};

const encodeUserHeader = () =>
  JSON.stringify({
    id: averageIds.user,
    email: "user@example.com",
    sessionId: averageIds.session,
    permissions: [],
    token: null,
    roles: [{ id: "role_customer", name: "customer" }],
  });

const createAuthControllerStub = (): AuthController => {
  return {
    register: jest.fn((_req: Request, res: Response) =>
      res.status(201).json(successResponse({ id: "user" })),
    ),
    login: jest.fn((_req: Request, res: Response) =>
      res.json(successResponse({ accessToken: "token", refreshToken: "refresh" })),
    ),
    refresh: jest.fn((_req: Request, res: Response) =>
      res.json(successResponse({ accessToken: "token" })),
    ),
    logout: jest.fn((_req: Request, res: Response) => res.status(204).end()),
    logoutAll: jest.fn((_req: Request, res: Response) => res.status(204).end()),
    me: jest.fn((_req: Request, res: Response) =>
      res.json(successResponse({ id: averageIds.user })),
    ),
    verifyEmail: jest.fn((_req: Request, res: Response) => res.status(204).end()),
    resendVerification: jest.fn((_req: Request, res: Response) => res.status(204).end()),
    forgotPassword: jest.fn((_req: Request, res: Response) =>
      res.status(202).json(successResponse({ sent: true })),
    ),
    resetPassword: jest.fn((_req: Request, res: Response) => res.status(204).end()),
    changePassword: jest.fn((_req: Request, res: Response) => res.status(204).end()),
    setupTwoFactor: jest.fn(sendNotImplemented),
    verifyTwoFactor: jest.fn(sendNotImplemented),
  } as unknown as AuthController;
};

const createCatalogScenarioService = () => {
  const listPublicProducts = jest.fn<
    () => Promise<Awaited<ReturnType<CatalogService["listPublicProducts"]>>>
  >(async () => ({
    items: [
      {
        id: averageIds.product,
        title: "Aurora Lamp",
        slug: "aurora-lamp",
        sku: "SKU-PROD-AVERAGE",
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
            id: averageIds.variant,
            title: "Default",
            sku: "VAR-1",
            price: { amount: "199.00", currency: "TRY" },
            compareAtPrice: undefined,
            stock: 8,
            attributes: null,
            weightGrams: 2500,
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
      },
    ],
    meta: {
      page: 1,
      pageSize: 24,
      totalItems: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    },
  }));

  return {
    listPublicProducts,
    listPopularProducts: jest.fn(),
    getProductDetail: jest.fn(),
  } as unknown as CatalogService;
};

const createScenarioCartService = () => {
  const view = {
    cart: {
      id: averageIds.cart,
      userId: averageIds.user,
      sessionId: averageIds.session,
      status: "ACTIVE",
      expiresAt: null,
      items: [
        {
          id: averageIds.cartItem,
          cartId: averageIds.cart,
          productVariantId: averageIds.variant,
          quantity: 1,
          unitPrice: { amount: "199.00", currency: "TRY" },
          product: {
            id: averageIds.product,
            title: "Aurora Lamp",
            slug: "aurora-lamp",
            sku: "SKU-PROD-AVERAGE",
            status: "ACTIVE",
            inventoryPolicy: "TRACK",
            price: { amount: "199.00", currency: "TRY" },
            currency: "TRY",
          },
          variant: {
            id: averageIds.variant,
            title: "Default",
            sku: "VAR-1",
            price: { amount: "199.00", currency: "TRY" },
            compareAtPrice: undefined,
            stock: 8,
            attributes: null,
            weightGrams: 2500,
            isPrimary: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          availableStock: 8,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      totals: {
        subtotal: { amount: "199.00", currency: "TRY" },
        tax: { amount: "0.00", currency: "TRY" },
        discount: { amount: "0.00", currency: "TRY" },
        total: { amount: "199.00", currency: "TRY" },
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    stock: {
      status: "ok" as const,
      issues: [],
      checkedAt: new Date().toISOString(),
    },
    delivery: {
      status: "standard" as const,
      minHours: 24,
      maxHours: 72,
      estimatedDeliveryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      message: "Standard delivery",
    },
  };

  const updateTotals = () => {
    const quantity = view.cart.items[0]?.quantity ?? 0;
    const total = (199 * quantity).toFixed(2);
    view.cart.totals.total.amount = total;
    view.cart.totals.subtotal.amount = total;
  };

  const cartService = {
    getCart: jest.fn(async () => view),
    addItem: jest.fn(async (_ctx: CartContext, input: AddCartItemInput) => {
      const item = view.cart.items[0];
      if (item) {
        item.quantity += input.quantity;
      }
      updateTotals();
      return view;
    }),
    updateItem: jest.fn(async () => view),
    removeItem: jest.fn(async () => view),
    clearCart: jest.fn(async () => view),
    mergeCart: jest.fn(async () => view),
    validateCart: jest.fn(async (_ctx, options?: { reserveInventory?: boolean }) => ({
      cartId: view.cart.id,
      valid: true,
      issues: [],
      stock: view.stock,
      totals: view.cart.totals,
      checkedAt: new Date().toISOString(),
      reservation: options?.reserveInventory
        ? {
            id: averageIds.reservation,
            cartId: view.cart.id,
            status: "active",
            expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
            itemCount: view.cart.items.length,
          }
        : undefined,
    })),
  } as unknown as CartService;

  return { cartService, view };
};

const createScenarioOrderService = () =>
  ({
    createOrder: jest.fn(async () => ({
      order: {
        id: averageIds.order,
        reference: "LM-AVERAGE-1",
        status: "PENDING",
        totalAmount: { amount: "199.00", currency: "TRY" },
        items: [],
      },
      payment: {
        id: averageIds.payment,
        provider: "MANUAL",
        status: "initiated",
      },
    })),
  }) as unknown as OrderService;

const expectQ2Response = (
  response: SupertestResponse,
  options: { expectPagination?: boolean; requireMeta?: boolean } = {},
) => {
  const requireMeta = options.requireMeta ?? false;
  const baseExpectation: Record<string, unknown> = {
    success: true,
    data: expect.anything(),
  };

  if (requireMeta) {
    baseExpectation.meta = expect.any(Object);
  }

  expect(response.body).toMatchObject(baseExpectation);

  const { meta } = response.body;

  if (requireMeta || meta) {
    expect(meta).toEqual(expect.any(Object));
    if (meta?.timestamp) {
      expect(typeof meta.timestamp).toBe("string");
    }
    if (meta?.requestId) {
      expect(meta.requestId).toEqual(expect.stringMatching(/^[\da-f-]{36}$/i));
    }
  }

  if ((requireMeta || meta) && options.expectPagination) {
    expect(meta).toHaveProperty("pagination");
  }
};

describe("Average user journey", () => {
  it("completes login, browse, add to cart, and checkout within targets", async () => {
    const authController = createAuthControllerStub();
    const catalogService = createCatalogScenarioService();
    const { cartService, view } = createScenarioCartService();
    const orderService = createScenarioOrderService();
    const userHeader = encodeUserHeader();

    await withTestApp(
      async ({ app }) => {
        const loginStart = Date.now();
        const loginResponse = await request(app)
          .post("/api/v1/auth/login")
          .send({ email: "user@example.com", password: "Secret123!" });
        expect(loginResponse).toHaveProperty("body.success", true);
        const LOGIN_TIME_BUDGET_MS = 300;
        expect(Date.now() - loginStart).toBeLessThan(LOGIN_TIME_BUDGET_MS);
        expectQ2Response(loginResponse, { requireMeta: false });

        const browseStart = Date.now();
        const browseResponse = await request(app).get("/api/v1/products").expect(200);
        expect(Date.now() - browseStart).toBeLessThan(250);
        expect(browseResponse.body.data[0].slug).toBe("aurora-lamp");
        expectQ2Response(browseResponse, { expectPagination: true, requireMeta: true });

        const cartStart = Date.now();
        const variantId = view.cart.items[0]?.productVariantId ?? averageIds.variant;
        const addResponse = await request(app)
          .post("/api/cart/items")
          .set("x-auth-user", userHeader)
          .send({ productVariantId: variantId, quantity: 1 })
          .expect(201);
        expect(Date.now() - cartStart).toBeLessThan(250);
        expect(addResponse.body.data.cart.items[0].quantity).toBe(2);
        expectQ2Response(addResponse);

        const checkoutStart = Date.now();
        const orderResponse = await request(app)
          .post("/api/orders")
          .set("x-auth-user", userHeader)
          .send({ cartId: view.cart.id })
          .expect(201);
        expect(Date.now() - checkoutStart).toBeLessThan(250);
        expect(orderResponse.body.data.payment.status).toBe("initiated");
        expectQ2Response(orderResponse);

        expect(cartService.addItem).toHaveBeenCalled();
        expect(orderService.createOrder).toHaveBeenCalledWith(
          expect.objectContaining({ userId: averageIds.user }),
          expect.objectContaining({ cartId: view.cart.id }),
        );
      },
      {
        apiOptions: {
          authOptions: { controller: authController },
          catalogOptions: { service: catalogService },
          cartOptions: { service: cartService },
          orderOptions: { service: orderService },
        },
      },
    );
  });
});
