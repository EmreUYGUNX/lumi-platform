import type { RequestHandler } from "express";

import { ForbiddenError, UnauthorizedError } from "@/lib/errors.js";
import { createChildLogger, mergeRequestContext } from "@/lib/logger.js";
import { type RbacService, getSharedRbacService } from "@/modules/auth/rbac.service.js";

export interface AuthorizeResourceOptions {
  getOwnerId: (
    req: Parameters<RequestHandler>[0],
  ) => Promise<string | undefined> | string | undefined;
  resource?: string;
  allowAdminOverride?: boolean;
  adminRoles?: string[];
  rbacService?: RbacService;
  logger?: ReturnType<typeof createChildLogger>;
}

const DEFAULT_ADMIN_ROLES = ["admin"] as const;

interface OwnerResolutionContext {
  readonly req: Parameters<RequestHandler>[0];
  readonly resource: string;
  readonly logger: ReturnType<typeof createChildLogger>;
}

interface AdminOverrideContext {
  readonly req: Parameters<RequestHandler>[0];
  readonly roles: string[];
  readonly rbacService: RbacService;
  readonly allowAdminOverride: boolean;
}

type ResolutionOutcome = "handled" | "continue";

const handleMissingUser = (
  logger: ReturnType<typeof createChildLogger>,
  req: Parameters<RequestHandler>[0],
  next: Parameters<RequestHandler>[2],
) => {
  next(
    new UnauthorizedError("Authentication required.", {
      details: { reason: "authentication_required" },
    }),
  );

  logger.warn("Unauthenticated access attempt", {
    path: req.originalUrl,
    method: req.method,
    requestId: req.id,
  });
};

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

const evaluateAdminOverride = async (
  ctx: AdminOverrideContext,
  next: Parameters<RequestHandler>[2],
): Promise<ResolutionOutcome | "granted"> => {
  if (!ctx.allowAdminOverride || ctx.roles.length === 0) {
    return "continue";
  }

  try {
    const hasAdminRole = await ctx.rbacService.hasRole(ctx.req.user!.id, ctx.roles);
    return hasAdminRole ? "granted" : "continue";
  } catch (error) {
    next(error);
    return "handled";
  }
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
  } = options;

  if (typeof getOwnerId !== "function") {
    throw new TypeError("createAuthorizeResourceMiddleware requires a getOwnerId function.");
  }

  const rbacService = providedRbacService ?? getSharedRbacService();
  const logger = providedLogger ?? createChildLogger("middleware:auth:authorize-resource");
  const normalisedAdminRoles = adminRoles.map((role) => role.toLowerCase());

  const handler: RequestHandler = async (req, _res, next) => {
    if (!req.user) {
      handleMissingUser(logger, req, next);
      return;
    }

    mergeRequestContext({ userId: req.user.id });

    const ownerResolution = await resolveOwnerId({ req, resource, logger }, getOwnerId, next);
    if (ownerResolution.outcome !== "continue") {
      return;
    }

    const { ownerId } = ownerResolution;
    if (!ownerId) {
      return;
    }

    if (req.user.id === ownerId) {
      next();
      return;
    }

    const adminOverrideResult = await evaluateAdminOverride(
      {
        req,
        roles: normalisedAdminRoles,
        rbacService,
        allowAdminOverride,
      },
      next,
    );
    if (adminOverrideResult === "handled") {
      return;
    }

    if (adminOverrideResult === "granted") {
      next();
      return;
    }

    logger.warn("Resource access denied", {
      userId: req.user.id,
      resource,
      ownerId,
      method: req.method,
      path: req.originalUrl,
      requestId: req.id,
    });

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
