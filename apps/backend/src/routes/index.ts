/* istanbul ignore file */

/* composed router wiring tested via integration suites */
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { Router } from "express";

import { createAuthController } from "@/modules/auth/auth.controller.js";
import type { AuthControllerOptions } from "@/modules/auth/auth.controller.js";
import { createAuthRouter } from "@/modules/auth/auth.routes.js";
import type { AuthRouterOptions } from "@/modules/auth/auth.routes.js";
import { createAuthService } from "@/modules/auth/auth.service.js";
import { createCartRouter } from "@/modules/cart/cart.router.js";
import type { CartRouterOptions } from "@/modules/cart/cart.router.js";
import { createCatalogRouter } from "@/modules/catalog/catalog.router.js";
import type { CatalogRouterOptions } from "@/modules/catalog/catalog.router.js";
import { createOrderRouter } from "@/modules/order/order.router.js";
import type { OrderRouterOptions } from "@/modules/order/order.router.js";
import { createUserRouter } from "@/modules/user/user.router.js";
import type { UserRouterOptions } from "@/modules/user/user.router.js";
import type { ApplicationConfig } from "@lumi/types";

import { createChildLogger } from "../lib/logger.js";
import { createAdminRouter } from "./admin.js";
import { createHealthRouter } from "./health.js";
import { buildRequestPath } from "./registry.js";

type RouteRegistrar = (method: string, path: string) => void;

interface ApiRouterOptions {
  /**
   * Registers routes with the central registry so that the error handler can emit
   * accurate 405 responses and documentation remains in sync.
   */
  registerRoute?: RouteRegistrar;
  catalogOptions?: Pick<CatalogRouterOptions, "service">;
  authOptions?: AuthRouterOptions;
  cartOptions?: Pick<CartRouterOptions, "service">;
  orderOptions?: Pick<OrderRouterOptions, "service">;
  userOptions?: UserRouterOptions;
}

interface VersionMetadata {
  sunsetDate?: string;
  documentationUrl?: string;
}

const apiLogger = createChildLogger("routes:api");

const combineWithVersion = (version: string, path: string): string =>
  buildRequestPath(`/${version}`, path);

const createVersionRegistrar =
  (version: string, registerRoute?: RouteRegistrar): RouteRegistrar | undefined =>
  (method: string, path: string) => {
    if (!registerRoute) {
      return;
    }

    const fullPath = combineWithVersion(version, path);
    registerRoute(method, fullPath);
  };

const createDeprecationMiddleware = (
  version: string,
  metadata: VersionMetadata,
): RequestHandler => {
  const { sunsetDate, documentationUrl } = metadata;

  return (req: Request, res: Response, next: NextFunction) => {
    const relativePath = req.path ?? "/";
    if (/^\/?v\d+(\/|$)/i.test(relativePath)) {
      next();
      return;
    }

    const headers: Record<string, string> = {
      Deprecation: "true",
      Warning: `299 - "API version ${version} is deprecated and will be removed soon"`,
    };

    if (sunsetDate) {
      headers.Sunset = new Date(sunsetDate).toUTCString();
    }

    if (documentationUrl) {
      headers.Link = `<${documentationUrl}>; rel="alternate"; type="text/html"`;
    }

    Object.entries(headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    res.on("finish", () => {
      apiLogger.warn("Deprecated API version used", {
        version,
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
      });
    });

    next();
  };
};

/**
 * Builds the router for API version `v1`. All new API surface should be added here.
 *
 * @param config Active application configuration
 * @param options Optional route registration hooks
 */
export const createV1Router = (
  config: ApplicationConfig,
  options: ApiRouterOptions = {},
): Router => {
  const router = Router();

  const registerV1Route = options.registerRoute;

  router.use(
    "/",
    createHealthRouter(config, {
      registerRoute: registerV1Route,
    }),
  );

  const authOptions = options.authOptions ?? {};
  const sharedAuthService =
    authOptions.controllerOptions?.service ??
    options.userOptions?.authService ??
    createAuthService({ config });

  const controllerOptions: AuthControllerOptions = {
    config,
    service: sharedAuthService,
  };

  if (authOptions.controllerOptions) {
    Object.assign(controllerOptions, authOptions.controllerOptions);
  }

  const authController = authOptions.controller ?? createAuthController(controllerOptions);

  const authRouterOptions: AuthRouterOptions = {
    ...authOptions,
    registerRoute: registerV1Route,
    controller: authController,
  };

  router.use("/auth", createAuthRouter(config, authRouterOptions));

  router.use(
    "/admin",
    createAdminRouter(config, {
      registerRoute: registerV1Route,
    }),
  );

  router.use(
    "/",
    createCatalogRouter(config, {
      registerRoute: registerV1Route,
      ...options.catalogOptions,
    }),
  );

  router.use(
    "/",
    createCartRouter(config, {
      registerRoute: registerV1Route,
      ...options.cartOptions,
    }),
  );

  router.use(
    "/",
    createOrderRouter(config, {
      registerRoute: registerV1Route,
      ...options.orderOptions,
    }),
  );

  router.use(
    "/",
    createUserRouter(config, {
      registerRoute: registerV1Route,
      ...options.userOptions,
      authService: options.userOptions?.authService ?? sharedAuthService,
    }),
  );
  return router;
};

/**
 * Creates the root API router handling version negotiation, deprecation signalling,
 * and registration with the global route registry.
 *
 * The router mounts stable versions under `/vN` while keeping backwards-compatible
 * fallbacks for previous versions that emit deprecation warnings to guide migration.
 */
export const createApiRouter = (
  config: ApplicationConfig,
  options: ApiRouterOptions = {},
): Router => {
  const router = Router();
  const { registerRoute, ...forwardedOptions } = options;

  const v1RegisterRoute = createVersionRegistrar("v1", registerRoute);
  const v1Router = createV1Router(config, {
    registerRoute: v1RegisterRoute,
    ...forwardedOptions,
  });
  router.use("/v1", v1Router);

  // Backwards compatibility: keep legacy `/api/*` routes mapped to v1 but mark them deprecated.
  const legacyMetadata: VersionMetadata = {
    sunsetDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(), // ~6 months
    documentationUrl: `${config.app.apiBaseUrl.replace(/\/+$/, "")}/docs/api`,
  };

  const legacyRouter = createV1Router(config, {
    registerRoute,
    ...forwardedOptions,
  });
  router.use("/", createDeprecationMiddleware("v0", legacyMetadata), legacyRouter);

  return router;
};

export const testingHarness = {
  combineWithVersion,
  createVersionRegistrar,
  createDeprecationMiddleware,
};
