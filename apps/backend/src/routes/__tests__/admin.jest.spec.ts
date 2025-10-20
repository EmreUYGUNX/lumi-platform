// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, describe, expect, it, jest } from "@jest/globals";
import express from "express";
import request from "supertest";
import Transport from "winston-transport";

import type { AccountSecurityService } from "@/modules/auth/account-security.service.js";
import type { SecurityEventService } from "@/modules/auth/security-event.service.js";

import { resetEnvironmentCache } from "../../config/env.js";
import { registerLogTransport, unregisterLogTransport } from "../../lib/logger.js";
import { registerErrorHandlers } from "../../middleware/errorHandler.js";
import { createRateLimiterBundle } from "../../middleware/rateLimiter.js";
import type { RbacService } from "../../modules/auth/rbac.service.js";
import * as RbacModule from "../../modules/auth/rbac.service.js";
import type { AccessTokenClaims, AuthenticatedUser } from "../../modules/auth/token.types.js";
import { createTestConfig } from "../../testing/config.js";
import { createAdminRouter } from "../admin.js";

const unlockAccountMock = jest.fn(() => Promise.resolve());
jest.mock("@/modules/auth/account-security.service.js", () => ({
  createAccountSecurityService: jest.fn(() => ({
    unlockUserAccount: unlockAccountMock,
  })),
}));

const securityEventLogMock = jest.fn(() => Promise.resolve());
jest.mock("@/modules/auth/security-event.service.js", () => ({
  createSecurityEventService: jest.fn(() => ({
    log: securityEventLogMock,
  })),
}));

const buildAdminRouterOptions = (): {
  securityEvents: SecurityEventService;
  accountSecurityService: AccountSecurityService;
} => ({
  securityEvents: {
    log: securityEventLogMock,
  } as unknown as SecurityEventService,
  accountSecurityService: {
    unlockUserAccount: unlockAccountMock,
  } as unknown as AccountSecurityService,
});

class MemoryTransport extends Transport {
  public readonly events: Record<string, unknown>[] = [];

  constructor(level = "warn") {
    super({ level });
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  override log(info: unknown, callback: () => void): void {
    this.events.push(info as Record<string, unknown>);
    callback();
  }
}

const createAccessTokenClaims = (
  overrides: Partial<AccessTokenClaims> = {},
): AccessTokenClaims => ({
  sub: overrides.sub ?? "user_1",
  email: overrides.email ?? "user@example.com",
  roleIds: overrides.roleIds ?? [],
  permissions: overrides.permissions ?? [],
  sessionId: overrides.sessionId ?? "session_123",
  jti: overrides.jti ?? "jti_123",
  iat: overrides.iat ?? Math.floor(Date.now() / 1000),
  exp: overrides.exp ?? Math.floor(Date.now() / 1000) + 900,
});

const createAuthenticatedUser = (overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser => {
  const token = createAccessTokenClaims({
    sub: overrides.id ?? "user_1",
    email: overrides.email ?? "user@example.com",
    sessionId: overrides.sessionId ?? "session_123",
    permissions: overrides.permissions ?? [],
    roleIds: overrides.roles?.map((role) => role.id) ?? [],
    ...overrides.token,
  });

  return {
    id: token.sub,
    email: token.email,
    roles: overrides.roles ?? [],
    permissions: overrides.permissions ?? [],
    sessionId: token.sessionId,
    token,
  };
};

const createRbacStub = (overrides: Partial<RbacService> = {}) => ({
  getUserRoles: jest.fn(async () => []),
  getUserPermissions: jest.fn(async () => []),
  hasRole: jest.fn(async () => false),
  hasPermission: jest.fn(async () => false),
  assignRole: jest.fn(async () => {}),
  revokeRole: jest.fn(async () => {}),
  grantPermission: jest.fn(async () => {}),
  revokePermission: jest.fn(async () => {}),
  invalidateUserPermissions: jest.fn(async () => {}),
  shutdown: jest.fn(async () => {}),
  ...overrides,
});

const parseResponseBody = (response: request.Response): Record<string, unknown> => {
  if (response.body && Object.keys(response.body).length > 0) {
    return response.body as Record<string, unknown>;
  }

  try {
    return JSON.parse(response.text ?? "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
};

afterEach(() => {
  resetEnvironmentCache();
  jest.restoreAllMocks();
  unlockAccountMock.mockReset();
  securityEventLogMock.mockReset();
});

describe("admin router placeholders", () => {
  it("returns 401 when requests are unauthenticated", async () => {
    const transportName = `admin-router-test-${Date.now()}`;
    const transport = new MemoryTransport("warn");
    registerLogTransport(transportName, transport);

    const config = createTestConfig({ app: { name: "Lumi Test Environment" } });
    const rateLimiterBundle = createRateLimiterBundle(config.security.rateLimit);
    const app = express();
    app.use(rateLimiterBundle.global);
    app.use(express.json());

    try {
      app.use("/admin", createAdminRouter(config, buildAdminRouterOptions()));
      registerErrorHandlers(app, config);

      const response = await request(app).get("/admin/users").expect(401);
      const payload = parseResponseBody(response);

      expect(payload).toMatchObject({
        success: false,
        error: { code: "UNAUTHORIZED" },
      });
      expect(payload.meta).toBeDefined();

      const logEntry = transport.events.find(
        (event) => event.level === "warn" && event.message === "Unauthenticated request blocked",
      );
      expect(logEntry?.metadata).toMatchObject({
        path: "/admin/users",
        method: "GET",
      });
    } finally {
      await rateLimiterBundle.cleanup();
      unregisterLogTransport(transportName);
    }
  });

  it("registers placeholder routes with the provided registrar", () => {
    const registerRoute = jest.fn();

    createAdminRouter(createTestConfig(), {
      registerRoute,
      ...buildAdminRouterOptions(),
    });

    expect(registerRoute).toHaveBeenCalledWith("GET", "/users");
    expect(registerRoute).toHaveBeenCalledWith("POST", "/users");
    expect(registerRoute).toHaveBeenCalledWith("POST", "/users/:userId/unlock");
    expect(registerRoute).toHaveBeenCalledWith("GET", "/audit-log");
    expect(registerRoute).toHaveBeenCalledWith("GET", "/reports/sales");
  });

  it("returns 403 when a non-admin user accesses admin routes", async () => {
    const transportName = `admin-router-test-${Date.now()}-non-admin`;
    const transport = new MemoryTransport("warn");
    registerLogTransport(transportName, transport);

    const config = createTestConfig({ app: { name: "Lumi Test Environment" } });
    const rateLimiterBundle = createRateLimiterBundle(config.security.rateLimit);
    const app = express();
    app.use(rateLimiterBundle.global);
    app.use(express.json());

    try {
      const rbacStub = createRbacStub();
      jest
        .spyOn(RbacModule, "getSharedRbacService")
        .mockReturnValue(rbacStub as unknown as RbacService);

      app.use((req, _res, next) => {
        req.user = createAuthenticatedUser({
          id: "user_customer",
          roles: [{ id: "role_customer", name: "customer" }],
        });
        next();
      });

      app.use("/admin", createAdminRouter(config, buildAdminRouterOptions()));
      registerErrorHandlers(app, config);

      const response = await request(app).get("/admin/users").expect(403);
      const payload = parseResponseBody(response);

      expect(payload.error).toMatchObject({ code: "FORBIDDEN" });

      const logEntry = transport.events.find(
        (event) =>
          event.level === "warn" &&
          event.message === "Role-based access denied" &&
          (event.metadata as Record<string, unknown>)?.component === "middleware:auth:require-role",
      );
      expect(logEntry?.metadata).toMatchObject({
        requiredRoles: ["admin"],
        path: "/admin/users",
        method: "GET",
      });
    } finally {
      await rateLimiterBundle.cleanup();
      unregisterLogTransport(transportName);
    }
  });

  it("allows administrators with reporting permission to access placeholder endpoints", async () => {
    const config = createTestConfig();
    const rateLimiterBundle = createRateLimiterBundle(config.security.rateLimit);
    const app = express();
    app.use(rateLimiterBundle.global);
    app.use(express.json());

    const rbacStub = createRbacStub({
      hasRole: jest.fn(async () => true),
      hasPermission: jest.fn(async () => true),
    });
    jest
      .spyOn(RbacModule, "getSharedRbacService")
      .mockReturnValue(rbacStub as unknown as RbacService);

    // codeql[js/missing-rate-limiting]: Test harness injects a stub user before mounting the already rate-limited admin router.
    app.use((req, _res, next) => {
      req.user = createAuthenticatedUser({
        id: "user_admin",
        roles: [{ id: "role_admin", name: "admin" }],
        permissions: ["report:read"],
      });
      next();
    });

    app.use("/admin", createAdminRouter(config, buildAdminRouterOptions()));
    registerErrorHandlers(app, config);

    const response = await request(app).get("/admin/reports/sales").expect(200);
    const payload = parseResponseBody(response);

    expect(payload).toMatchObject({
      success: true,
      data: {
        message: expect.stringContaining("Sales reporting will be introduced"),
      },
    });

    await rateLimiterBundle.cleanup();
  });

  it("allows administrators to unlock user accounts manually", async () => {
    const config = createTestConfig();
    const rateLimiterBundle = createRateLimiterBundle(config.security.rateLimit);
    const app = express();
    app.use(rateLimiterBundle.global);
    app.use(express.json());

    const rbacStub = createRbacStub({
      hasRole: jest.fn(async () => true),
    });
    jest
      .spyOn(RbacModule, "getSharedRbacService")
      .mockReturnValue(rbacStub as unknown as RbacService);

    app.use((req, _res, next) => {
      req.user = createAuthenticatedUser({
        id: "admin_1",
        roles: [{ id: "role_admin", name: "admin" }],
      });
      next();
    });

    app.use("/admin", createAdminRouter(config, buildAdminRouterOptions()));
    registerErrorHandlers(app, config);

    try {
      const response = await request(app)
        .post("/admin/users/user_42/unlock")
        .set("user-agent", "JestAgent/1.0")
        .set("content-type", "application/json")
        .send(JSON.stringify({ reason: "support reset" }))
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          message: expect.stringContaining("unlocked"),
        },
      });

      expect(unlockAccountMock).toHaveBeenCalledWith({
        userId: "user_42",
        performedBy: "admin_1",
        reason: "support reset",
        ipAddress: expect.any(String),
        userAgent: "JestAgent/1.0",
      });
      expect(securityEventLogMock).toHaveBeenCalled();
    } finally {
      await rateLimiterBundle.cleanup();
    }
  });

  it("logs each unauthorised attempt with request metadata", async () => {
    const transportName = `admin-router-test-${Date.now()}-meta`;
    const transport = new MemoryTransport("warn");
    registerLogTransport(transportName, transport);

    const config = createTestConfig({ app: { name: "Lumi Test Environment" } });
    const rateLimiterBundle = createRateLimiterBundle(config.security.rateLimit);
    const app = express();
    app.use(rateLimiterBundle.global);
    app.use(express.json());

    try {
      app.use("/admin", createAdminRouter(config, buildAdminRouterOptions()));
      registerErrorHandlers(app, config);

      await request(app)
        .get("/admin/reports/sales")
        .set("X-Forwarded-For", "203.0.113.1")
        .expect(401);

      const logEntry = transport.events.find(
        (event) => event.level === "warn" && event.message === "Unauthenticated request blocked",
      );

      expect(logEntry?.metadata).toMatchObject({
        method: "GET",
        path: "/admin/reports/sales",
      });
    } finally {
      await rateLimiterBundle.cleanup();
      unregisterLogTransport(transportName);
    }
  });
});
