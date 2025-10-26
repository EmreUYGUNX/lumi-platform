/* eslint-disable unicorn/consistent-function-scoping, @typescript-eslint/no-empty-function, unicorn/no-useless-undefined */
import express, { type NextFunction, type Request, type Response } from "express";
import request from "supertest";

import { ERROR_CODES, isAppError } from "@/lib/errors.js";
import { createChildLogger } from "@/lib/logger.js";
import { createAuthorizeResourceMiddleware } from "@/middleware/auth/authorizeResource.js";
import { createRequireAuthMiddleware } from "@/middleware/auth/requireAuth.js";
import { createRequirePermissionMiddleware } from "@/middleware/auth/requirePermission.js";
import { createRequireRoleMiddleware } from "@/middleware/auth/requireRole.js";
import type { RbacService } from "@/modules/auth/rbac.service.js";
import type { SecurityEventService } from "@/modules/auth/security-event.service.js";
import type { AuthenticatedUser } from "@/modules/auth/token.types.js";

interface RbacStubConfig {
  hasRole?: (userId: string, roles: string[]) => boolean;
  hasPermission?: (userId: string, permissions: string[]) => boolean;
}

const createRbacStub = (config: RbacStubConfig = {}): RbacService => {
  const resolveBoolean = (value: boolean | undefined, fallback: boolean) =>
    typeof value === "boolean" ? value : fallback;

  const stub = {
    async getUserRoles() {
      return [];
    },
    async getUserPermissions() {
      return [];
    },
    async hasRole(userId: string, roles: string[]) {
      const result = config.hasRole?.(userId, roles);
      return resolveBoolean(result, false);
    },
    async hasPermission(userId: string, permissions: string[]) {
      const result = config.hasPermission?.(userId, permissions);
      return resolveBoolean(result, false);
    },
    async assignRole() {},
    async revokeRole() {},
    async grantPermission() {},
    async revokePermission() {},
    async invalidateUserPermissions() {},
    async shutdown() {},
    prisma: undefined,
    cache: {
      async get() {
        return undefined;
      },
      async set() {},
      async delete() {},
      async shutdown() {},
    },
    logger: createChildLogger("test:rbac-stub"),
  } as Partial<RbacService>;

  return stub as unknown as RbacService;
};

const createUser = (overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser => {
  const id = overrides.id ?? "user_123";
  return {
    id,
    email: overrides.email ?? "user@example.com",
    roles: overrides.roles ?? [],
    permissions: overrides.permissions ?? [],
    sessionId: overrides.sessionId ?? "session_123",
    token: {
      sub: id,
      email: overrides.email ?? "user@example.com",
      roleIds: [],
      permissions: overrides.permissions ?? [],
      sessionId: overrides.sessionId ?? "session_123",
      jti: "token_123",
      iat: 0,
      exp: 0,
      ...overrides.token,
    },
    ...overrides,
  };
};

const createErrorHandler =
  () => (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (isAppError(error)) {
      res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.exposeDetails ? (error.details ?? {}) : undefined,
        },
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: {
        code: ERROR_CODES.INTERNAL,
        message: "Internal Server Error",
      },
    });
  };

describe("RBAC middleware integration", () => {
  let currentUser: AuthenticatedUser | undefined;

  const createSecurityEventStub = (): SecurityEventService =>
    ({
      async log() {},
    }) as unknown as SecurityEventService;

  const injectUser = () => (req: Request, _res: Response, next: NextFunction) => {
    if (currentUser) {
      (req as unknown as { user: AuthenticatedUser }).user = currentUser;
    }
    next();
  };

  beforeEach(() => {
    currentUser = undefined;
  });

  it("returns 401 for protected routes without authentication", async () => {
    const app = express();
    app.get("/protected", createRequireAuthMiddleware(), (_req, res) => {
      res.json({ success: true });
    });
    app.use(createErrorHandler());

    const response = await request(app).get("/protected").expect(401);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: ERROR_CODES.UNAUTHORIZED,
      },
    });
  });

  it("returns 403 when non-admin user accesses admin route", async () => {
    const rbac = createRbacStub({
      hasRole: () => false,
    });

    const app = express();
    app.use(injectUser());
    app.get(
      "/admin/users",
      createRequireAuthMiddleware(),
      createRequireRoleMiddleware(["admin"], {
        rbacService: rbac,
        securityEvents: createSecurityEventStub(),
      }),
      (_req, res) => {
        res.json({ success: true });
      },
    );
    app.use(createErrorHandler());

    currentUser = createUser({ id: "user_customer" });

    const response = await request(app)
      .get("/admin/users")
      .set("User-Agent", "JestAgent/1.0")
      .expect(403);

    expect(response.body.success).toBe(false);
    expect(response.body.error?.code).toBe(ERROR_CODES.FORBIDDEN);
  });

  it("allows admin users to access admin routes", async () => {
    const rbac = createRbacStub({
      hasRole: (_userId, roles) => roles.includes("admin"),
    });

    const app = express();
    app.use(injectUser());
    app.get(
      "/admin/users",
      createRequireAuthMiddleware(),
      createRequireRoleMiddleware(["admin"], {
        rbacService: rbac,
        securityEvents: createSecurityEventStub(),
      }),
      (_req, res) => {
        res.json({ success: true, data: { ok: true } });
      },
    );
    app.use(createErrorHandler());

    currentUser = createUser({
      id: "user_admin",
      roles: [{ id: "role_admin", name: "admin" }],
    });

    const response = await request(app)
      .get("/admin/users")
      .set("User-Agent", "JestAgent/1.0")
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      data: { ok: true },
    });
  });

  it("enforces resource-based authorization", async () => {
    const rbac = createRbacStub({
      hasRole: () => false,
    });

    const app = express();
    app.use(injectUser());
    app.delete(
      "/admin/resource/:id",
      createRequireAuthMiddleware(),
      createAuthorizeResourceMiddleware({
        resource: "admin_resource",
        allowAdminOverride: true,
        adminRoles: ["admin"],
        rbacService: rbac,
        securityEvents: createSecurityEventStub(),
        getOwnerId: () => "owner_123",
      }),
      (_req, res) => {
        res.json({ success: true });
      },
    );
    app.use(createErrorHandler());

    currentUser = createUser({ id: "other_user" });

    const denied = await request(app)
      .delete("/admin/resource/123")
      .set("User-Agent", "JestAgent/1.0")
      .expect(403);

    expect(denied.body.success).toBe(false);
    expect(denied.body.error?.code).toBe(ERROR_CODES.FORBIDDEN);

    currentUser = createUser({ id: "owner_123" });

    const granted = await request(app)
      .delete("/admin/resource/123")
      .set("User-Agent", "JestAgent/1.0")
      .expect(200);

    expect(granted.body.success).toBe(true);
  });

  it("guards permission-based routes", async () => {
    const rbac = createRbacStub({
      hasPermission: (userId, permissions) =>
        userId === "user_with_permission" && permissions.includes("report:read"),
    });

    const app = express();
    app.use(injectUser());
    app.get(
      "/admin/reports/sales",
      createRequireAuthMiddleware(),
      createRequirePermissionMiddleware(["report:read"], {
        rbacService: rbac,
        securityEvents: createSecurityEventStub(),
      }),
      (_req, res) => {
        res.json({ success: true, data: { report: "placeholder" } });
      },
    );
    app.use(createErrorHandler());

    currentUser = createUser({ id: "user_without_permission" });

    const denied = await request(app)
      .get("/admin/reports/sales")
      .set("User-Agent", "JestAgent/1.0")
      .expect(403);

    expect(denied.body.success).toBe(false);
    expect(denied.body.error?.code).toBe(ERROR_CODES.FORBIDDEN);

    currentUser = createUser({
      id: "user_with_permission",
      permissions: ["report:read"],
    });

    const granted = await request(app)
      .get("/admin/reports/sales")
      .set("User-Agent", "JestAgent/1.0")
      .expect(200);

    expect(granted.body).toMatchObject({
      success: true,
      data: { report: "placeholder" },
    });
  });
});
