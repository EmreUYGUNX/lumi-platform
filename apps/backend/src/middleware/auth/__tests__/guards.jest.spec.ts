import { describe, expect, it, jest } from "@jest/globals";
import type { NextFunction, Request, Response } from "express";

import { ForbiddenError, UnauthorizedError } from "@/lib/errors.js";
import type { RbacService } from "@/modules/auth/rbac.service.js";
import type { AccessTokenClaims, AuthenticatedUser } from "@/modules/auth/token.types.js";

import { createAuthorizeResourceMiddleware } from "../authorizeResource.js";
import { createRequireAuthMiddleware } from "../requireAuth.js";
import { createRequirePermissionMiddleware } from "../requirePermission.js";
import { createRequireRoleMiddleware } from "../requireRole.js";

const createMockRequest = (overrides: Partial<Request> = {}): Request =>
  ({
    method: "GET",
    originalUrl: "/admin/test",
    id: "req-123",
    res: { locals: {} as Record<string, unknown> },
    ...overrides,
  }) as unknown as Request;

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
      const middleware = createRequireRoleMiddleware(["admin"], { rbacService: rbac });
      const req = createMockRequest({ user: createAuthenticatedUser() });
      const res = createMockResponse();
      const next = createNext();

      await middleware(req, res, next.handler);

      expect(rbac.hasRole).toHaveBeenCalledWith("user_1", ["admin"]);
      expect(next.mock).toHaveBeenCalledTimes(1);
    });

    it("rejects requests lacking required roles", async () => {
      const rbac = createRbacStub();
      const middleware = createRequireRoleMiddleware(["admin"], { rbacService: rbac });
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
    });
  });

  describe("requirePermission", () => {
    it("allows requests when RBAC service confirms permission", async () => {
      const rbac = createRbacStub();
      rbac.hasPermission = jest.fn(async () => true);
      const middleware = createRequirePermissionMiddleware(["catalog:write"], {
        rbacService: rbac,
      });
      const req = createMockRequest({ user: createAuthenticatedUser() });
      const res = createMockResponse();
      const next = createNext();

      await middleware(req, res, next.handler);

      expect(rbac.hasPermission).toHaveBeenCalledWith("user_1", ["catalog:write"]);
      expect(next.mock).toHaveBeenCalledTimes(1);
    });

    it("emits ForbiddenError when permission is missing", async () => {
      const rbac = createRbacStub();
      const middleware = createRequirePermissionMiddleware(["catalog:write"], {
        rbacService: rbac,
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
    });
  });

  describe("authorizeResource", () => {
    it("allows owners to access their own resources", async () => {
      const middleware = createAuthorizeResourceMiddleware({
        getOwnerId: () => "user_1",
      });
      const req = createMockRequest({ user: createAuthenticatedUser() });
      const res = createMockResponse();
      const next = createNext();

      await middleware(req, res, next.handler);

      expect(next.mock).toHaveBeenCalledTimes(1);
    });

    it("allows administrators to override ownership checks", async () => {
      const rbac = createRbacStub();
      rbac.hasRole = jest.fn(async () => true);
      const middleware = createAuthorizeResourceMiddleware({
        getOwnerId: () => "resource-owner",
        rbacService: rbac,
        adminRoles: ["admin"],
      });
      const req = createMockRequest({ user: createAuthenticatedUser() });
      const res = createMockResponse();
      const next = createNext();

      await middleware(req, res, next.handler);

      expect(rbac.hasRole).toHaveBeenCalledWith("user_1", ["admin"]);
      expect(next.mock).toHaveBeenCalledTimes(1);
    });

    it("rejects requests when ownership does not match and no admin override exists", async () => {
      const middleware = createAuthorizeResourceMiddleware({
        getOwnerId: () => "resource-owner",
        allowAdminOverride: false,
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
    });
  });
});
