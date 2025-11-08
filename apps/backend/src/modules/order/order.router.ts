import { Router } from "express";

import { createRequireAuthMiddleware } from "@/middleware/auth/requireAuth.js";
import { createRequireRoleMiddleware } from "@/middleware/auth/requireRole.js";
import { createScopedRateLimiter } from "@/middleware/rateLimiter.js";
import type { ApplicationConfig, RateLimitRouteConfig } from "@lumi/types";

import { OrderController } from "./order.controller.js";
import { OrderService } from "./order.service.js";

type RouteRegistrar = (method: string, path: string) => void;

export interface OrderRouterOptions {
  registerRoute?: RouteRegistrar;
  service?: OrderService;
}

const ORDER_RATE_LIMIT: RateLimitRouteConfig = {
  points: 60,
  durationSeconds: 5 * 60,
  blockDurationSeconds: 5 * 60,
};

const register = (registrar: RouteRegistrar | undefined, method: string, path: string) => {
  registrar?.(method, path);
};

export const createOrderRouter = (
  config: ApplicationConfig,
  options: OrderRouterOptions = {},
): Router => {
  const router = Router();
  const service = options.service ?? new OrderService();
  const controller = new OrderController({ service });
  const requireAuth = createRequireAuthMiddleware();
  const requireAdmin = createRequireRoleMiddleware(["admin"]);

  const { middleware: orderLimiter } = createScopedRateLimiter(
    config.security.rateLimit,
    "orders",
    ORDER_RATE_LIMIT,
    {
      keyGenerator: (request) => request.user?.id ?? request.ip,
    },
  );

  router.post("/orders", requireAuth, orderLimiter, controller.createOrder);
  register(options.registerRoute, "POST", "/orders");

  router.get("/orders", requireAuth, orderLimiter, controller.listOrders);
  register(options.registerRoute, "GET", "/orders");

  router.get("/orders/:id", requireAuth, orderLimiter, controller.getOrder);
  register(options.registerRoute, "GET", "/orders/:id");

  router.put("/orders/:id/cancel", requireAuth, orderLimiter, controller.cancelOrder);
  register(options.registerRoute, "PUT", "/orders/:id/cancel");

  router.get("/orders/:reference/track", controller.trackOrder);
  register(options.registerRoute, "GET", "/orders/:reference/track");

  router.get("/admin/orders", requireAuth, requireAdmin, controller.adminListOrders);
  register(options.registerRoute, "GET", "/admin/orders");

  router.get("/admin/orders/stats", requireAuth, requireAdmin, controller.adminStats);
  register(options.registerRoute, "GET", "/admin/orders/stats");

  router.get("/admin/orders/:id", requireAuth, requireAdmin, controller.adminGetOrder);
  register(options.registerRoute, "GET", "/admin/orders/:id");

  router.put("/admin/orders/:id/status", requireAuth, requireAdmin, controller.adminUpdateStatus);
  register(options.registerRoute, "PUT", "/admin/orders/:id/status");

  router.post("/admin/orders/:id/notes", requireAuth, requireAdmin, controller.adminAddNote);
  register(options.registerRoute, "POST", "/admin/orders/:id/notes");

  router.post("/admin/orders/:id/refund", requireAuth, requireAdmin, controller.adminProcessRefund);
  register(options.registerRoute, "POST", "/admin/orders/:id/refund");

  return router;
};
