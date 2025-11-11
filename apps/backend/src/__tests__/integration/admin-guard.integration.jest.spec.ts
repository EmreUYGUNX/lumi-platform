import { afterEach, describe, expect, it, jest } from "@jest/globals";
import type { NextFunction, Request, RequestHandler } from "express";
import request from "supertest";

import type { AuditLogEntry } from "@/audit/audit-log.service.js";
import type * as ErrorsModule from "@/lib/errors.js";
import type { AuthenticatedUser } from "@/modules/auth/token.types.js";
import type { CatalogService } from "@/modules/catalog/catalog.service.js";
import { withTestApp } from "@/testing/index.js";

const roleGuardState = {
  enforce: true,
};

const auditLogInvocations: AuditLogEntry[] = [];

const parseAuthHeader = (req: Request): AuthenticatedUser | undefined => {
  const header = req.get("x-auth-user");
  if (!header) {
    return undefined;
  }

  try {
    const payload = JSON.parse(header) as Partial<AuthenticatedUser> & Record<string, unknown>;
    const roles = payload.roles ?? [];
    return {
      id: payload.id ?? "user-admin",
      email: payload.email ?? "admin@example.com",
      sessionId: payload.sessionId ?? "sess-admin",
      roles,
      permissions: payload.permissions ?? [],
      token:
        payload.token ??
        ({
          sub: payload.id ?? "user-admin",
          email: payload.email ?? "admin@example.com",
          roleIds: roles.map((role) => role.id),
          permissions: payload.permissions ?? [],
          sessionId: payload.sessionId ?? "sess-admin",
          jti: "admin-guard",
          iat: 0,
          exp: 0,
        } as AuthenticatedUser["token"]),
    };
  } catch {
    return undefined;
  }
};

jest.mock("@/middleware/auth/requireAuth.js", () => {
  const errors = jest.requireActual<typeof ErrorsModule>("@/lib/errors.js");
  const { UnauthorizedError } = errors;

  const requireAuthMiddleware = (req: Request, _res: Request, next: NextFunction) => {
    const user = parseAuthHeader(req);
    if (!user) {
      next(new UnauthorizedError("Authentication required."));
      return;
    }

    req.user = user;
    next();
  };

  return {
    createRequireAuthMiddleware: () => requireAuthMiddleware,
  };
});

jest.mock("@/middleware/auth/requireRole.js", () => {
  const errors = jest.requireActual<typeof ErrorsModule>("@/lib/errors.js");
  const { ForbiddenError, UnauthorizedError } = errors;

  const createRequireRoleMiddleware = (roles: readonly string[] = []) => {
    return (req: Request, _res: Request, next: NextFunction) => {
      if (!roleGuardState.enforce || roles.length === 0) {
        next();
        return;
      }

      if (!req.user) {
        next(new UnauthorizedError("Authentication required."));
        return;
      }

      const granted = new Set((req.user.roles ?? []).map((role: { name: string }) => role.name));
      const hasRole = roles.some((role) => granted.has(role));

      if (!hasRole) {
        next(new ForbiddenError("You do not have permission to perform this action."));
        return;
      }

      next();
    };
  };

  return {
    createRequireRoleMiddleware,
  };
});

jest.mock("@/middleware/rateLimiter.js", () => {
  const passthrough = ((_req, _res, next) => next()) as RequestHandler;
  return {
    createScopedRateLimiter: () => ({
      middleware: passthrough,
    }),
    createRateLimiterBundle: () => ({
      global: passthrough,
      auth: passthrough,
      cleanup: async () => {},
    }),
  };
});

jest.mock("@/modules/auth/security-event.service.js", () => ({
  createSecurityEventService: () => ({
    log: jest.fn(async () => {}),
  }),
}));

jest.mock("@/audit/audit-log.service.js", () => ({
  recordAuditLog: async (entry: AuditLogEntry) => {
    auditLogInvocations.push(entry);
  },
}));

const encodeUserHeader = (roles: { id: string; name: string }[]) =>
  JSON.stringify({
    id: "user-admin",
    email: "admin@example.com",
    sessionId: "sess-1",
    roles,
    permissions: [],
  });

const createCatalogAdminService = () =>
  ({
    listPublicProducts: jest.fn(),
    listPopularProducts: jest.fn(),
    getProductDetail: jest.fn(),
    listProductVariants: jest.fn(),
    listCategories: jest.fn(),
    getCategoryDetail: jest.fn(),
    updateProduct: jest.fn(),
    archiveProduct: jest.fn(),
    addVariant: jest.fn(),
    updateVariant: jest.fn(),
    deleteVariant: jest.fn(),
    createCategory: jest.fn(),
    updateCategory: jest.fn(),
    deleteCategory: jest.fn(),
    createProduct: jest.fn(async (body: Record<string, unknown>) => ({
      id: "prod_admin",
      slug: "aurora-lamp",
      ...body,
    })),
  }) as unknown as CatalogService;

afterEach(() => {
  auditLogInvocations.length = 0;
});

describe("admin route guards", () => {
  const validPayload = {
    title: "Aurora Desk Lamp",
    price: { amount: "199", currency: "TRY" },
    variants: [
      {
        title: "Default",
        price: { amount: "199", currency: "TRY" },
        stock: 5,
      },
    ],
    categoryIds: ["ckcat00000000000000000001"],
  };

  it("returns 401 when admin routes are accessed anonymously", async () => {
    const catalogService = createCatalogAdminService();

    await withTestApp(
      async ({ app }) => {
        const response = await request(app)
          .post("/api/v1/admin/products")
          .send(validPayload)
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe("UNAUTHORIZED");
      },
      {
        apiOptions: {
          catalogOptions: { service: catalogService },
        },
      },
    );
  });

  it("returns 403 when users lack the admin role", async () => {
    const catalogService = createCatalogAdminService();

    await withTestApp(
      async ({ app }) => {
        const response = await request(app)
          .post("/api/v1/admin/products")
          .set("x-auth-user", encodeUserHeader([{ id: "role_customer", name: "customer" }]))
          .send(validPayload)
          .expect(403);

        expect(response.body.error.code).toBe("FORBIDDEN");
      },
      {
        apiOptions: {
          catalogOptions: { service: catalogService },
        },
      },
    );
  });

  it("records audit logs for successful admin mutations", async () => {
    const catalogService = createCatalogAdminService();

    await withTestApp(
      async ({ app }) => {
        await request(app)
          .post("/api/v1/admin/products")
          .set("x-auth-user", encodeUserHeader([{ id: "role_admin", name: "admin" }]))
          .send(validPayload)
          .expect(201);

        expect(auditLogInvocations).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              action: "products.create",
              entity: "products",
            }),
          ]),
        );
      },
      {
        configOverrides: {
          observability: {
            logs: {
              request: {
                sampleRate: 1,
              },
            },
          },
        },
        apiOptions: {
          catalogOptions: { service: catalogService },
        },
      },
    );
  });
});
