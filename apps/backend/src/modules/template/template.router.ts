/* istanbul ignore file */

import { Router } from "express";

import { createRequireAuthMiddleware } from "@/middleware/auth/requireAuth.js";
import { createRequireRoleMiddleware } from "@/middleware/auth/requireRole.js";
import type { ApplicationConfig } from "@lumi/types";

import { TemplateController } from "./template.controller.js";
import { TemplateService } from "./template.service.js";

type RouteRegistrar = (method: string, path: string) => void;

export interface TemplateRouterOptions {
  registerRoute?: RouteRegistrar;
  service?: TemplateService;
}

const TEMPLATES_COLLECTION_PATH = "/templates";
const TEMPLATE_RESOURCE_PATH = "/templates/:id";

const ADMIN_TEMPLATES_COLLECTION_PATH = "/admin/templates";
const ADMIN_TEMPLATE_RESOURCE_PATH = "/admin/templates/:id";

const register = (registrar: RouteRegistrar | undefined, method: string, path: string) => {
  registrar?.(method, path);
};

export const createTemplateRouter = (
  _config: ApplicationConfig,
  options: TemplateRouterOptions = {},
): Router => {
  const router = Router();

  const service = options.service ?? new TemplateService();
  const controller = new TemplateController({ service });

  const requireAuth = createRequireAuthMiddleware();
  const requireAdmin = createRequireRoleMiddleware(["admin"]);

  router.get(TEMPLATES_COLLECTION_PATH, controller.listPublic);
  register(options.registerRoute, "GET", TEMPLATES_COLLECTION_PATH);

  router.get(TEMPLATE_RESOURCE_PATH, controller.getPublic);
  register(options.registerRoute, "GET", TEMPLATE_RESOURCE_PATH);

  router.get(ADMIN_TEMPLATES_COLLECTION_PATH, requireAuth, requireAdmin, controller.listAdmin);
  register(options.registerRoute, "GET", ADMIN_TEMPLATES_COLLECTION_PATH);

  router.get(ADMIN_TEMPLATE_RESOURCE_PATH, requireAuth, requireAdmin, controller.getAdmin);
  register(options.registerRoute, "GET", ADMIN_TEMPLATE_RESOURCE_PATH);

  router.post(ADMIN_TEMPLATES_COLLECTION_PATH, requireAuth, requireAdmin, controller.create);
  register(options.registerRoute, "POST", ADMIN_TEMPLATES_COLLECTION_PATH);

  router.put(ADMIN_TEMPLATE_RESOURCE_PATH, requireAuth, requireAdmin, controller.update);
  register(options.registerRoute, "PUT", ADMIN_TEMPLATE_RESOURCE_PATH);

  router.delete(ADMIN_TEMPLATE_RESOURCE_PATH, requireAuth, requireAdmin, controller.delete);
  register(options.registerRoute, "DELETE", ADMIN_TEMPLATE_RESOURCE_PATH);

  return router;
};
