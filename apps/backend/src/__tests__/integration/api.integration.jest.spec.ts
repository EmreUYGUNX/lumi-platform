import { describe, expect, it } from "@jest/globals";
import request from "supertest";

import type { RbacService } from "../../modules/auth/rbac.service.js";
import * as RbacModule from "../../modules/auth/rbac.service.js";
import type { TokenService } from "../../modules/auth/token.service.js";
import * as TokenServiceModule from "../../modules/auth/token.service.js";
import type {
  AccessTokenClaims,
  AuthenticatedUser,
  RequestAuthState,
} from "../../modules/auth/token.types.js";
import { registerRoute } from "../../routes/registry.js";
import { createTestApp, withTestApp } from "../../testing/index.js";

const encodeBasicAuth = (username: string, password: string) => {
  const credentials = `${username}:${password}`;
  const encoded = Buffer.from(credentials).toString("base64");
  return `Basic ${encoded}`;
};

const METRICS_AUTH = {
  username: "metrics-user",
  password: "metrics-pass",
} as const;

const tokenServiceStub = {
  verifyAccessToken: jest.fn<Promise<AccessTokenClaims>, [string]>(),
  fetchAuthenticatedUser: jest.fn<Promise<AuthenticatedUser>, [AccessTokenClaims]>(),
  createRequestAuthState: jest.fn<
    RequestAuthState,
    [AccessTokenClaims | undefined, Partial<RequestAuthState>]
  >(),
  shutdown: jest.fn(async () => {}),
} as unknown as TokenService;

const rbacServiceStub = {
  hasRole: jest.fn(async () => false),
  hasPermission: jest.fn(async () => false),
  getUserRoles: jest.fn(async () => []),
  getUserPermissions: jest.fn(async () => []),
  assignRole: jest.fn(async () => {}),
  revokeRole: jest.fn(async () => {}),
  grantPermission: jest.fn(async () => {}),
  revokePermission: jest.fn(async () => {}),
  invalidateUserPermissions: jest.fn(async () => {}),
  shutdown: jest.fn(async () => {}),
} as unknown as RbacService;

const tokenServiceMocks = tokenServiceStub as unknown as jest.Mocked<TokenService>;
const rbacServiceMocks = rbacServiceStub as unknown as jest.Mocked<RbacService>;

beforeAll(() => {
  jest.spyOn(TokenServiceModule, "createTokenService").mockReturnValue(tokenServiceStub);
  jest.spyOn(RbacModule, "getSharedRbacService").mockReturnValue(rbacServiceStub);
});

afterAll(() => {
  jest.restoreAllMocks();
});

beforeEach(() => {
  jest.clearAllMocks();
  tokenServiceMocks.createRequestAuthState.mockImplementation((accessToken, overrides = {}) => ({
    ...overrides,
    accessToken,
  }));
});

const buildAccessTokenClaims = (overrides: Partial<AccessTokenClaims> = {}): AccessTokenClaims => ({
  sub: "user_admin",
  email: "admin@example.com",
  roleIds: [],
  permissions: [],
  sessionId: "session_123",
  jti: "jti-123",
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 900,
  ...overrides,
});

const buildAuthenticatedUser = (
  claims: AccessTokenClaims,
  overrides: Partial<AuthenticatedUser> = {},
): AuthenticatedUser => ({
  id: claims.sub,
  email: claims.email,
  roles: [],
  permissions: [],
  sessionId: claims.sessionId,
  token: claims,
  ...overrides,
});

describe("express application integration", () => {
  it("returns a health snapshot with Q2 response structure", async () => {
    await withTestApp(async ({ app }) => {
      const response = await request(app).get("/api/v1/health").expect(200);

      expect(response.body.success).toBe(true);
      expect(typeof response.body.data.status).toBe("string");
      expect(response.body.data.components).toBeDefined();
      expect(response.body.meta).toEqual(
        expect.objectContaining({
          environment: expect.any(String),
        }),
      );

      if (typeof response.body.meta.generatedAt === "string") {
        expect(new Date(response.body.meta.generatedAt).toString()).not.toBe("Invalid Date");
      }
    });
  });

  it("guards metrics behind basic authentication", async () => {
    await withTestApp(
      async ({ app }) => {
        await request(app).get("/api/v1/health").expect(200);

        const unauthenticated = await request(app).get("/internal/metrics").expect(401);
        expect(unauthenticated.body.success).toBe(false);
        expect(unauthenticated.body.error.code).toBe("UNAUTHORIZED");
        expect(unauthenticated.headers["www-authenticate"]).toContain("Basic realm");

        const authorised = await request(app)
          .get("/internal/metrics")
          .set("Authorization", encodeBasicAuth(METRICS_AUTH.username, METRICS_AUTH.password));

        expect([200, 204, 503]).toContain(authorised.status);

        if (authorised.status === 200) {
          expect(authorised.headers["content-type"]).toContain("text/plain");
          expect(authorised.text.length).toBeGreaterThan(0);
        } else if (authorised.status === 204) {
          expect(authorised.text).toBe("");
        } else {
          expect(authorised.status).toBe(503);
          expect(authorised.body.success).toBe(false);
          expect(authorised.body.error.code).toBe("METRICS_DISABLED");
        }
      },
      {
        configOverrides: {
          observability: {
            metrics: {
              basicAuth: {
                username: METRICS_AUTH.username,
                password: METRICS_AUTH.password,
              },
            },
          },
        },
      },
    );
  });

  it("emits Q2 compliant payloads for unknown routes", async () => {
    await withTestApp(async ({ app }) => {
      const response = await request(app).get("/api/v1/unknown-resource").expect(404);

      expect(response.body).toEqual(
        expect.objectContaining({
          success: false,
          error: {
            code: "NOT_FOUND",
            message: expect.any(String),
          },
        }),
      );
    });
  });

  it("captures thrown errors and returns sanitised responses", async () => {
    const context = createTestApp();

    try {
      const { app } = context;
      const registry = app.get("routeRegistry");

      if (registry) {
        registerRoute(registry, "GET", "/api/v1/testing/error");
      }

      app.get("/api/v1/testing/error", () => {
        throw new Error("integration explosion");
      });

      const refreshHandlers = app.get("refreshErrorHandlers") as (() => void) | undefined;
      refreshHandlers?.();

      const response = await request(app).get("/api/v1/testing/error").expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
      expect(response.body.error).not.toHaveProperty("stack");
    } finally {
      await context.cleanup();
    }
  });

  it("returns 401 for admin endpoints when unauthenticated", async () => {
    await withTestApp(async ({ app }) => {
      const response = await request(app).get("/api/v1/admin/users").expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  it("returns 403 for admin endpoints when user lacks the admin role", async () => {
    const claims = buildAccessTokenClaims({ sub: "user_customer", roleIds: ["role_customer"] });
    const user = buildAuthenticatedUser(claims, {
      roles: [{ id: "role_customer", name: "customer" }],
    });

    tokenServiceMocks.verifyAccessToken.mockResolvedValueOnce(claims);
    tokenServiceMocks.fetchAuthenticatedUser.mockResolvedValueOnce(user);
    rbacServiceMocks.hasRole.mockResolvedValueOnce(false);

    await withTestApp(async ({ app }) => {
      const response = await request(app)
        .get("/api/v1/admin/users")
        .set("Authorization", "Bearer test-token")
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("FORBIDDEN");
      expect(rbacServiceMocks.hasRole).toHaveBeenCalledWith("user_customer", ["admin"]);
    });
  });

  it("allows admin users with reporting permission to access sales reports", async () => {
    const claims = buildAccessTokenClaims({
      sub: "user_admin",
      roleIds: ["role_admin"],
      permissions: ["report:read"],
    });
    const user = buildAuthenticatedUser(claims, {
      roles: [{ id: "role_admin", name: "admin" }],
      permissions: ["report:read"],
    });

    tokenServiceMocks.verifyAccessToken.mockResolvedValueOnce(claims);
    tokenServiceMocks.fetchAuthenticatedUser.mockResolvedValueOnce(user);
    rbacServiceMocks.hasRole.mockResolvedValue(true);
    rbacServiceMocks.hasPermission.mockResolvedValue(true);

    await withTestApp(async ({ app }) => {
      const response = await request(app)
        .get("/api/v1/admin/reports/sales")
        .set("Authorization", "Bearer admin-token")
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain("Sales reporting will be introduced");
      expect(rbacServiceMocks.hasPermission).toHaveBeenCalledWith("user_admin", ["report:read"]);
    });
  });
});
