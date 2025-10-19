import { Router } from "express";

import type { ApplicationConfig } from "@lumi/types";

import { createChildLogger } from "../lib/logger.js";
import { successResponse } from "../lib/response.js";
import { createAuthorizeResourceMiddleware } from "../middleware/auth/authorizeResource.js";
import { createRequireAuthMiddleware } from "../middleware/auth/requireAuth.js";
import { createRequirePermissionMiddleware } from "../middleware/auth/requirePermission.js";
import { createRequireRoleMiddleware } from "../middleware/auth/requireRole.js";

type RouteRegistrar = (method: string, path: string) => void;

interface AdminRouterOptions {
  /**
   * Optional integration with the central route registry to provide
   * method-aware 404/405 responses and observability.
   */
  registerRoute?: RouteRegistrar;
}

/**
 * @openapi
 * /api/v1/admin/users:
 *   get:
 *     summary: List platform users (placeholder)
 *     description: >
 *       Administrative endpoints are guarded by RBAC. Until full implementations land, a
 *       placeholder payload is returned for authorised administrators.
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *       - serviceToken: []
 *     responses:
 *       '200':
 *         description: Successful placeholder payload for authorised administrators.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardSuccessResponse'
 *       '403':
 *         description: Administrator privileges are required or the requester lacks a valid role.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 *   post:
 *     summary: Create a platform user (placeholder)
 *     description: >
 *       Placeholder endpoint for administrative user creation. Returns an informational message
 *       for authorised administrators.
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *       - serviceToken: []
 *     responses:
 *       '202':
 *         description: Request acknowledged for authorised administrators.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardSuccessResponse'
 *       '403':
 *         description: Administrator privileges are required or the requester lacks a valid role.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 * /api/v1/admin/audit-log:
 *   get:
 *     summary: Retrieve audit log entries (placeholder)
 *     description: >
 *       Enterprise audit trails will be exposed here after RBAC implementation. Authorised
 *       administrators receive a placeholder payload.
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *       - serviceToken: []
 *     responses:
 *       '200':
 *         description: Placeholder payload for authorised administrators.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardSuccessResponse'
 *       '403':
 *         description: Administrator privileges are required or ownership checks failed.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 * /api/v1/admin/reports/sales:
 *   get:
 *     summary: Generate sales report (placeholder)
 *     description: >
 *       Reserved endpoint for future sales reporting capabilities. Authorised administrators with
 *       reporting permissions receive a placeholder payload.
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *       - serviceToken: []
 *     responses:
 *       '200':
 *         description: Placeholder payload for authorised administrators with reporting access.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardSuccessResponse'
 *       '403':
 *         description: Administrator privileges or reporting permissions are missing.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StandardErrorResponse'
 */
const adminLogger = createChildLogger("routes:admin");

export const ADMIN_ROUTE_PROTECTION_STRATEGY =
  "All administrative routes require authenticated requests with an administrator role. " +
  "RBAC enforcement ensures that only authorised operators can access privileged endpoints.";

const registerAdminRoute = (
  registerRoute: RouteRegistrar | undefined,
  method: string,
  path: string,
) => {
  registerRoute?.(method, path);
};

/**
 * Creates the administrative router placeholder. The router enforces RBAC policies and returns
 * descriptive placeholders for authorised administrators while the final implementations are
 * delivered in upcoming phases.
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

  const requireAuth = createRequireAuthMiddleware();
  const requireAdminRole = createRequireRoleMiddleware(["admin"]);
  const requireAuditPermission = createRequirePermissionMiddleware(["report:read"]);
  const authorizeAdminResource = createAuthorizeResourceMiddleware({
    // Placeholder implementation — future admin owner resolution will replace this.
    getOwnerId: (req) => req.user?.id,
    resource: "admin-resource",
    allowAdminOverride: true,
  });

  router.use(requireAuth);
  router.use(requireAdminRole);

  router.get("/users", (req, res) => {
    adminLogger.info("Admin users endpoint accessed", {
      userId: req.user?.id,
      requestId: req.id,
    });
    res.json(
      successResponse({
        message: "Administrative user listing will be implemented in a future phase.",
      }),
    );
  });
  registerAdminRoute(registerRoute, "GET", "/users");

  router.post("/users", (req, res) => {
    adminLogger.info("Admin user creation endpoint accessed", {
      userId: req.user?.id,
      requestId: req.id,
    });
    res.status(202).json(
      successResponse({
        message: "Administrative user creation is queued for implementation.",
      }),
    );
  });
  registerAdminRoute(registerRoute, "POST", "/users");

  router.get("/audit-log", authorizeAdminResource, (req, res) => {
    adminLogger.info("Admin audit log endpoint accessed", {
      userId: req.user?.id,
      requestId: req.id,
    });
    res.json(
      successResponse({
        message: "Audit log retrieval will be enabled once the logging subsystem stabilises.",
      }),
    );
  });
  registerAdminRoute(registerRoute, "GET", "/audit-log");

  router.get("/reports/sales", requireAuditPermission, (req, res) => {
    adminLogger.info("Admin sales report endpoint accessed", {
      userId: req.user?.id,
      requestId: req.id,
    });
    res.json(
      successResponse({
        message: "Sales reporting will be introduced alongside analytics integration.",
      }),
    );
  });
  registerAdminRoute(registerRoute, "GET", "/reports/sales");

  return router;
};
