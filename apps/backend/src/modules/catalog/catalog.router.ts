/* eslint-disable sonarjs/no-duplicate-string */
import { Router } from "express";
import type { RequestHandler } from "express";

import { createRequireAuthMiddleware } from "@/middleware/auth/requireAuth.js";
import { createRequireRoleMiddleware } from "@/middleware/auth/requireRole.js";
import type { ApplicationConfig } from "@lumi/types";

import { CatalogController } from "./catalog.controller.js";
import { CatalogService } from "./catalog.service.js";

type RouteRegistrar = (method: string, path: string) => void;

const CATALOG_BASE = "/catalog";
const withCatalogPrefix = (path: string) => `${CATALOG_BASE}${path}`;

const PRODUCTS_ROUTE = "/products";
const POPULAR_PRODUCTS_ROUTE = `${PRODUCTS_ROUTE}/popular`;
const PRODUCT_ROUTE = `${PRODUCTS_ROUTE}/:slug`;
const PRODUCT_REVIEWS_ROUTE = `${PRODUCT_ROUTE}/reviews`;
const PRODUCT_VARIANTS_ROUTE = `${PRODUCTS_ROUTE}/:id/variants`;
const CATEGORIES_ROUTE = "/categories";
const CATEGORY_ROUTE = `${CATEGORIES_ROUTE}/:slug`;
const ADMIN_PRODUCTS_ROUTE = "/admin/products";
const ADMIN_PRODUCT_ROUTE = `${ADMIN_PRODUCTS_ROUTE}/:id`;
const ADMIN_PRODUCT_VARIANT_ROUTE = `${ADMIN_PRODUCT_ROUTE}/variants/:variantId`;
const ADMIN_PRODUCT_VARIANTS_ROUTE = `${ADMIN_PRODUCT_ROUTE}/variants`;
const ADMIN_CATEGORIES_ROUTE = "/admin/categories";
const ADMIN_CATEGORY_ROUTE = `${ADMIN_CATEGORIES_ROUTE}/:id`;

export interface CatalogRouterOptions {
  registerRoute?: RouteRegistrar;
  service?: CatalogService;
}

const registerRoute = (registrar: RouteRegistrar | undefined, method: string, path: string) => {
  registrar?.(method, path);
};

const registerGet = (
  router: Router,
  registrar: RouteRegistrar | undefined,
  paths: string[],
  handler: RequestHandler,
) => {
  paths.forEach((path) => {
    router.get(path, handler);
    registerRoute(registrar, "GET", path);
  });
};

const registerPost = (
  router: Router,
  registrar: RouteRegistrar | undefined,
  paths: string[],
  middlewares: RequestHandler[],
  handler: RequestHandler,
) => {
  paths.forEach((path) => {
    router.post(path, ...middlewares, handler);
    registerRoute(registrar, "POST", path);
  });
};

const registerPut = (
  router: Router,
  registrar: RouteRegistrar | undefined,
  paths: string[],
  middlewares: RequestHandler[],
  handler: RequestHandler,
) => {
  paths.forEach((path) => {
    router.put(path, ...middlewares, handler);
    registerRoute(registrar, "PUT", path);
  });
};

const registerDelete = (
  router: Router,
  registrar: RouteRegistrar | undefined,
  paths: string[],
  middlewares: RequestHandler[],
  handler: RequestHandler,
) => {
  paths.forEach((path) => {
    router.delete(path, ...middlewares, handler);
    registerRoute(registrar, "DELETE", path);
  });
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
  const productRoutes = [PRODUCTS_ROUTE, withCatalogPrefix(PRODUCTS_ROUTE)];
  registerGet(router, options.registerRoute, productRoutes, controller.listProducts);

  const popularRoutes = [POPULAR_PRODUCTS_ROUTE, withCatalogPrefix(POPULAR_PRODUCTS_ROUTE)];
  registerGet(router, options.registerRoute, popularRoutes, controller.listPopularProducts);

  const productDetailRoutes = [PRODUCT_ROUTE, withCatalogPrefix(PRODUCT_ROUTE)];
  registerGet(router, options.registerRoute, productDetailRoutes, controller.getProduct);

  const reviewRoutes = [PRODUCT_REVIEWS_ROUTE, withCatalogPrefix(PRODUCT_REVIEWS_ROUTE)];
  registerGet(router, options.registerRoute, reviewRoutes, controller.listProductReviews);

  const variantRoutes = [PRODUCT_VARIANTS_ROUTE, withCatalogPrefix(PRODUCT_VARIANTS_ROUTE)];
  registerGet(router, options.registerRoute, variantRoutes, controller.listVariants);

  // Public category routes
  const categoryRoutes = [CATEGORIES_ROUTE, withCatalogPrefix(CATEGORIES_ROUTE)];
  registerGet(router, options.registerRoute, categoryRoutes, controller.listCategories);

  const categoryDetailRoutes = [CATEGORY_ROUTE, withCatalogPrefix(CATEGORY_ROUTE)];
  registerGet(router, options.registerRoute, categoryDetailRoutes, controller.getCategory);

  // Admin product routes
  const adminProductRoutes = [ADMIN_PRODUCTS_ROUTE, withCatalogPrefix(ADMIN_PRODUCTS_ROUTE)];
  registerPost(
    router,
    options.registerRoute,
    adminProductRoutes,
    [requireAuth, requireAdmin],
    controller.createProduct,
  );

  const adminProductDetailRoutes = [ADMIN_PRODUCT_ROUTE, withCatalogPrefix(ADMIN_PRODUCT_ROUTE)];
  adminProductDetailRoutes.forEach((path) => {
    router.get(path, requireAuth, requireAdmin, controller.getAdminProduct);
    registerRoute(options.registerRoute, "GET", path);
  });
  registerPut(
    router,
    options.registerRoute,
    adminProductDetailRoutes,
    [requireAuth, requireAdmin],
    controller.updateProduct,
  );
  registerDelete(
    router,
    options.registerRoute,
    adminProductDetailRoutes,
    [requireAuth, requireAdmin],
    controller.deleteProduct,
  );

  const adminProductVariantsRoutes = [
    ADMIN_PRODUCT_VARIANTS_ROUTE,
    withCatalogPrefix(ADMIN_PRODUCT_VARIANTS_ROUTE),
  ];
  registerPost(
    router,
    options.registerRoute,
    adminProductVariantsRoutes,
    [requireAuth, requireAdmin],
    controller.addVariant,
  );

  const adminProductVariantRoutes = [
    ADMIN_PRODUCT_VARIANT_ROUTE,
    withCatalogPrefix(ADMIN_PRODUCT_VARIANT_ROUTE),
  ];
  registerPut(
    router,
    options.registerRoute,
    adminProductVariantRoutes,
    [requireAuth, requireAdmin],
    controller.updateVariant,
  );
  registerDelete(
    router,
    options.registerRoute,
    adminProductVariantRoutes,
    [requireAuth, requireAdmin],
    controller.deleteVariant,
  );

  // Admin category routes
  const adminCategoryRoutes = [ADMIN_CATEGORIES_ROUTE, withCatalogPrefix(ADMIN_CATEGORIES_ROUTE)];
  registerPost(
    router,
    options.registerRoute,
    adminCategoryRoutes,
    [requireAuth, requireAdmin],
    controller.createCategory,
  );

  const adminCategoryDetailRoutes = [ADMIN_CATEGORY_ROUTE, withCatalogPrefix(ADMIN_CATEGORY_ROUTE)];
  registerPut(
    router,
    options.registerRoute,
    adminCategoryDetailRoutes,
    [requireAuth, requireAdmin],
    controller.updateCategory,
  );
  registerDelete(
    router,
    options.registerRoute,
    adminCategoryDetailRoutes,
    [requireAuth, requireAdmin],
    controller.deleteCategory,
  );

  return router;
};
