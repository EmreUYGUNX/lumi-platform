import type { RequestHandler } from "express";

import { ForbiddenError, UnauthorizedError } from "@/lib/errors.js";
import { createChildLogger, mergeRequestContext } from "@/lib/logger.js";
import { type RbacService, getSharedRbacService } from "@/modules/auth/rbac.service.js";
import {
  type SecurityEventService,
  createSecurityEventService,
} from "@/modules/auth/security-event.service.js";

export interface RequireRoleOptions {
  rbacService?: RbacService;
  logger?: ReturnType<typeof createChildLogger>;
  securityEvents?: SecurityEventService;
}

const normaliseRoles = (roles: readonly string[]): string[] => [
  ...new Set(roles.map((role) => role.trim().toLowerCase()).filter((role) => role.length > 0)),
];

export const createRequireRoleMiddleware = (
  roles: readonly string[],
  options: RequireRoleOptions = {},
): RequestHandler => {
  const requiredRoles = normaliseRoles(roles);
  const rbacService = options.rbacService ?? getSharedRbacService();
  const logger = options.logger ?? createChildLogger("middleware:auth:require-role");
  const securityEvents =
    options.securityEvents ??
    createSecurityEventService({
      logger: createChildLogger("middleware:auth:require-role:security-events"),
    });

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

    if (requiredRoles.length === 0) {
      next();
      return;
    }

    try {
      const hasRole = await rbacService.hasRole(req.user.id, requiredRoles);
      if (hasRole) {
        next();
        return;
      }

      logger.warn("Role-based access denied", {
        userId: req.user.id,
        requiredRoles,
        method: req.method,
        path: req.originalUrl,
        requestId: req.id,
      });

      try {
        await securityEvents.log({
          type: "role_denied",
          userId: req.user.id,
          ipAddress: req.ip,
          userAgent: req.get("user-agent") ?? undefined,
          payload: {
            requiredRoles,
            method: req.method,
            path: req.originalUrl,
            requestId: req.id,
          },
          severity: "warning",
        });
      } catch (error) {
        logger.warn("Failed to write role denial security event", {
          error,
          userId: req.user?.id,
          requestId: req.id,
        });
      }

      next(
        new ForbiddenError("You do not have permission to perform this action.", {
          details: {
            reason: "role_required",
            requiredRoles,
          },
        }),
      );
    } catch (error) {
      next(error);
    }
  };

  return handler;
};
