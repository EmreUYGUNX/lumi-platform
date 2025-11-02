/* eslint-disable @typescript-eslint/ban-ts-comment, unicorn/no-null */
import { describe, expect, it, jest } from "@jest/globals";
import express from "express";
import type { RequestHandler } from "express";
import request from "supertest";

import { createScopedRateLimiter } from "@/middleware/rateLimiter.js";
import { createTestConfig } from "@/testing/config.js";
import type { RateLimitRouteConfig } from "@lumi/types";

import { createCartRouter } from "../cart.router.js";
import type { CartService } from "../cart.service.js";
import type { CartSummaryView, CartValidationReport } from "../cart.types.js";

const createSampleCartView = (): CartSummaryView => {
  const timestamp = new Date("2025-02-01T12:00:00.000Z").toISOString();

  return {
    cart: {
      id: "cart_test",
      userId: "user_test",
      sessionId: "session_test",
      status: "ACTIVE",
      expiresAt: null,
      items: [],
      totals: {
        subtotal: { amount: "0.00", currency: "TRY" },
        tax: { amount: "0.00", currency: "TRY" },
        discount: { amount: "0.00", currency: "TRY" },
        total: { amount: "0.00", currency: "TRY" },
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
      estimatedDeliveryDate: new Date("2025-02-04T12:00:00.000Z").toISOString(),
      message: "Standard delivery",
    },
  };
};

const createSampleValidationReport = (): CartValidationReport => {
  const view = createSampleCartView();
  return {
    cartId: view.cart.id,
    valid: true,
    issues: [],
    stock: view.stock,
    totals: view.cart.totals,
    checkedAt: view.stock.checkedAt,
  } satisfies CartValidationReport;
};

const createCartServiceMock = () => {
  const view = createSampleCartView();
  const report = createSampleValidationReport();

  return {
    getCart: jest.fn(async () => view),
    addItem: jest.fn(async () => view),
    updateItem: jest.fn(async () => view),
    removeItem: jest.fn(async () => view),
    clearCart: jest.fn(async () => view),
    mergeCart: jest.fn(async () => view),
    validateCart: jest.fn(async () => report),
    cleanupExpiredCarts: jest.fn(),
    shutdown: jest.fn(),
  } as unknown as CartService & Record<string, jest.Mock>;
};

const createAuthenticatedUser = () => ({
  id: "user_test",
  email: "user@example.com",
  roles: [],
  permissions: [],
  sessionId: "session_test",
  token: {
    sub: "user_test",
    email: "user@example.com",
    roleIds: [],
    permissions: [],
    sessionId: "session_test",
    jti: "token_test",
    iat: 1,
    exp: 999_999,
  },
});

const attachUser: RequestHandler = (req, _res, next) => {
  Object.assign(req, { user: createAuthenticatedUser() });
  next();
};

const createTestApp = () => {
  const config = createTestConfig();
  const service = createCartServiceMock();
  const app = express();
  app.use(express.json());
  const testLimiterConfig: RateLimitRouteConfig = {
    points: 25,
    durationSeconds: 60,
    blockDurationSeconds: 60,
  };
  const { middleware: authStubLimiter } = createScopedRateLimiter(
    config.security.rateLimit,
    "cart:test-auth",
    testLimiterConfig,
  );
  app.use(
    "/api",
    authStubLimiter,
    attachUser,
    createCartRouter(config, {
      service,
    }),
  );

  return { app, service };
};

const createAnonymousApp = () => {
  const config = createTestConfig();
  const service = createCartServiceMock();
  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    createCartRouter(config, {
      service,
    }),
  );
  app.use(
    (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const error = err as { statusCode?: number; code?: string };
      res.status(error.statusCode ?? 500).json({ code: error.code ?? "ERROR" });
    },
  );

  return { app };
};

describe("cart router", () => {
  it("returns the active cart for the authenticated user", async () => {
    const { app, service } = createTestApp();

    const response = await request(app).get("/api/cart").expect(200);

    expect(service.getCart).toHaveBeenCalledTimes(1);
    expect(response.body.success).toBe(true);
    expect(response.body.data.cart.id).toBe("cart_test");
  });

  it("adds an item to the cart", async () => {
    const { app, service } = createTestApp();

    const payload = {
      productVariantId: "ckvariant000000000000000001",
      quantity: 2,
    };

    await request(app).post("/api/cart/items").send(payload).expect(201);

    expect(service.addItem).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user_test", sessionId: "session_test" }),
      payload,
    );
  });

  it("updates the quantity of an existing cart item", async () => {
    const { app, service } = createTestApp();

    const payload = { quantity: 3 };
    const itemId = "ckitem000000000000000000000";

    await request(app).put(`/api/cart/items/${itemId}`).send(payload).expect(200);

    expect(service.updateItem).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user_test" }),
      itemId,
      payload,
    );
  });

  it("validates the cart before checkout", async () => {
    const { app, service } = createTestApp();

    const response = await request(app).get("/api/cart/validate").expect(200);

    expect(service.validateCart).toHaveBeenCalledTimes(1);
    expect(response.body.data.valid).toBe(true);
  });

  it("clears the cart when requested", async () => {
    const { app, service } = createTestApp();

    await request(app).delete("/api/cart").expect(200);

    expect(service.clearCart).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user_test", sessionId: "session_test" }),
    );
  });

  it("removes individual cart items", async () => {
    const { app, service } = createTestApp();

    await request(app).delete("/api/cart/items/ckitem000000000000000000000").expect(200);

    expect(service.removeItem).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user_test" }),
      "ckitem000000000000000000000",
    );
  });

  it("merges carts using the authenticated user context", async () => {
    const { app, service } = createTestApp();

    await request(app)
      .post("/api/cart/merge")
      .send({ sessionId: "guest_session", strategy: "replace" })
      .expect(200);

    expect(service.mergeCart).toHaveBeenCalledWith("user_test", {
      sessionId: "guest_session",
      strategy: "replace",
    });
  });

  it("requires authentication for cart routes", async () => {
    const { app } = createAnonymousApp();

    const response = await request(app).get("/api/cart").expect(401);
    expect(response.body.code).toBe("UNAUTHORIZED");
  });
});
