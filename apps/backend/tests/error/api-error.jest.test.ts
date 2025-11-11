/* eslint-disable unicorn/no-null */
import { afterEach, describe, expect, it, jest } from "@jest/globals";
import type { Request, RequestHandler } from "express";
import request from "supertest";

import * as Errors from "@/lib/errors.js";
import type * as RateLimiterModule from "@/middleware/rateLimiter.js";
import type { AuthenticatedUser } from "@/modules/auth/token.types.js";
import type { CartService } from "@/modules/cart/cart.service.js";
import type { OrderService } from "@/modules/order/order.service.js";
import { withTestApp } from "@/testing/index.js";

const { AppError, ConflictError, ERROR_CODES } = Errors;
type ErrorCode = Errors.ErrorCode;

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
  const { UnauthorizedError } = jest.requireActual<typeof Errors>("@/lib/errors.js");

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

const rateLimitState = {
  trigger: false,
};

jest.mock("@/middleware/rateLimiter.js", () => {
  const actual = jest.requireActual<typeof RateLimiterModule>("@/middleware/rateLimiter.js");
  return {
    ...actual,
    createScopedRateLimiter: () => ({
      middleware: ((req: Request, res, next) => {
        if (rateLimitState.trigger) {
          res.status(429).json({
            success: false,
            error: { code: "RATE_LIMITED", message: "Too many requests." },
          });
          return;
        }

        next();
      }) as RequestHandler,
    }),
  };
});

const userHeader = JSON.stringify({
  id: "user-error",
  email: "user@example.com",
  sessionId: "session-error",
  permissions: [],
  token: null,
  roles: [{ id: "role_customer", name: "customer" }],
});

afterEach(() => {
  rateLimitState.trigger = false;
});

describe("Error handling scenarios", () => {
  it("returns 409 for insufficient stock conflicts", async () => {
    const cartService = {
      addItem: jest.fn(async () => {
        throw new ConflictError("Insufficient stock", {
          details: { variantId: "variant_low" },
        });
      }),
    } as unknown as CartService;

    await withTestApp(
      async ({ app }) => {
        const response = await request(app)
          .post("/api/cart/items")
          .set("x-auth-user", userHeader)
          .send({ productVariantId: "ckvariantlow0000000000001", quantity: 10 })
          .expect(409);

        expect(response.body.error.code).toBe("CONFLICT");
        expect(cartService.addItem).toHaveBeenCalled();
      },
      {
        apiOptions: {
          cartOptions: { service: cartService },
        },
      },
    );
  });

  it("returns 412 for price mismatches during checkout", async () => {
    const orderService = {
      createOrder: jest.fn(async () => {
        const preciseCode = "PRECONDITION_FAILED" as unknown as ErrorCode;
        throw new AppError("Price mismatch detected", 412, { code: preciseCode });
      }),
    } as unknown as OrderService;

    await withTestApp(
      async ({ app }) => {
        const response = await request(app)
          .post("/api/orders")
          .set("x-auth-user", userHeader)
          .send({ cartId: "ckcarterror0000000000001" })
          .expect(412);

        expect(response.body.error.code).toBe("PRECONDITION_FAILED");
        expect(orderService.createOrder).toHaveBeenCalled();
      },
      {
        apiOptions: {
          orderOptions: { service: orderService },
        },
      },
    );
  });

  it("returns 422 for invalid cart payloads", async () => {
    const cartService = {
      addItem: jest.fn(async () => {
        throw new AppError("Invalid cart payload", 422, {
          code: ERROR_CODES.VALIDATION,
        });
      }),
    } as unknown as CartService;

    await withTestApp(
      async ({ app }) => {
        const response = await request(app)
          .post("/api/cart/items")
          .set("x-auth-user", userHeader)
          .send({ productVariantId: "ckvariantvalid000000000001", quantity: 1 })
          .expect(422);

        expect(response.body.error.code).toBe("VALIDATION_ERROR");
      },
      {
        apiOptions: {
          cartOptions: { service: cartService },
        },
      },
    );
  });

  it("returns 429 when rate limits are exceeded", async () => {
    rateLimitState.trigger = true;

    await withTestApp(async ({ app }) => {
      const response = await request(app)
        .get("/api/cart")
        .set("x-auth-user", userHeader)
        .expect(429);

      expect(response.body.error.code).toBe("RATE_LIMITED");
    });
  });

  it("returns 500 for unexpected server errors", async () => {
    const orderService = {
      createOrder: jest.fn(async () => {
        throw new Error("database offline");
      }),
    } as unknown as OrderService;

    await withTestApp(
      async ({ app }) => {
        const response = await request(app)
          .post("/api/orders")
          .set("x-auth-user", userHeader)
          .send({ cartId: "cart_error" })
          .expect(500);

        expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
      },
      {
        apiOptions: {
          orderOptions: { service: orderService },
        },
      },
    );
  });
});
