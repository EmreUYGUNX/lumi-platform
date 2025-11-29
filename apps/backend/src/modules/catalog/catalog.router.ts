/* eslint-disable sonarjs/no-duplicate-string */
import { Router } from "express";

import { createRequireAuthMiddleware } from "@/middleware/auth/requireAuth.js";
import { createRequireRoleMiddleware } from "@/middleware/auth/requireRole.js";
import type { ApplicationConfig } from "@lumi/types";

import { CatalogController } from "./catalog.controller.js";
import { CatalogService } from "./catalog.service.js";

type RouteRegistrar = (method: string, path: string) => void;

export interface CatalogRouterOptions {
  registerRoute?: RouteRegistrar;
  service?: CatalogService;
}

const registerRoute = (registrar: RouteRegistrar | undefined, method: string, path: string) => {
  registrar?.(method, path);
};

export const createCatalogRouter = (
  _config: ApplicationConfig,
  options: CatalogRouterOptions = {},
): Router => {
  const router = Router();
  const service = options.service ?? new CatalogService();
  const controller = new CatalogController({ service });

  const requireAuth = createRequireAuthMiddleware();
  const requireAdmin = createRequireRoleMiddleware(["admin"]);

  // Public product routes
  router.get("/products", controller.listProducts);
  registerRoute(options.registerRoute, "GET", "/products");

  router.get("/products/popular", controller.listPopularProducts);
  registerRoute(options.registerRoute, "GET", "/products/popular");

  router.get("/products/:slug", controller.getProduct);
  registerRoute(options.registerRoute, "GET", "/products/:slug");

  router.get("/products/:slug/reviews", controller.listProductReviews);
  registerRoute(options.registerRoute, "GET", "/products/:slug/reviews");

  router.get("/products/:id/variants", controller.listVariants);
  registerRoute(options.registerRoute, "GET", "/products/:id/variants");

  // Public category routes
  router.get("/categories", controller.listCategories);
  registerRoute(options.registerRoute, "GET", "/categories");

  router.get("/categories/:slug", controller.getCategory);
  registerRoute(options.registerRoute, "GET", "/categories/:slug");

  // Admin product routes
  router.post("/admin/products", requireAuth, requireAdmin, controller.createProduct);
  registerRoute(options.registerRoute, "POST", "/admin/products");

  router.put("/admin/products/:id", requireAuth, requireAdmin, controller.updateProduct);
  registerRoute(options.registerRoute, "PUT", "/admin/products/:id");

  router.delete("/admin/products/:id", requireAuth, requireAdmin, controller.deleteProduct);
  registerRoute(options.registerRoute, "DELETE", "/admin/products/:id");

  router.post("/admin/products/:id/variants", requireAuth, requireAdmin, controller.addVariant);
  registerRoute(options.registerRoute, "POST", "/admin/products/:id/variants");

  router.put(
    "/admin/products/:id/variants/:variantId",
    requireAuth,
    requireAdmin,
    controller.updateVariant,
  );
  registerRoute(options.registerRoute, "PUT", "/admin/products/:id/variants/:variantId");

  router.delete(
    "/admin/products/:id/variants/:variantId",
    requireAuth,
    requireAdmin,
    controller.deleteVariant,
  );
  registerRoute(options.registerRoute, "DELETE", "/admin/products/:id/variants/:variantId");

  // Admin category routes
  router.post("/admin/categories", requireAuth, requireAdmin, controller.createCategory);
  registerRoute(options.registerRoute, "POST", "/admin/categories");

  router.put("/admin/categories/:id", requireAuth, requireAdmin, controller.updateCategory);
  registerRoute(options.registerRoute, "PUT", "/admin/categories/:id");

  router.delete("/admin/categories/:id", requireAuth, requireAdmin, controller.deleteCategory);
  registerRoute(options.registerRoute, "DELETE", "/admin/categories/:id");

  return router;
};
