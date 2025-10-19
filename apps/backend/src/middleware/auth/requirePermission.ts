import type { RequestHandler } from "express";

import { ForbiddenError, UnauthorizedError } from "@/lib/errors.js";
import { createChildLogger, mergeRequestContext } from "@/lib/logger.js";
import { type RbacService, getSharedRbacService } from "@/modules/auth/rbac.service.js";

export interface RequirePermissionOptions {
  rbacService?: RbacService;
  logger?: ReturnType<typeof createChildLogger>;
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

  const handler: RequestHandler = async (req, _res, next) => {
    if (!req.user) {
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
