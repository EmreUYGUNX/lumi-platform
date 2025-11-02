import { Router } from "express";

import { createRequireAuthMiddleware } from "@/middleware/auth/requireAuth.js";
import type { ApplicationConfig } from "@lumi/types";

import { CartController } from "./cart.controller.js";
import { CartService } from "./cart.service.js";

type RouteRegistrar = (method: string, path: string) => void;

export interface CartRouterOptions {
  registerRoute?: RouteRegistrar;
  service?: CartService;
}

const register = (registrar: RouteRegistrar | undefined, method: string, path: string) => {
  registrar?.(method, path);
};

export const createCartRouter = (
  _config: ApplicationConfig,
  options: CartRouterOptions = {},
): Router => {
  const router = Router();
  const service = options.service ?? new CartService();
  const controller = new CartController({ service });
  const requireAuth = createRequireAuthMiddleware();

  router.get("/cart", requireAuth, controller.getCart);
  register(options.registerRoute, "GET", "/cart");

  router.post("/cart/items", requireAuth, controller.addItem);
  register(options.registerRoute, "POST", "/cart/items");

  router.put("/cart/items/:itemId", requireAuth, controller.updateItem);
  register(options.registerRoute, "PUT", "/cart/items/:itemId");

  router.delete("/cart/items/:itemId", requireAuth, controller.removeItem);
  register(options.registerRoute, "DELETE", "/cart/items/:itemId");

  router.delete("/cart", requireAuth, controller.clearCart);
  register(options.registerRoute, "DELETE", "/cart");

  router.post("/cart/merge", requireAuth, controller.mergeCart);
  register(options.registerRoute, "POST", "/cart/merge");

  router.get("/cart/validate", requireAuth, controller.validateCart);
  register(options.registerRoute, "GET", "/cart/validate");

  return router;
};
