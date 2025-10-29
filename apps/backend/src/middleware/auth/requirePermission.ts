import type { RequestHandler } from "express";

import { ForbiddenError, UnauthorizedError } from "@/lib/errors.js";
import { createChildLogger, mergeRequestContext } from "@/lib/logger.js";
import { type RbacService, getSharedRbacService } from "@/modules/auth/rbac.service.js";
import {
  type SecurityEventService,
  createSecurityEventService,
} from "@/modules/auth/security-event.service.js";
import { recordPermissionViolation } from "@/observability/auth-metrics.js";

export interface RequirePermissionOptions {
  rbacService?: RbacService;
  logger?: ReturnType<typeof createChildLogger>;
  securityEvents?: SecurityEventService;
}

const normalisePermissions = (permissions: readonly string[]): string[] =>
  [...new Set(permissions.map((permission) => permission.trim()))].filter(
    (permission) => permission.length > 0,
  );

export const createRequirePermissionMiddleware = (
  permissions: readonly string[],
  options: RequirePermissionOptions = {},
): RequestHandler => {
  const requiredPermissions = normalisePermissions(permissions);
  const rbacService = options.rbacService ?? getSharedRbacService();
  const logger = options.logger ?? createChildLogger("middleware:auth:require-permission");
  const securityEvents =
    options.securityEvents ??
    createSecurityEventService({
      logger: createChildLogger("middleware:auth:require-permission:security-events"),
    });

  const handler: RequestHandler = async (req, _res, next) => {
    if (!req.user) {
      recordPermissionViolation("unauthenticated");
      next(
        new UnauthorizedError("Authentication required.", {
          details: { reason: "authentication_required" },
        }),
      );
      return;
    }

    mergeRequestContext({ userId: req.user.id });

    if (requiredPermissions.length === 0) {
      next();
      return;
    }

    try {
      const allowed = await rbacService.hasPermission(req.user.id, requiredPermissions);
      if (allowed) {
        next();
        return;
      }

      logger.warn("Permission-based access denied", {
        userId: req.user.id,
        requiredPermissions,
        method: req.method,
        path: req.originalUrl,
        requestId: req.id,
      });

      recordPermissionViolation("permission");

      try {
        await securityEvents.log({
          type: "permission_denied",
          userId: req.user.id,
          ipAddress: req.ip,
          userAgent: req.get("user-agent") ?? undefined,
          payload: {
            requiredPermissions,
            method: req.method,
            path: req.originalUrl,
            requestId: req.id,
          },
          severity: "warning",
        });
      } catch (error) {
        logger.warn("Failed to write permission denial security event", {
          error,
          userId: req.user?.id,
          requestId: req.id,
        });
      }

      next(
        new ForbiddenError("You do not have permission to perform this action.", {
          details: {
            reason: "permission_required",
            requiredPermissions,
          },
        }),
      );
    } catch (error) {
      next(error);
    }
  };

  return handler;
};
