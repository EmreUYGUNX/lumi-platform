import type { RequestHandler } from "express";
import { Router } from "express";

import type { ApplicationConfig } from "@lumi/types";

import { createChildLogger } from "../lib/logger.js";
import { errorResponse } from "../lib/response.js";

type RouteRegistrar = (method: string, path: string) => void;

interface AdminRouterOptions {
  /**
   * Optional integration with the central route registry to provide
   * method-aware 404/405 responses and observability.
   */
  registerRoute?: RouteRegistrar;
}

const adminLogger = createChildLogger("routes:admin");

export const ADMIN_ROUTE_PROTECTION_STRATEGY =
  "All administrative routes require authenticated requests with elevated privileges. " +
  "Until Phase 3 enables RBAC, every admin endpoint deliberately returns 403 Forbidden " +
  "while recording access attempts for security monitoring.";

const registerAdminRoute = (
  registerRoute: RouteRegistrar | undefined,
  method: string,
  path: string,
) => {
  registerRoute?.(method, path);
};

const createForbiddenHandler =
  (resource: string): RequestHandler =>
  (req, res) => {
    res.status(403).json(
      errorResponse(
        {
          code: "FORBIDDEN",
          message: "Administrator privileges required.",
          details: {
            resource,
            reason: "Authentication and authorisation not yet implemented for admin routes.",
            remediation: "Authenticate with an administrator account once RBAC is available.",
          },
        },
        {
          timestamp: new Date().toISOString(),
        },
      ),
    );

    adminLogger.warn("Blocked unauthorised admin access attempt", {
      resource,
      method: req.method,
      path: req.originalUrl,
      ip: req.ip,
      requestId: req.id,
    });
  };

/**
 * Creates the administrative router placeholder. The router intentionally blocks access to all
 * routes with 403 responses while RBAC is implemented in later phases.
 *
 * @param _config Active application configuration
 * @param options Optional registration hook integration
 */
export const createAdminRouter = (
  _config: ApplicationConfig,
  options: AdminRouterOptions = {},
): Router => {
  const router = Router();

  const { registerRoute } = options;

  router.get("/users", createForbiddenHandler("admin.users.read"));
  registerAdminRoute(registerRoute, "GET", "/users");

  router.post("/users", createForbiddenHandler("admin.users.create"));
  registerAdminRoute(registerRoute, "POST", "/users");

  router.get("/audit-log", createForbiddenHandler("admin.audit-log.read"));
  registerAdminRoute(registerRoute, "GET", "/audit-log");

  router.get("/reports/sales", createForbiddenHandler("admin.reports.sales"));
  registerAdminRoute(registerRoute, "GET", "/reports/sales");

  return router;
};
