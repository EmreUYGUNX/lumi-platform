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
import type { CartItemWithProduct, CartSummaryView, CartValidationReport } from "../cart.types.js";
import type { AddCartItemInput, UpdateCartItemInput } from "../cart.validators.js";

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

const attachCartItem = (view: CartSummaryView, quantity = 1): CartSummaryView => {
  const unitPrice = { amount: "199.00", currency: "TRY" };
  const product = {
    id: "ckproductsample0000000000001",
    title: "Aurora Lamp",
    slug: "aurora-lamp",
    status: "ACTIVE",
    inventoryPolicy: "TRACK",
    price: unitPrice,
    currency: "TRY",
  } satisfies CartItemWithProduct["product"];
  const timestamps = {
    createdAt: view.cart.createdAt,
    updatedAt: new Date("2025-02-01T12:00:00.000Z").toISOString(),
  };
  const variant = {
    id: "ckvariantsample000000000001",
    title: "Default",
    sku: "VAR-1",
    price: unitPrice,
    stock: 10,
    attributes: null,
    weightGrams: null,
    isPrimary: true,
    createdAt: timestamps.createdAt,
    updatedAt: timestamps.updatedAt,
  } satisfies CartItemWithProduct["variant"];
  const totalAmount = (199 * quantity).toFixed(2);
  const items: CartItemWithProduct[] = [
    {
      id: "ckcartitemsample00000000001",
      cartId: view.cart.id,
      productVariantId: variant.id,
      quantity,
      unitPrice,
      product,
      variant,
      availableStock: 10,
      createdAt: timestamps.createdAt,
      updatedAt: timestamps.updatedAt,
    },
  ];
  const totals = {
    subtotal: { amount: totalAmount, currency: "TRY" },
    tax: { amount: "0.00", currency: "TRY" },
    discount: { amount: "0.00", currency: "TRY" },
    total: { amount: totalAmount, currency: "TRY" },
  };
  return {
    ...view,
    cart: {
      ...view.cart,
      items,
      totals,
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

const createStatefulCartService = () => {
  const view = attachCartItem(createSampleCartView(), 1);
  const updateTotals = () => {
    const quantity = view.cart.items[0]?.quantity ?? 0;
    const total = (199 * quantity).toFixed(2);
    view.cart.totals = {
      subtotal: { amount: total, currency: "TRY" },
      tax: { amount: "0.00", currency: "TRY" },
      discount: { amount: "0.00", currency: "TRY" },
      total: { amount: total, currency: "TRY" },
    };
    view.cart.updatedAt = new Date().toISOString();
  };

  const service = {
    getCart: jest.fn(async () => view),
    addItem: jest.fn(async (_ctx, input: AddCartItemInput) => {
      const item = view.cart.items[0];
      if (item) {
        item.quantity += input.quantity;
      }
      updateTotals();
      return view;
    }),
    updateItem: jest.fn(async (_ctx, _itemId, input: UpdateCartItemInput) => {
      const item = view.cart.items[0];
      if (item) {
        item.quantity = input.quantity;
      }
      updateTotals();
      return view;
    }),
    removeItem: jest.fn(async () => {
      view.cart.items = [];
      updateTotals();
      return view;
    }),
    clearCart: jest.fn(async () => {
      view.cart.items = [];
      updateTotals();
      return view;
    }),
    mergeCart: jest.fn(async () => {
      const merged = attachCartItem(createSampleCartView(), 1).cart.items[0];
      if (merged) {
        view.cart.items.push({ ...merged, id: "ckmergeditem00000000000001" });
      }
      updateTotals();
      return view;
    }),
    validateCart: jest.fn(async () => createSampleValidationReport()),
    cleanupExpiredCarts: jest.fn(),
    shutdown: jest.fn(),
  } as unknown as CartService & Record<string, jest.Mock>;

  return { service, view };
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

const createTestApp = (overrides: { service?: CartService & Record<string, jest.Mock> } = {}) => {
  const config = createTestConfig();
  const service = overrides.service ?? createCartServiceMock();
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

  it("increments quantities when adding items through the API", async () => {
    const stateful = createStatefulCartService();
    const { app } = createTestApp({ service: stateful.service });
    const item = stateful.view.cart.items[0];
    if (!item) {
      throw new Error("cart fixture missing stateful item");
    }

    const payload = {
      productVariantId: item.productVariantId,
      quantity: 2,
    };

    const response = await request(app).post("/api/cart/items").send(payload).expect(201);

    expect(stateful.service.addItem).toHaveBeenCalled();
    expect(response.body.data.cart.items[0].quantity).toBe(3);
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

  it("returns updated quantities after item mutations", async () => {
    const stateful = createStatefulCartService();
    const { app } = createTestApp({ service: stateful.service });
    const item = stateful.view.cart.items[0];
    if (!item) {
      throw new Error("cart fixture missing stateful item");
    }

    const response = await request(app)
      .put(`/api/cart/items/${item.id}`)
      .send({ quantity: 5 })
      .expect(200);

    expect(stateful.service.updateItem).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user_test" }),
      item.id,
      { quantity: 5 },
    );
    expect(response.body.data.cart.items[0].quantity).toBe(5);
  });

  it("validates the cart before checkout", async () => {
    const { app, service } = createTestApp();

    const response = await request(app).get("/api/cart/validate").expect(200);

    expect(service.validateCart).toHaveBeenCalledTimes(1);
    expect(service.validateCart).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user_test" }),
      expect.objectContaining({ reserveInventory: false }),
    );
    expect(response.body.data.valid).toBe(true);
  });

  it("forwards reservation flag to the service", async () => {
    const { app, service } = createTestApp();

    await request(app).get("/api/cart/validate?reserveInventory=true").expect(200);

    expect(service.validateCart).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user_test" }),
      expect.objectContaining({ reserveInventory: true }),
    );
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

  it("returns an empty cart payload when the last item is removed", async () => {
    const stateful = createStatefulCartService();
    const { app } = createTestApp({ service: stateful.service });
    const item = stateful.view.cart.items[0];
    if (!item) {
      throw new Error("cart fixture missing stateful item");
    }

    const response = await request(app).delete(`/api/cart/items/${item.id}`).expect(200);

    expect(stateful.service.removeItem).toHaveBeenCalled();
    expect(response.body.data.cart.items).toHaveLength(0);
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

  it("combines cart contents when merge succeeds", async () => {
    const stateful = createStatefulCartService();
    const { app } = createTestApp({ service: stateful.service });

    const response = await request(app)
      .post("/api/cart/merge")
      .send({ sessionId: "guest_session", strategy: "sum" })
      .expect(200);

    expect(stateful.service.mergeCart).toHaveBeenCalledWith("user_test", {
      sessionId: "guest_session",
      strategy: "sum",
    });
    expect(response.body.data.cart.items.length).toBeGreaterThan(1);
  });

  it("requires authentication for cart routes", async () => {
    const { app } = createAnonymousApp();

    const response = await request(app).get("/api/cart").expect(401);
    expect(response.body.code).toBe("UNAUTHORIZED");
  });
});
