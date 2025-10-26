import { describe, expect, it, jest } from "@jest/globals";
import type { NextFunction, Request, Response } from "express";

import { ForbiddenError, UnauthorizedError } from "@/lib/errors.js";
import type { RbacService } from "@/modules/auth/rbac.service.js";
import type { SecurityEventService } from "@/modules/auth/security-event.service.js";
import type { AccessTokenClaims, AuthenticatedUser } from "@/modules/auth/token.types.js";

import { createAuthorizeResourceMiddleware } from "../authorizeResource.js";
import { createRequireAuthMiddleware } from "../requireAuth.js";
import { createRequirePermissionMiddleware } from "../requirePermission.js";
import { createRequireRoleMiddleware } from "../requireRole.js";

const createMockRequest = (overrides: Partial<Request> = {}): Request => {
  const headers = (overrides as Record<string, unknown>).headers as
    | Record<string, string>
    | undefined;

  return {
    method: "GET",
    originalUrl: "/admin/test",
    id: "req-123",
    ip: overrides.ip ?? "203.0.113.10",
    get: (name: string) => headers?.[name.toLowerCase()],
    res: { locals: {} as Record<string, unknown> },
    ...overrides,
  } as unknown as Request;
};

const createMockResponse = (): Response =>
  ({ locals: {} as Record<string, unknown> }) as unknown as Response;

const createNext = () => {
  const mock = jest.fn();
  return {
    handler: mock as unknown as NextFunction,
    mock,
  };
};

const createAccessTokenClaims = (
  overrides: Partial<AccessTokenClaims> = {},
): AccessTokenClaims => ({
  sub: "user_1",
  email: "user@example.com",
  roleIds: [],
  permissions: [],
  sessionId: "session_123",
  jti: "jti_123",
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 900,
  ...overrides,
});

const createAuthenticatedUser = (overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser => {
  const claims = createAccessTokenClaims({
    sub: overrides.id ?? "user_1",
    email: overrides.email ?? "user@example.com",
    sessionId: overrides.sessionId ?? "session_123",
    ...overrides.token,
  });

  return {
    id: claims.sub,
    email: claims.email,
    roles: [],
    permissions: [],
    sessionId: claims.sessionId,
    token: claims,
    ...overrides,
  };
};

const createRbacStub = (): RbacService =>
  ({
    hasRole: jest.fn(async () => false),
    hasPermission: jest.fn(async () => false),
    shutdown: jest.fn(async () => {}),
    invalidateUserPermissions: jest.fn(async () => {}),
    getUserRoles: jest.fn(async () => []),
    getUserPermissions: jest.fn(async () => []),
    assignRole: jest.fn(async () => {}),
    revokeRole: jest.fn(async () => {}),
    grantPermission: jest.fn(async () => {}),
    revokePermission: jest.fn(async () => {}),
  }) as unknown as RbacService;

const createSecurityEventsStub = (): SecurityEventService =>
  ({
    log: jest.fn(() => Promise.resolve()),
  }) as unknown as SecurityEventService;

describe("auth middlewares", () => {
  describe("requireAuth", () => {
    it("passes through when a user is present", () => {
      const middleware = createRequireAuthMiddleware();
      const req = createMockRequest({
        user: createAuthenticatedUser(),
      });
      const res = createMockResponse();
      const next = createNext();

      middleware(req, res, next.handler);

      expect(next.mock).toHaveBeenCalledTimes(1);
    });

    it("emits UnauthorizedError when user is missing", () => {
      const middleware = createRequireAuthMiddleware();
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createNext();

      middleware(req, res, next.handler);

      const [maybeError] = next.mock.mock.calls[0] ?? [];
      const error = maybeError as Error | undefined;
      expect(error).toBeInstanceOf(UnauthorizedError);
      if (error instanceof UnauthorizedError) {
        expect(error.details).toEqual({ reason: "unauthenticated" });
      }
    });
  });

  describe("requireRole", () => {
    it("allows requests when RBAC service confirms role membership", async () => {
      const rbac = createRbacStub();
      rbac.hasRole = jest.fn(async () => true);
      const securityEvents = createSecurityEventsStub();
      const middleware = createRequireRoleMiddleware(["admin"], {
        rbacService: rbac,
        securityEvents,
      });
      const req = createMockRequest({ user: createAuthenticatedUser() });
      const res = createMockResponse();
      const next = createNext();

      await middleware(req, res, next.handler);

      expect(rbac.hasRole).toHaveBeenCalledWith("user_1", ["admin"]);
      expect(next.mock).toHaveBeenCalledTimes(1);
      expect(securityEvents.log).not.toHaveBeenCalled();
    });

    it("rejects requests lacking required roles", async () => {
      const rbac = createRbacStub();
      const securityEvents = createSecurityEventsStub();
      const middleware = createRequireRoleMiddleware(["admin"], {
        rbacService: rbac,
        securityEvents,
      });
      const req = createMockRequest({ user: createAuthenticatedUser() });
      const res = createMockResponse();
      const next = createNext();

      await middleware(req, res, next.handler);

      const [maybeError] = next.mock.mock.calls[0] ?? [];
      const error = maybeError as Error | undefined;
      expect(error).toBeInstanceOf(ForbiddenError);
      if (error instanceof ForbiddenError) {
        expect(error.details).toEqual({
          reason: "role_required",
          requiredRoles: ["admin"],
        });
      }
      expect(securityEvents.log).toHaveBeenCalledWith({
        type: "role_denied",
        userId: "user_1",
        ipAddress: req.ip,
        userAgent: undefined,
        payload: {
          requiredRoles: ["admin"],
          method: "GET",
          path: "/admin/test",
          requestId: "req-123",
        },
        severity: "warning",
      });
    });
  });

  describe("requirePermission", () => {
    it("allows requests when RBAC service confirms permission", async () => {
      const rbac = createRbacStub();
      rbac.hasPermission = jest.fn(async () => true);
      const securityEvents = createSecurityEventsStub();
      const middleware = createRequirePermissionMiddleware(["catalog:write"], {
        rbacService: rbac,
        securityEvents,
      });
      const req = createMockRequest({ user: createAuthenticatedUser() });
      const res = createMockResponse();
      const next = createNext();

      await middleware(req, res, next.handler);

      expect(rbac.hasPermission).toHaveBeenCalledWith("user_1", ["catalog:write"]);
      expect(next.mock).toHaveBeenCalledTimes(1);
      expect(securityEvents.log).not.toHaveBeenCalled();
    });

    it("emits ForbiddenError when permission is missing", async () => {
      const rbac = createRbacStub();
      const securityEvents = createSecurityEventsStub();
      const middleware = createRequirePermissionMiddleware(["catalog:write"], {
        rbacService: rbac,
        securityEvents,
      });
      const req = createMockRequest({ user: createAuthenticatedUser() });
      const res = createMockResponse();
      const next = createNext();

      await middleware(req, res, next.handler);

      const [maybeError] = next.mock.mock.calls[0] ?? [];
      const error = maybeError as Error | undefined;
      expect(error).toBeInstanceOf(ForbiddenError);
      if (error instanceof ForbiddenError) {
        expect(error.details).toEqual({
          reason: "permission_required",
          requiredPermissions: ["catalog:write"],
        });
      }
      expect(securityEvents.log).toHaveBeenCalledWith({
        type: "permission_denied",
        userId: "user_1",
        ipAddress: req.ip,
        userAgent: undefined,
        payload: {
          requiredPermissions: ["catalog:write"],
          method: "GET",
          path: "/admin/test",
          requestId: "req-123",
        },
        severity: "warning",
      });
    });

    it("bypasses permission checks when no permissions are declared", async () => {
      const rbac = createRbacStub();
      const securityEvents = createSecurityEventsStub();
      const middleware = createRequirePermissionMiddleware([], {
        rbacService: rbac,
        securityEvents,
      });
      const req = createMockRequest({ user: createAuthenticatedUser() });
      const res = createMockResponse();
      const next = createNext();

      await middleware(req, res, next.handler);

      expect(next.mock).toHaveBeenCalledTimes(1);
      expect(rbac.hasPermission).not.toHaveBeenCalled();
      expect(securityEvents.log).not.toHaveBeenCalled();
    });

    it("emits UnauthorizedError when user context is missing", async () => {
      const rbac = createRbacStub();
      const securityEvents = createSecurityEventsStub();
      const middleware = createRequirePermissionMiddleware(["catalog:write"], {
        rbacService: rbac,
        securityEvents,
      });
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createNext();

      await middleware(req, res, next.handler);

      const [maybeError] = next.mock.mock.calls[0] ?? [];
      const error = maybeError as Error | undefined;
      expect(error).toBeInstanceOf(UnauthorizedError);
      if (error instanceof UnauthorizedError) {
        expect(error.details).toEqual({ reason: "authentication_required" });
      }
      expect(rbac.hasPermission).not.toHaveBeenCalled();
      expect(securityEvents.log).not.toHaveBeenCalled();
    });
  });

  describe("authorizeResource", () => {
    it("allows owners to access their own resources", async () => {
      const securityEvents = createSecurityEventsStub();
      const middleware = createAuthorizeResourceMiddleware({
        getOwnerId: () => "user_1",
        securityEvents,
      });
      const req = createMockRequest({ user: createAuthenticatedUser() });
      const res = createMockResponse();
      const next = createNext();

      await middleware(req, res, next.handler);

      expect(next.mock).toHaveBeenCalledTimes(1);
      expect(securityEvents.log).not.toHaveBeenCalled();
    });

    it("allows administrators to override ownership checks", async () => {
      const rbac = createRbacStub();
      rbac.hasRole = jest.fn(async () => true);
      const securityEvents = createSecurityEventsStub();
      const middleware = createAuthorizeResourceMiddleware({
        getOwnerId: () => "resource-owner",
        rbacService: rbac,
        adminRoles: ["admin"],
        securityEvents,
      });
      const req = createMockRequest({ user: createAuthenticatedUser() });
      const res = createMockResponse();
      const next = createNext();

      await middleware(req, res, next.handler);

      expect(rbac.hasRole).toHaveBeenCalledWith("user_1", ["admin"]);
      expect(next.mock).toHaveBeenCalledTimes(1);
      expect(securityEvents.log).not.toHaveBeenCalled();
    });

    it("rejects requests when ownership does not match and no admin override exists", async () => {
      const securityEvents = createSecurityEventsStub();
      const middleware = createAuthorizeResourceMiddleware({
        getOwnerId: () => "resource-owner",
        allowAdminOverride: false,
        securityEvents,
      });
      const req = createMockRequest({ user: createAuthenticatedUser() });
      const res = createMockResponse();
      const next = createNext();

      await middleware(req, res, next.handler);

      const [maybeError] = next.mock.mock.calls[0] ?? [];
      const error = maybeError as Error | undefined;
      expect(error).toBeInstanceOf(ForbiddenError);
      if (error instanceof ForbiddenError) {
        expect(error.details).toEqual({
          reason: "not_resource_owner",
          resource: "resource",
          ownerId: "resource-owner",
        });
      }
      expect(securityEvents.log).toHaveBeenCalledWith({
        type: "permission_denied",
        userId: "user_1",
        ipAddress: req.ip,
        userAgent: undefined,
        payload: {
          reason: "not_resource_owner",
          resource: "resource",
          ownerId: "resource-owner",
          method: "GET",
          path: "/admin/test",
          requestId: "req-123",
        },
        severity: "warning",
      });
    });

    it("emits UnauthorizedError when user context is missing", async () => {
      const securityEvents = createSecurityEventsStub();
      const middleware = createAuthorizeResourceMiddleware({
        getOwnerId: () => "owner",
        securityEvents,
      });
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createNext();

      await middleware(req, res, next.handler);

      const [maybeError] = next.mock.mock.calls[0] ?? [];
      const error = maybeError as Error | undefined;
      expect(error).toBeInstanceOf(UnauthorizedError);
      if (error instanceof UnauthorizedError) {
        expect(error.details).toEqual({ reason: "authentication_required" });
      }
      expect(securityEvents.log).toHaveBeenCalledWith({
        type: "permission_denied",
        ipAddress: req.ip,
        userAgent: undefined,
        payload: {
          reason: "authentication_required",
          method: "GET",
          path: "/admin/test",
          requestId: "req-123",
        },
        severity: "warning",
      });
    });

    it("invokes next with errors thrown during ownership resolution", async () => {
      const ownershipError = new Error("lookup failed");
      const securityEvents = createSecurityEventsStub();
      const middleware = createAuthorizeResourceMiddleware({
        getOwnerId: () => {
          throw ownershipError;
        },
        securityEvents,
      });
      const req = createMockRequest({ user: createAuthenticatedUser() });
      const res = createMockResponse();
      const next = createNext();

      await middleware(req, res, next.handler);

      expect(next.mock).toHaveBeenCalledWith(ownershipError);
      expect(securityEvents.log).not.toHaveBeenCalled();
    });

    it("rejects when ownership cannot be determined", async () => {
      const securityEvents = createSecurityEventsStub();
      const middleware = createAuthorizeResourceMiddleware({
        getOwnerId: () => undefined as unknown as string | undefined,
        securityEvents,
      });
      const req = createMockRequest({ user: createAuthenticatedUser() });
      const res = createMockResponse();
      const next = createNext();

      await middleware(req, res, next.handler);

      const [maybeError] = next.mock.mock.calls[0] ?? [];
      const error = maybeError as Error | undefined;
      expect(error).toBeInstanceOf(ForbiddenError);
      if (error instanceof ForbiddenError) {
        expect(error.details).toMatchObject({
          reason: "resource_owner_unresolved",
          resource: "resource",
        });
      }
      expect(securityEvents.log).not.toHaveBeenCalled();
    });

    it("propagates RBAC errors during admin override checks", async () => {
      const rbac = createRbacStub();
      const rbacError = new Error("rbac failure");
      rbac.hasRole = jest.fn(async () => {
        throw rbacError;
      });
      const securityEvents = createSecurityEventsStub();
      const middleware = createAuthorizeResourceMiddleware({
        getOwnerId: () => "other-user",
        rbacService: rbac,
        adminRoles: ["admin"],
        securityEvents,
      });
      const req = createMockRequest({ user: createAuthenticatedUser() });
      const res = createMockResponse();
      const next = createNext();

      await middleware(req, res, next.handler);

      expect(rbac.hasRole).toHaveBeenCalledWith("user_1", ["admin"]);
      expect(next.mock).toHaveBeenCalledWith(rbacError);
      expect(securityEvents.log).not.toHaveBeenCalled();
    });
  });
});
