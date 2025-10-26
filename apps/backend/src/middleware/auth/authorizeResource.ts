import type { RequestHandler } from "express";

import { ForbiddenError, UnauthorizedError } from "@/lib/errors.js";
import { createChildLogger, mergeRequestContext } from "@/lib/logger.js";
import { type RbacService, getSharedRbacService } from "@/modules/auth/rbac.service.js";
import {
  type SecurityEventService,
  createSecurityEventService,
} from "@/modules/auth/security-event.service.js";
import { recordPermissionViolation } from "@/observability/auth-metrics.js";

interface AuthorizeResourceDependencies {
  logger: ReturnType<typeof createChildLogger>;
  securityEvents: SecurityEventService;
}

const logSecurityEventSafe = async (
  deps: AuthorizeResourceDependencies,
  event: Parameters<SecurityEventService["log"]>[0],
  fallbackMessage: string,
  metadata: Record<string, unknown>,
) => {
  try {
    await deps.securityEvents.log(event);
  } catch (error) {
    deps.logger.warn(fallbackMessage, { error, ...metadata });
  }
};

const handleMissingUser = async (
  deps: AuthorizeResourceDependencies,
  req: Parameters<RequestHandler>[0],
  next: Parameters<RequestHandler>[2],
) => {
  next(
    new UnauthorizedError("Authentication required.", {
      details: { reason: "authentication_required" },
    }),
  );

  deps.logger.warn("Unauthenticated access attempt", {
    path: req.originalUrl,
    method: req.method,
    requestId: req.id,
  });

  recordPermissionViolation("unauthenticated");

  await logSecurityEventSafe(
    deps,
    {
      type: "permission_denied",
      ipAddress: req.ip,
      userAgent: req.get("user-agent") ?? undefined,
      payload: {
        reason: "authentication_required",
        method: req.method,
        path: req.originalUrl,
        requestId: req.id,
      },
      severity: "warning",
    },
    "Failed to write unauthenticated access security event",
    { requestId: req.id },
  );
};

const logDeniedAccess = async (
  deps: AuthorizeResourceDependencies,
  req: Parameters<RequestHandler>[0],
  resource: string,
  ownerId: string,
  reason: string,
) => {
  await logSecurityEventSafe(
    deps,
    {
      type: "permission_denied",
      userId: req.user?.id,
      ipAddress: req.ip,
      userAgent: req.get("user-agent") ?? undefined,
      payload: {
        reason,
        resource,
        ownerId,
        method: req.method,
        path: req.originalUrl,
        requestId: req.id,
      },
      severity: "warning",
    },
    "Failed to write resource denial security event",
    { userId: req.user?.id, requestId: req.id },
  );
};

const determineAccessDecision = async (
  req: Parameters<RequestHandler>[0],
  ownerId: string,
  allowAdminOverride: boolean,
  adminRoles: string[],
  rbacService: RbacService,
  next: Parameters<RequestHandler>[2],
): Promise<"granted" | "denied" | "handled"> => {
  if (req.user?.id === ownerId) {
    return "granted";
  }

  if (!allowAdminOverride || adminRoles.length === 0) {
    return "denied";
  }

  try {
    const hasAdminRole = await rbacService.hasRole(req.user!.id, adminRoles);
    return hasAdminRole ? "granted" : "denied";
  } catch (error) {
    next(error);
    return "handled";
  }
};

export interface AuthorizeResourceOptions {
  getOwnerId: (
    req: Parameters<RequestHandler>[0],
  ) => Promise<string | undefined> | string | undefined;
  resource?: string;
  allowAdminOverride?: boolean;
  adminRoles?: string[];
  rbacService?: RbacService;
  logger?: ReturnType<typeof createChildLogger>;
  securityEvents?: SecurityEventService;
}

const DEFAULT_ADMIN_ROLES = ["admin"] as const;

interface OwnerResolutionContext {
  readonly req: Parameters<RequestHandler>[0];
  readonly resource: string;
  readonly logger: ReturnType<typeof createChildLogger>;
}

type ResolutionOutcome = "handled" | "continue";

const resolveOwnerId = async (
  ctx: OwnerResolutionContext,
  getOwnerId: AuthorizeResourceOptions["getOwnerId"],
  next: Parameters<RequestHandler>[2],
): Promise<{ outcome: ResolutionOutcome; ownerId?: string }> => {
  let ownerId: string | undefined;

  try {
    ownerId = await getOwnerId(ctx.req);
  } catch (error) {
    next(error);
    return { outcome: "handled" };
  }

  if (!ownerId) {
    ctx.logger.warn("Resource ownership could not be resolved", {
      userId: ctx.req.user?.id,
      resource: ctx.resource,
      method: ctx.req.method,
      path: ctx.req.originalUrl,
      requestId: ctx.req.id,
    });

    recordPermissionViolation("owner_unresolved");

    next(
      new ForbiddenError("You do not have permission to perform this action.", {
        details: {
          reason: "resource_owner_unresolved",
          resource: ctx.resource,
        },
      }),
    );
    return { outcome: "handled" };
  }

  return { outcome: "continue", ownerId };
};

export const createAuthorizeResourceMiddleware = (
  options: AuthorizeResourceOptions,
): RequestHandler => {
  const {
    getOwnerId,
    resource = "resource",
    allowAdminOverride = true,
    adminRoles = [...DEFAULT_ADMIN_ROLES],
    rbacService: providedRbacService,
    logger: providedLogger,
    securityEvents: providedSecurityEvents,
  } = options;

  if (typeof getOwnerId !== "function") {
    throw new TypeError("createAuthorizeResourceMiddleware requires a getOwnerId function.");
  }

  const rbacService = providedRbacService ?? getSharedRbacService();
  const logger = providedLogger ?? createChildLogger("middleware:auth:authorize-resource");
  const securityEvents =
    providedSecurityEvents ??
    createSecurityEventService({
      logger: createChildLogger("middleware:auth:authorize-resource:security-events"),
    });
  const normalisedAdminRoles = adminRoles.map((role) => role.toLowerCase());

  const handler: RequestHandler = async (req, _res, next) => {
    const deps: AuthorizeResourceDependencies = { logger, securityEvents };
    if (!req.user) {
      await handleMissingUser(deps, req, next);
      return;
    }

    mergeRequestContext({ userId: req.user.id });

    const ownerResolution = await resolveOwnerId({ req, resource, logger }, getOwnerId, next);
    if (ownerResolution.outcome !== "continue") {
      return;
    }

    const ownerId = ownerResolution.ownerId!;
    const accessDecision = await determineAccessDecision(
      req,
      ownerId,
      allowAdminOverride,
      normalisedAdminRoles,
      rbacService,
      next,
    );
    if (accessDecision === "handled") {
      return;
    }

    if (accessDecision === "granted") {
      next();
      return;
    }

    recordPermissionViolation("resource");

    logger.warn("Resource access denied", {
      userId: req.user.id,
      resource,
      ownerId,
      method: req.method,
      path: req.originalUrl,
      requestId: req.id,
    });

    await logDeniedAccess(deps, req, resource, ownerId, "not_resource_owner");

    next(
      new ForbiddenError("You do not have permission to perform this action.", {
        details: {
          reason: "not_resource_owner",
          resource,
          ownerId,
        },
      }),
    );
  };

  return handler;
};
