import { Router } from "express";

import { createRequireAuthMiddleware } from "@/middleware/auth/requireAuth.js";
import { createScopedRateLimiter } from "@/middleware/rateLimiter.js";
import type { ApplicationConfig, RateLimitRouteConfig } from "@lumi/types";

import { CartController } from "./cart.controller.js";
import { CartService } from "./cart.service.js";

type RouteRegistrar = (method: string, path: string) => void;

export interface CartRouterOptions {
  registerRoute?: RouteRegistrar;
  service?: CartService;
}

const CART_RATE_LIMIT: RateLimitRouteConfig = {
  points: 120,
  durationSeconds: 5 * 60,
  blockDurationSeconds: 5 * 60,
};

const CART_ROUTE_BASE = "/cart";
const CART_ITEMS_ROUTE = "/cart/items";
const CART_ITEM_ROUTE = "/cart/items/:itemId";
const CART_MERGE_ROUTE = "/cart/merge";
const CART_VALIDATE_ROUTE = "/cart/validate";

const register = (registrar: RouteRegistrar | undefined, method: string, path: string) => {
  registrar?.(method, path);
};

export const createCartRouter = (
  config: ApplicationConfig,
  options: CartRouterOptions = {},
): Router => {
  const router = Router();
  const service = options.service ?? new CartService();
  const controller = new CartController({ service });
  const requireAuth = createRequireAuthMiddleware();
  const { middleware: cartRateLimiter } = createScopedRateLimiter(
    config.security.rateLimit,
    "cart:operations",
    CART_RATE_LIMIT,
    {
      keyGenerator: (request) => request.user?.id ?? request.ip ?? "anonymous",
    },
  );

  router.use(requireAuth, cartRateLimiter);

  router.get(CART_ROUTE_BASE, controller.getCart);
  register(options.registerRoute, "GET", CART_ROUTE_BASE);

  router.post(CART_ITEMS_ROUTE, controller.addItem);
  register(options.registerRoute, "POST", CART_ITEMS_ROUTE);

  router.put(CART_ITEM_ROUTE, controller.updateItem);
  register(options.registerRoute, "PUT", CART_ITEM_ROUTE);

  router.delete(CART_ITEM_ROUTE, controller.removeItem);
  register(options.registerRoute, "DELETE", CART_ITEM_ROUTE);

  router.delete(CART_ROUTE_BASE, controller.clearCart);
  register(options.registerRoute, "DELETE", CART_ROUTE_BASE);

  router.post(CART_MERGE_ROUTE, controller.mergeCart);
  register(options.registerRoute, "POST", CART_MERGE_ROUTE);

  router.get(CART_VALIDATE_ROUTE, controller.validateCart);
  register(options.registerRoute, "GET", CART_VALIDATE_ROUTE);

  return router;
};
