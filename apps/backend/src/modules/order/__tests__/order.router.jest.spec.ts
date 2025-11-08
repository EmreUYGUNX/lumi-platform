/* eslint-disable @typescript-eslint/ban-ts-comment */
import { describe, expect, it, jest } from "@jest/globals";
import express from "express";
import request from "supertest";

import { createTestConfig } from "@/testing/config.js";

import { createOrderRouter } from "../order.router.js";
import type { OrderService } from "../order.service.js";

const attachMockUser: express.RequestHandler = (req, _res, next) => {
  // @ts-expect-error test shim
  req.user = { id: "user-1", email: "user@example.com", sessionId: "sess-1" };
  next();
};

const passthroughMiddleware: express.RequestHandler = (_req, _res, next) => next();

jest.mock("@/middleware/auth/requireAuth.js", () => ({
  createRequireAuthMiddleware: () => attachMockUser,
}));

jest.mock("@/middleware/auth/requireRole.js", () => ({
  createRequireRoleMiddleware: () => passthroughMiddleware,
}));

jest.mock("@/middleware/rateLimiter.js", () => ({
  createScopedRateLimiter: () => ({
    middleware: passthroughMiddleware,
  }),
}));

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
});
