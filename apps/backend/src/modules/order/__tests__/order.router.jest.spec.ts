/* eslint-disable @typescript-eslint/ban-ts-comment */
import { describe, expect, it, jest } from "@jest/globals";
import express from "express";
import request from "supertest";

import type * as ErrorsModule from "@/lib/errors.js";
import { createTestConfig } from "@/testing/config.js";

import { createOrderRouter } from "../order.router.js";
import type { OrderService } from "../order.service.js";

const authGuardState = {
  authenticated: true,
  roles: ["admin"],
};

const roleGuardState = {
  enforce: false,
};

const passthroughMiddleware: express.RequestHandler = (_req, _res, next) => next();

jest.mock("@/middleware/auth/requireAuth.js", () => {
  const errors = jest.requireActual<typeof ErrorsModule>("@/lib/errors.js");
  const { UnauthorizedError } = errors;

  const requireAuthMiddleware = (
    req: express.Request,
    _res: express.Response,
    next: express.NextFunction,
  ) => {
    if (!authGuardState.authenticated) {
      next(new UnauthorizedError("Authentication required."));
      return;
    }

    req.user = {
      id: "user-1",
      email: "user@example.com",
      sessionId: "sess-1",
      roles: authGuardState.roles.map((role, index) => ({
        id: `role-${index}`,
        name: role,
      })),
      permissions: [],
      token: {
        sub: "user-1",
        email: "user@example.com",
        roleIds: authGuardState.roles,
        permissions: [],
        sessionId: "sess-1",
        jti: "test-jti",
        iat: 0,
        exp: 0,
      },
    };

    next();
  };

  return {
    createRequireAuthMiddleware: () => requireAuthMiddleware,
  };
});

jest.mock("@/middleware/auth/requireRole.js", () => {
  const errors = jest.requireActual<typeof ErrorsModule>("@/lib/errors.js");
  const { ForbiddenError, UnauthorizedError } = errors;

  const createRequireRoleMiddleware = (roles: readonly string[] = []) => {
    return (req: express.Request, _res: express.Response, next: express.NextFunction) => {
      if (!roleGuardState.enforce || roles.length === 0) {
        next();
        return;
      }

      if (!req.user) {
        next(new UnauthorizedError("Authentication required."));
        return;
      }

      const assigned = new Set((req.user.roles ?? []).map((role) => role.name));
      const hasRole = roles.some((role) => assigned.has(role));
      if (!hasRole) {
        next(
          new ForbiddenError("You do not have permission to perform this action.", {
            details: { requiredRoles: roles },
          }),
        );
        return;
      }

      next();
    };
  };

  return {
    createRequireRoleMiddleware,
  };
});

jest.mock("@/middleware/rateLimiter.js", () => ({
  createScopedRateLimiter: () => ({
    middleware: passthroughMiddleware,
  }),
}));

afterEach(() => {
  authGuardState.authenticated = true;
  authGuardState.roles = ["admin"];
  roleGuardState.enforce = false;
});

const createServiceMock = () =>
  ({
    createOrder: jest.fn(async () => ({ order: { id: "ord_1" } })),
    listUserOrders: jest.fn(async () => ({
      items: [],
      meta: {
        page: 1,
        pageSize: 25,
        totalItems: 0,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    })),
    getUserOrder: jest.fn(),
    cancelOrder: jest.fn(),
    trackOrder: jest.fn(async () => ({ reference: "LM-1", status: "PENDING", timeline: [] })),
    listAdminOrders: jest.fn(async () => ({
      items: [],
      meta: {
        page: 1,
        pageSize: 25,
        totalItems: 0,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
      summary: {
        totalRevenue: { amount: "0.00", currency: "TRY" },
        averageOrderValue: { amount: "0.00", currency: "TRY" },
        totalOrders: 0,
      },
    })),
    getAdminOrder: jest.fn(),
    updateOrderStatus: jest.fn(),
    addInternalNote: jest.fn(),
    processRefund: jest.fn(),
    getOrderStats: jest.fn(async () => ({
      totalOrders: {
        PENDING: 0,
        PAID: 0,
        FULFILLED: 0,
        SHIPPED: 0,
        DELIVERED: 0,
        CANCELLED: 0,
      },
      revenue: {
        total: "0.00",
        currency: "TRY",
      },
      averageOrderValue: "0.00",
      revenueSeries: [],
      topProducts: [],
      conversionRate: 0,
    })),
    exportAdminOrders: jest.fn(async () => ({
      filename: "orders.csv",
      content: "reference,status\nLM-1,PENDING",
    })),
  }) as unknown as jest.Mocked<OrderService>;

const createApp = () => {
  const config = createTestConfig();
  const service = createServiceMock();
  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    createOrderRouter(config, {
      service,
    }),
  );
  // Minimal error handler to emulate API error responses
  app.use(
    (
      error: Error & { status?: number; code?: string },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      const status =
        typeof error.status === "number"
          ? error.status
          : error.code === "UNAUTHORIZED"
            ? 401
            : error.code === "FORBIDDEN"
              ? 403
              : 500;
      res.status(status).json({
        success: false,
        error: {
          code:
            error.code ??
            (status === 401 ? "UNAUTHORIZED" : status === 403 ? "FORBIDDEN" : "ERROR"),
          message: error.message,
        },
      });
    },
  );

  return { app, service };
};

describe("order router", () => {
  it("creates orders for authenticated users", async () => {
    const { app, service } = createApp();

    const response = await request(app).post("/api/orders").send({}).expect(201);

    expect(response.body.success).toBe(true);
    expect(service.createOrder).toHaveBeenCalled();
  });

  it("exposes public tracking endpoint", async () => {
    const { app, service } = createApp();

    await request(app).get("/api/orders/LM-TRACK/track").expect(200);

    expect(service.trackOrder).toHaveBeenCalledWith({ reference: "LM-TRACK" });
  });

  it("wires admin endpoints", async () => {
    const { app, service } = createApp();

    await request(app).get("/api/admin/orders").expect(200);
    expect(service.listAdminOrders).toHaveBeenCalled();

    await request(app).post("/api/admin/orders/ckorder0000000000000000001/notes").send({
      message: "internal",
    });
    expect(service.addInternalNote).toHaveBeenCalled();
  });

  it("serves CSV exports for admin orders", async () => {
    const { app, service } = createApp();

    const response = await request(app).get("/api/admin/orders?format=csv&page=1&pageSize=25");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/csv");
    expect(service.exportAdminOrders).toHaveBeenCalled();
  });

  it("rejects unauthenticated order creation attempts", async () => {
    authGuardState.authenticated = false;
    const { app } = createApp();

    const response = await request(app).post("/api/orders").send({}).expect(401);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("enforces admin role checks on privileged endpoints", async () => {
    roleGuardState.enforce = true;
    authGuardState.roles = ["customer"];
    const { app } = createApp();

    const response = await request(app).get("/api/admin/orders").expect(403);

    expect(response.body.error.code).toBe("FORBIDDEN");
  });
});
