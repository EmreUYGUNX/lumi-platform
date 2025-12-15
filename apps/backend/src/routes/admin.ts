/* istanbul ignore file */

/* placeholder admin router exercised via end-to-end suites */
import { Router } from "express";
import type { Request } from "express";
import { z } from "zod";

import { createAccountSecurityService } from "@/modules/auth/account-security.service.js";
import type { AccountSecurityService } from "@/modules/auth/account-security.service.js";
import { PERMISSIONS } from "@/modules/auth/permissions.js";
import { createSecurityEventService } from "@/modules/auth/security-event.service.js";
import type { SecurityEventService } from "@/modules/auth/security-event.service.js";
import { ProductionController } from "@/modules/production/production.controller.js";
import { ProductionService } from "@/modules/production/production.service.js";
import type { ApplicationConfig } from "@lumi/types";

import { asyncHandler } from "../lib/asyncHandler.js";
import { ValidationError } from "../lib/errors.js";
import { createChildLogger } from "../lib/logger.js";
import { successResponse } from "../lib/response.js";
import { createAuthorizeResourceMiddleware } from "../middleware/auth/authorizeResource.js";
import { createRequireAuthMiddleware } from "../middleware/auth/requireAuth.js";
import { createRequirePermissionMiddleware } from "../middleware/auth/requirePermission.js";
import { createRequireRoleMiddleware } from "../middleware/auth/requireRole.js";
import { buildRequestPath } from "./registry.js";

type RouteRegistrar = (method: string, path: string) => void;

type AdminRequest = Request<Record<string, string>, unknown, unknown, Record<string, unknown>>;

interface AdminRouterOptions {
  /**
   * Optional integration with the central route registry to provide
   * method-aware 404/405 responses and observability.
   */
  registerRoute?: RouteRegistrar;
  securityEvents?: SecurityEventService;
  accountSecurityService?: AccountSecurityService;
}

const USER_ID_REQUIRED_ERROR = "User identifier is required.";
const USER_AGENT_HEADER = "user-agent";

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
  registerRoute?.(method, buildRequestPath("/admin", path));
};

const UnlockAccountRequestSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Reason must be at least 3 characters")
    .max(200, "Reason must be at most 200 characters")
    .optional(),
});

const formatZodIssues = (issues: z.ZodIssue[]) =>
  issues.map((issue) => ({
    path: issue.path.map(String).join(".") || "root",
    message: issue.message,
    code: issue.code,
  }));

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

  const securityEvents =
    options.securityEvents ??
    createSecurityEventService({
      logger: createChildLogger("routes:admin:security-events"),
    });
  const accountSecurityService =
    options.accountSecurityService ??
    createAccountSecurityService({
      securityEvents,
      logger: createChildLogger("routes:admin:account-security"),
    });

  const requireAuth = createRequireAuthMiddleware();
  const requireAdminRole = createRequireRoleMiddleware(["admin"], { securityEvents });
  const requireAdminOrStaffRole = createRequireRoleMiddleware(["admin", "staff"], {
    securityEvents,
  });
  const requireAuditPermission = createRequirePermissionMiddleware([PERMISSIONS.REPORTS.READ], {
    securityEvents,
  });
  const authorizeAdminResource = createAuthorizeResourceMiddleware({
    // Placeholder implementation — future admin owner resolution will replace this.
    getOwnerId: (req) => req.user?.id,
    resource: "admin-resource",
    allowAdminOverride: true,
    securityEvents,
  });

  const logSecurityEvent = (
    event: Parameters<SecurityEventService["log"]>[0],
    contextMessage: string,
    metadata: Record<string, unknown> = {},
  ): void => {
    Promise.resolve(securityEvents.log(event)).catch((error) => {
      adminLogger.warn(contextMessage, { error, ...metadata });
    });
  };

  const logAdminAccess = (req: AdminRequest, overrides: Record<string, unknown> = {}): void => {
    logSecurityEvent(
      {
        type: "admin_access_granted",
        userId: req.user?.id,
        ipAddress: req.ip,
        userAgent: req.get(USER_AGENT_HEADER) ?? undefined,
        payload: {
          method: req.method,
          path: req.originalUrl,
          requestId: req.id,
          ...overrides,
        },
      },
      "Failed to record admin access security event",
      { userId: req.user?.id, requestId: req.id },
    );
  };

  router.use(requireAuth);

  const productionService = new ProductionService();
  const productionController = new ProductionController({ service: productionService });

  router.post("/production/generate", requireAdminRole, productionController.generate);
  registerAdminRoute(registerRoute, "POST", "/production/generate");

  router.get("/production/download/:id", requireAdminOrStaffRole, productionController.download);
  registerAdminRoute(registerRoute, "GET", "/production/download/:id");

  router.get("/production/orders", requireAdminRole, productionController.listOrders);
  registerAdminRoute(registerRoute, "GET", "/production/orders");

  router.get("/production/order/:orderId", requireAdminRole, productionController.listOrder);
  registerAdminRoute(registerRoute, "GET", "/production/order/:orderId");

  router.post("/production/batch/download", requireAdminRole, productionController.batchDownload);
  registerAdminRoute(registerRoute, "POST", "/production/batch/download");

  router.use(requireAdminRole);

  router.use(async (req, _res, next) => {
    await logSecurityEvent(
      {
        type: "admin_access_attempt",
        userId: req.user?.id,
        ipAddress: req.ip,
        userAgent: req.get(USER_AGENT_HEADER) ?? undefined,
        payload: {
          method: req.method,
          path: req.originalUrl,
          requestId: req.id,
        },
      },
      "Failed to record admin access attempt",
      { method: req.method, path: req.originalUrl },
    );

    next();
  });

  router.get("/users", (req, res) => {
    adminLogger.info("Admin users endpoint accessed", {
      userId: req.user?.id,
      requestId: req.id,
    });
    logAdminAccess(req);
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
    logAdminAccess(req);
    res.status(202).json(
      successResponse({
        message: "Administrative user creation is queued for implementation.",
      }),
    );
  });
  registerAdminRoute(registerRoute, "POST", "/users");

  router.post(
    "/users/:userId/unlock",
    asyncHandler(async (req, res) => {
      const userId = req.params.userId?.trim();

      if (!userId) {
        throw new ValidationError(USER_ID_REQUIRED_ERROR, {
          issues: [
            {
              path: "userId",
              message: USER_ID_REQUIRED_ERROR,
            },
          ],
        });
      }

      const parseResult = UnlockAccountRequestSchema.safeParse(req.body ?? {});
      if (!parseResult.success) {
        throw new ValidationError("Unlock request payload is invalid.", {
          issues: formatZodIssues(parseResult.error.issues),
        });
      }

      if (!req.user) {
        throw new ValidationError("Authentication context is missing for admin unlock.");
      }

      await accountSecurityService.unlockUserAccount({
        userId,
        performedBy: req.user.id,
        reason: parseResult.data.reason,
        ipAddress: req.ip,
        userAgent: req.get(USER_AGENT_HEADER) ?? undefined,
      });

      logAdminAccess(req, { action: "unlock_user", targetUserId: userId });

      res.json(
        successResponse({
          message: "User account unlocked successfully.",
        }),
      );
    }),
  );
  registerAdminRoute(registerRoute, "POST", "/users/:userId/unlock");

  router.get("/audit-log", authorizeAdminResource, (req, res) => {
    adminLogger.info("Admin audit log endpoint accessed", {
      userId: req.user?.id,
      requestId: req.id,
    });
    logAdminAccess(req);
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
    logAdminAccess(req);
    res.json(
      successResponse({
        message: "Sales reporting will be introduced alongside analytics integration.",
      }),
    );
  });
  registerAdminRoute(registerRoute, "GET", "/reports/sales");

  return router;
};
