import { describe, expect, it, jest } from "@jest/globals";
import type { Request, Response } from "express";

import { UnauthorizedError, ValidationError } from "@/lib/errors.js";

import { OrderController } from "../order.controller.js";
import type { OrderService } from "../order.service.js";

const createController = () => {
  const serviceMocks = {
    createOrder: jest.fn(async () => ({ order: { id: "ord-1" } })),
    listUserOrders: jest.fn(async () => ({
      items: [{ id: "ord-1" }],
      meta: {
        page: 1,
        pageSize: 25,
        totalItems: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    })),
    getUserOrder: jest.fn(),
    cancelOrder: jest.fn(),
    trackOrder: jest.fn(),
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
  };

  return {
    controller: new OrderController({ service: serviceMocks as unknown as OrderService }),
    service: serviceMocks,
  };
};

const createResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    locals: {},
  };
  return res as unknown as Response & {
    status: jest.Mock;
    json: jest.Mock;
    send: jest.Mock;
    setHeader: jest.Mock;
    locals: Record<string, unknown>;
  };
};

describe("OrderController", () => {
  it("requires authentication for order creation", async () => {
    const { controller } = createController();
    const handler = controller.createOrder;
    const next = jest.fn();

    await handler({ body: {} } as Request, createResponse(), next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it("forwards context to the service during creation", async () => {
    const { controller, service } = createController();
    const handler = controller.createOrder;
    const next = jest.fn();
    const res = createResponse();

    await handler(
      {
        user: { id: "user-1", email: "user@example.com", sessionId: "sess-1" },
        body: {},
      } as unknown as Request,
      res,
      next,
    );

    expect(service.createOrder).toHaveBeenCalledTimes(1);
    expect(service.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1" }),
      expect.any(Object),
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(next).not.toHaveBeenCalled();
  });

  it("lists orders with pagination metadata", async () => {
    const { controller, service } = createController();
    const handler = controller.listOrders;
    const res = createResponse();
    const next = jest.fn();

    await handler(
      {
        user: { id: "user-1", email: "user@example.com", sessionId: "sess-1" },
        query: {},
      } as unknown as Request,
      res,
      next,
    );

    expect(service.listUserOrders).toHaveBeenCalledWith("user-1", expect.any(Object));
    const payload = res.json.mock.calls[0]?.[0];
    expect(payload).toMatchObject({
      success: true,
      data: expect.arrayContaining([{ id: "ord-1" }]),
      meta: {
        pagination: expect.objectContaining({ totalItems: 1 }),
      },
    });
  });

  it("validates identifiers when cancelling orders", async () => {
    const { controller } = createController();
    const handler = controller.cancelOrder;
    const res = createResponse();
    const next = jest.fn();

    await handler(
      {
        user: { id: "user-1", email: "user@example.com", sessionId: "sess-1" },
        params: { id: undefined },
      } as unknown as Request,
      res,
      next,
    );

    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
  });

  it("records audit metadata for admin operations", async () => {
    const { controller } = createController();
    const handler = controller.adminAddNote;
    const res = createResponse();
    const next = jest.fn();

    await handler(
      {
        params: { id: "ckorder0000000000000000001" },
        body: { message: "Note" },
        user: { id: "admin-1" },
      } as unknown as Request,
      res,
      next,
    );

    expect(res.locals.audit).toMatchObject({
      entity: "orders",
      action: "orders.note",
    });
  });

  it("supports exporting admin orders as CSV", async () => {
    const { controller, service } = createController();
    const handler = controller.adminListOrders;
    const res = createResponse();
    const next = jest.fn();

    await handler(
      {
        query: { format: "csv", page: "1", pageSize: "25" },
      } as unknown as Request,
      res,
      next,
    );

    expect(service.exportAdminOrders).toHaveBeenCalledWith(
      expect.objectContaining({ format: "csv" }),
    );
    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", expect.stringContaining("text/csv"));
    expect(res.send).toHaveBeenCalled();
  });

  it("attaches summary metadata for admin listings", async () => {
    const { controller, service } = createController();
    service.listAdminOrders.mockResolvedValueOnce({
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
    });

    const handler = controller.adminListOrders;
    const res = createResponse();
    const next = jest.fn();

    await handler(
      {
        query: { page: "1", pageSize: "25" },
      } as unknown as Request,
      res,
      next,
    );

    expect(res.json).toHaveBeenCalled();
    const payload = res.json.mock.calls[0]?.[0] as {
      meta?: {
        summary?: {
          totalOrders: number;
        };
      };
    };
    expect(payload.meta?.summary?.totalOrders).toBe(0);
  });
});
