/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { describe, expect, it, jest } from "@jest/globals";
import type { Request, RequestHandler } from "express";
import request from "supertest";

import type { AuthenticatedUser } from "@/modules/auth/token.types.js";
import { withTestApp } from "@/testing/index.js";

import type { ClipartService } from "../clipart.service.js";

const parseUserHeader = (req: Request): AuthenticatedUser | undefined => {
  const header = req.get("x-auth-user");
  if (!header) {
    return undefined;
  }

  try {
    return JSON.parse(header) as AuthenticatedUser;
  } catch {
    return undefined;
  }
};

const requireAuthMiddleware: RequestHandler = (req, _res, next) => {
  const { UnauthorizedError } = jest.requireActual("@/lib/errors.js") as {
    UnauthorizedError: new (...args: ConstructorParameters<typeof Error>) => Error;
  };

  const user = parseUserHeader(req);
  if (!user) {
    next(new UnauthorizedError("Authentication required."));
    return;
  }

  req.user = user;
  next();
};

jest.mock("@/middleware/auth/requireAuth.js", () => ({
  createRequireAuthMiddleware: () => requireAuthMiddleware,
}));

jest.mock("@/middleware/auth/requireRole.js", () => ({
  createRequireRoleMiddleware: (roles: readonly string[]) =>
    ((req, _res, next) => {
      const { ForbiddenError } = jest.requireActual("@/lib/errors.js") as {
        ForbiddenError: new (...args: ConstructorParameters<typeof Error>) => Error;
      };

      const required = roles.map((role) => role.toLowerCase());
      if (required.length === 0) {
        next();
        return;
      }

      const userRoles = new Set((req.user?.roles ?? []).map((role) => role.name.toLowerCase()));
      const allowed = required.some((role) => userRoles.has(role));
      if (allowed) {
        next();
        return;
      }

      next(new ForbiddenError("You do not have permission to perform this action."));
    }) as RequestHandler,
}));

jest.mock("@/middleware/rate-limiter.js", () => ({
  createRateLimiter: () => ((_req, _res, next) => next()) as RequestHandler,
}));

const buildUser = (roleName: string) =>
  ({
    id: `user_${roleName}`,
    email: `${roleName}@example.com`,
    sessionId: `session_${roleName}`,
    permissions: [],
    token: {
      sub: `user_${roleName}`,
      email: `${roleName}@example.com`,
      sessionId: `session_${roleName}`,
      roleIds: [`role_${roleName}`],
      permissions: [],
      jti: `jti-${roleName}`,
      iat: 0,
      exp: 0,
    },
    roles: [{ id: `role_${roleName}`, name: roleName }],
  }) as AuthenticatedUser;

const buildClipart = (id = "ckclipart0000000000000000000") => ({
  id,
  name: "Star",
  description: undefined,
  category: "icons",
  tags: ["star"],
  isPaid: false,
  price: { amount: "0.00", currency: "TRY" },
  svg: "<svg></svg>",
  thumbnailUrl: undefined,
  usageCount: 0,
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
  updatedAt: new Date("2025-01-01T00:00:00.000Z"),
});

describe("clipart router", () => {
  it("lists clipart assets with pagination metadata", async () => {
    const asset = buildClipart();
    const service = {
      listPublicClipart: jest.fn().mockResolvedValue({
        items: [asset],
        meta: {
          page: 1,
          pageSize: 25,
          totalItems: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      }),
    } as unknown as ClipartService;

    await withTestApp(
      async ({ app }) => {
        const response = await request(app).get("/api/v1/clipart").expect(200);

        expect(service.listPublicClipart).toHaveBeenCalled();
        expect(response.body.success).toBe(true);
        expect(response.body.data[0].id).toBe(asset.id);
        expect(response.body.meta.pagination.totalItems).toBe(1);
      },
      {
        apiOptions: {
          clipartOptions: { service },
        },
      },
    );
  });

  it("returns clipart details and increments usage", async () => {
    const asset = buildClipart("ckclipart0000000000000000001");
    const service = {
      getPublicClipart: jest.fn().mockResolvedValue(asset),
    } as unknown as ClipartService;

    await withTestApp(
      async ({ app }) => {
        const response = await request(app).get(`/api/v1/clipart/${asset.id}`).expect(200);

        expect(service.getPublicClipart).toHaveBeenCalledWith(asset.id);
        expect(response.body.success).toBe(true);
        expect(response.body.data.id).toBe(asset.id);
      },
      {
        apiOptions: {
          clipartOptions: { service },
        },
      },
    );
  });

  it("allows admins to upload clipart assets", async () => {
    const asset = buildClipart("ckclipart0000000000000000002");
    const service = {
      uploadClipart: jest.fn().mockResolvedValue({ uploads: [asset], failures: [] }),
    } as unknown as ClipartService;

    await withTestApp(
      async ({ app }) => {
        const response = await request(app)
          .post("/api/v1/admin/clipart")
          .set("x-auth-user", JSON.stringify(buildUser("admin")))
          .attach("files", Buffer.from("<svg></svg>"), {
            filename: "star.svg",
            contentType: "image/svg+xml",
          })
          .field("category", "icons")
          .field("isPaid", "false")
          .field("priceAmount", "0")
          .field("currency", "TRY")
          .expect(200);

        expect(service.uploadClipart).toHaveBeenCalled();
        expect(response.body.success).toBe(true);
        expect(response.body.data.uploads[0].id).toBe(asset.id);
        expect(response.body.meta.counts.total).toBe(1);
      },
      {
        apiOptions: {
          clipartOptions: { service },
        },
      },
    );
  });
});
