/* istanbul ignore file */

import { Router } from "express";

import { createRequireAuthMiddleware } from "@/middleware/auth/requireAuth.js";
import { createRequireRoleMiddleware } from "@/middleware/auth/requireRole.js";
import type { ApplicationConfig } from "@lumi/types";

import { CustomizationController } from "./customization.controller.js";
import { CustomizationService } from "./customization.service.js";

type RouteRegistrar = (method: string, path: string) => void;

export interface CustomizationRouterOptions {
  registerRoute?: RouteRegistrar;
  service?: CustomizationService;
}

const CUSTOMIZATION_ROUTE = "/products/:id/customization";
const ADMIN_CUSTOMIZATION_ROUTE = "/admin/products/:id/customization";

const register = (registrar: RouteRegistrar | undefined, method: string, path: string) => {
  registrar?.(method, path);
};

export const createCustomizationRouter = (
  _config: ApplicationConfig,
  options: CustomizationRouterOptions = {},
): Router => {
  const router = Router();
  const service = options.service ?? new CustomizationService();
  const controller = new CustomizationController({ service });

  const requireAuth = createRequireAuthMiddleware();
  const requireAdmin = createRequireRoleMiddleware(["admin"]);

  router.get(CUSTOMIZATION_ROUTE, controller.getCustomization);
  register(options.registerRoute, "GET", CUSTOMIZATION_ROUTE);

  router.get(
    ADMIN_CUSTOMIZATION_ROUTE,
    requireAuth,
    requireAdmin,
    controller.getAdminCustomization,
  );
  register(options.registerRoute, "GET", ADMIN_CUSTOMIZATION_ROUTE);

  router.post(ADMIN_CUSTOMIZATION_ROUTE, requireAuth, requireAdmin, controller.createCustomization);
  register(options.registerRoute, "POST", ADMIN_CUSTOMIZATION_ROUTE);

  router.put(ADMIN_CUSTOMIZATION_ROUTE, requireAuth, requireAdmin, controller.updateCustomization);
  register(options.registerRoute, "PUT", ADMIN_CUSTOMIZATION_ROUTE);

  router.delete(
    ADMIN_CUSTOMIZATION_ROUTE,
    requireAuth,
    requireAdmin,
    controller.deleteCustomization,
  );
  register(options.registerRoute, "DELETE", ADMIN_CUSTOMIZATION_ROUTE);

  return router;
};
