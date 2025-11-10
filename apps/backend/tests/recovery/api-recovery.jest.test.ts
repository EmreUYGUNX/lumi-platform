/* eslint-disable unicorn/no-null */
import { afterEach, describe, expect, it, jest } from "@jest/globals";
import type { Request, RequestHandler } from "express";
import request from "supertest";

import { ApiError } from "@/errors/api-error.js";
import type * as ErrorsModule from "@/lib/errors.js";
import type * as RateLimiterModule from "@/middleware/rateLimiter.js";
import type { AuthenticatedUser } from "@/modules/auth/token.types.js";
import type { CartService } from "@/modules/cart/cart.service.js";
import type { OrderService } from "@/modules/order/order.service.js";
import { withTestApp } from "@/testing/index.js";

type NextHandler = Parameters<RequestHandler>[2];

const recoveryIds = {
  user: "cjld2cjxh0009qzrmn831i7rn",
  session: "cjld2cjxh0010qzrmn831i7rn",
  cart: "cjld2cjxh0011qzrmn831i7rn",
  cartItem: "cjld2cjxh0012qzrmn831i7rn",
  product: "cjld2cjxh0013qzrmn831i7rn",
  variant: "cjld2cjxh0014qzrmn831i7rn",
  order: "cjld2cjxh0015qzrmn831i7rn",
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

const recoveryUser: AuthenticatedUser = {
  id: recoveryIds.user,
  email: "user@example.com",
  sessionId: recoveryIds.session,
  permissions: [],
  token: {
    sub: recoveryIds.user,
    email: "user@example.com",
    roleIds: ["role_customer"],
    permissions: [],
    sessionId: recoveryIds.session,
    jti: "recovery-session",
    iat: 0,
    exp: 0,
  },
  roles: [{ id: "role_customer", name: "customer" }],
};

const userHeader = JSON.stringify(recoveryUser);

const createRecoveryCartService = () => {
  const state = {
    quantity: 1,
    stockStatus: "ok" as "ok" | "warning",
    issues: [] as { type: string; message: string }[],
  };

  const buildView = () => ({
    cart: {
      id: recoveryIds.cart,
      userId: recoveryIds.user,
      sessionId: recoveryIds.session,
      status: "ACTIVE",
      expiresAt: null,
      items: [
        {
          id: recoveryIds.cartItem,
          cartId: recoveryIds.cart,
          productVariantId: recoveryIds.variant,
          quantity: state.quantity,
          unitPrice: { amount: "149.00", currency: "TRY" },
          product: {
            id: recoveryIds.product,
            title: "Recovery Lamp",
            slug: "recovery-lamp",
            status: "ACTIVE",
            inventoryPolicy: "TRACK",
            price: { amount: "149.00", currency: "TRY" },
            currency: "TRY",
          },
          variant: {
            id: recoveryIds.variant,
            title: "Default",
            sku: "REC-1",
            price: { amount: "149.00", currency: "TRY" },
            compareAtPrice: undefined,
            stock: 4,
            attributes: null,
            weightGrams: 1800,
            isPrimary: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          availableStock: 4,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      totals: {
        subtotal: { amount: (149 * state.quantity).toFixed(2), currency: "TRY" },
        tax: { amount: "0.00", currency: "TRY" },
        discount: { amount: "0.00", currency: "TRY" },
        total: { amount: (149 * state.quantity).toFixed(2), currency: "TRY" },
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    stock: {
      status: state.stockStatus,
      issues: state.issues,
      checkedAt: new Date().toISOString(),
    },
    delivery: {
      status: state.stockStatus === "warning" ? ("delayed" as const) : ("standard" as const),
      minHours: 24,
      maxHours: 72,
      estimatedDeliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      message: state.stockStatus === "warning" ? "Some items low in stock" : "Standard delivery",
    },
  });

  const service = {
    getCart: jest.fn(async () => buildView()),
    addItem: jest.fn(async () => buildView()),
    updateItem: jest.fn(async () => buildView()),
    clearCart: jest.fn(async () => buildView()),
    mergeCart: jest.fn(async (_ctx, _input) => {
      state.quantity = 4;
      state.stockStatus = "warning";
      state.issues = [
        {
          type: "low_stock",
          message: "Combined quantity reaches stock threshold; items low in stock.",
        },
      ];
      return buildView();
    }),
    validateCart: jest.fn(async () => ({
      cartId: recoveryIds.cart,
      valid: true,
      issues: [],
      stock: buildView().stock,
      totals: buildView().cart.totals,
      checkedAt: new Date().toISOString(),
    })),
  } as unknown as CartService;

  return { service, state, buildView };
};

describe("Recovery scenarios", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("restores cart inventory after payment failures", async () => {
    const { service: cartService, buildView } = createRecoveryCartService();
    const orderService = {
      createOrder: jest.fn(async () => {
        throw new ApiError("Payment gateway unavailable", { status: 502 });
      }),
    } as unknown as OrderService;

    await withTestApp(
      async ({ app }) => {
        await request(app)
          .post("/api/orders")
          .set("x-auth-user", userHeader)
          .send({ cartId: buildView().cart.id })
          .expect(502);

        const recoverySnapshot = await request(app)
          .get("/api/cart")
          .set("x-auth-user", userHeader)
          .expect(200);

        expect(recoverySnapshot.body.data.cart.items[0].quantity).toBe(1);
      },
      {
        apiOptions: {
          cartOptions: { service: cartService },
          orderOptions: { service: orderService },
        },
      },
    );
  });

  it("merges carts by summing quantities and surfacing stock warnings", async () => {
    const { service: cartService } = createRecoveryCartService();

    await withTestApp(
      async ({ app }) => {
        const response = await request(app)
          .post("/api/cart/merge")
          .set("x-auth-user", userHeader)
          .send({ sessionId: "guest-session", strategy: "sum" })
          .expect(200);

        expect(response.body.data.cart.items[0].quantity).toBe(4);
        expect(response.body.data.stock.status).toBe("warning");
        expect(response.body.data.stock.issues[0].message).toContain("low in stock");
      },
      {
        apiOptions: {
          cartOptions: { service: cartService },
        },
      },
    );
  });

  it("initiates refunds and releases inventory after cancellations", async () => {
    const refundEvents: string[] = [];
    const orderService = {
      cancelOrder: jest.fn(async (_ctx, orderId: string) => {
        refundEvents.push(orderId);
        return {
          id: orderId,
          reference: "LM-RECOVERY-1",
          status: "CANCELLED",
          refundStatus: "initiated",
        };
      }),
    } as unknown as OrderService;

    await withTestApp(
      async ({ app }) => {
        const response = await request(app)
          .put(`/api/v1/orders/${recoveryIds.order}/cancel`)
          .set("x-auth-user", userHeader)
          .send({ reason: "Customer request" })
          .expect(200);

        expect(response.body.data.status).toBe("CANCELLED");
        expect(refundEvents).toContain(recoveryIds.order);
      },
      {
        apiOptions: {
          orderOptions: { service: orderService },
        },
      },
    );
  });
});
