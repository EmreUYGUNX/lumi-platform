import { describe, expect, it, jest } from "@jest/globals";
import type { Request, Response } from "express";

import { UnauthorizedError, ValidationError } from "@/lib/errors.js";

import { CartController } from "../cart.controller.js";
import type { CartService } from "../cart.service.js";
import type { CartSummaryView, CartValidationReport } from "../cart.types.js";

const createCartResponse = (): CartSummaryView => ({
  cart: {
    id: "cart-id",
    userId: "user-id",
    sessionId: "session-id",
    status: "ACTIVE",
    expiresAt: null, // eslint-disable-line unicorn/no-null -- carts can remain open without an expiry
    items: [],
    totals: {
      subtotal: { amount: "10.00", currency: "TRY" },
      tax: { amount: "0.00", currency: "TRY" },
      discount: { amount: "0.00", currency: "TRY" },
      total: { amount: "10.00", currency: "TRY" },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  stock: {
    status: "ok",
    issues: [],
    checkedAt: new Date().toISOString(),
  },
  delivery: {
    status: "standard",
    minHours: 24,
    maxHours: 72,
    estimatedDeliveryDate: new Date().toISOString(),
    message: "Standard delivery",
  },
});

const createValidationReport = (): CartValidationReport => ({
  cartId: "cart-id",
  valid: true,
  issues: [],
  stock: {
    status: "ok",
    issues: [],
    checkedAt: new Date().toISOString(),
  },
  totals: {
    subtotal: { amount: "10.00", currency: "TRY" },
    tax: { amount: "0.00", currency: "TRY" },
    discount: { amount: "0.00", currency: "TRY" },
    total: { amount: "10.00", currency: "TRY" },
  },
  checkedAt: new Date().toISOString(),
});

const createController = () => {
  const serviceMocks = {
    getCart: jest.fn(async () => createCartResponse()),
    addItem: jest.fn(async () => createCartResponse()),
    updateItem: jest.fn(async () => createCartResponse()),
    removeItem: jest.fn(async () => createCartResponse()),
    clearCart: jest.fn(async () => createCartResponse()),
    mergeCart: jest.fn(async () => createCartResponse()),
    validateCart: jest.fn(async () => createValidationReport()),
  };

  return {
    controller: new CartController({ service: serviceMocks as unknown as CartService }),
    service: serviceMocks,
  };
};

const createResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res as unknown as Response;
};

describe("CartController", () => {
  it("requires authentication when retrieving cart information", async () => {
    const { controller } = createController();
    const handler = controller.getCart;
    const next = jest.fn();

    await handler({} as Request, createResponse(), next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it("passes validated context to the cart service", async () => {
    const { controller, service } = createController();
    const handler = controller.getCart;
    const next = jest.fn();
    const res = createResponse();

    await handler({ user: { id: "user-123", sessionId: "session-123" } } as Request, res, next);

    expect(service.getCart).toHaveBeenCalledWith({
      userId: "user-123",
      sessionId: "session-123",
    });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("throws a validation error when cart item identifier is missing on update", async () => {
    const { controller } = createController();
    const handler = controller.updateItem;
    const next = jest.fn();

    await handler(
      {
        user: { id: "user-1", sessionId: "session-1" },
        params: {},
        body: { quantity: 2 },
      } as unknown as Request,
      createResponse(),
      next,
    );

    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
  });

  it("requires authentication for cart merges", async () => {
    const { controller } = createController();
    const handler = controller.mergeCart;
    const next = jest.fn();

    await handler(
      { body: { sessionId: "guest", strategy: "append" } } as Request,
      createResponse(),
      next,
    );

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it("creates cart items and responds with created status", async () => {
    const { controller, service } = createController();
    const handler = controller.addItem;
    const res = createResponse();
    const next = jest.fn();

    await handler(
      {
        user: { id: "user-add", sessionId: "session-add" },
        body: { productVariantId: "ckvariant12345678901234567890", quantity: 1 },
      } as unknown as Request,
      res,
      next,
    );

    expect(service.addItem).toHaveBeenCalledWith(
      { userId: "user-add", sessionId: "session-add" },
      { productVariantId: "ckvariant12345678901234567890", quantity: 1 },
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(next).not.toHaveBeenCalled();
  });

  it("validates merge payloads and forwards to the service layer", async () => {
    const { controller, service } = createController();
    const handler = controller.mergeCart;
    const next = jest.fn();
    const res = createResponse();

    await handler(
      {
        user: { id: "user-merge", sessionId: "session-1" },
        body: { sessionId: "guest-session", strategy: "replace" },
      } as unknown as Request,
      res,
      next,
    );

    expect(service.mergeCart).toHaveBeenCalledWith("user-merge", {
      sessionId: "guest-session",
      strategy: "replace",
    });
    expect(res.json).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("validates cart state queries before invoking the service", async () => {
    const { controller, service } = createController();
    const handler = controller.validateCart;
    const res = createResponse();
    const next = jest.fn();

    await handler(
      {
        user: { id: "user-validate", sessionId: "session-validate" },
        query: { includeTotals: "false" },
      } as unknown as Request,
      res,
      next,
    );

    expect(service.validateCart).toHaveBeenCalledWith({
      userId: "user-validate",
      sessionId: "session-validate",
    });
    expect(res.json).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
