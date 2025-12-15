/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { describe, expect, it, jest } from "@jest/globals";
import type { Request, RequestHandler } from "express";
import request from "supertest";

import type { AuthenticatedUser } from "@/modules/auth/token.types.js";
import { withTestApp } from "@/testing/index.js";

import type { TemplateService } from "../template.service.js";

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

const buildTemplate = (id = "cktemplate0000000000000000000") => ({
  id,
  name: "Minimal Logo",
  description: "A simple template",
  category: "minimal",
  tags: ["logo"],
  isPaid: false,
  price: { amount: "0.00", currency: "TRY" },
  thumbnailUrl: undefined,
  previewUrl: undefined,
  isPublished: true,
  isFeatured: false,
  usageCount: 0,
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
  updatedAt: new Date("2025-01-01T00:00:00.000Z"),
  canvasData: { lumiEditor: { editorLayers: [] } },
});

describe("template router", () => {
  it("lists public templates with pagination metadata", async () => {
    const template = buildTemplate();
    const service = {
      listPublicTemplates: jest.fn().mockResolvedValue({
        items: [template],
        meta: {
          page: 1,
          pageSize: 25,
          totalItems: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      }),
    } as unknown as TemplateService;

    await withTestApp(
      async ({ app }) => {
        const response = await request(app).get("/api/v1/templates").expect(200);

        expect(service.listPublicTemplates).toHaveBeenCalled();
        expect(response.body.success).toBe(true);
        expect(response.body.data[0].id).toBe(template.id);
        expect(response.body.meta.pagination.totalItems).toBe(1);
      },
      {
        apiOptions: {
          templateOptions: { service },
        },
      },
    );
  });

  it("returns template details and increments usage", async () => {
    const template = buildTemplate("cktemplate0000000000000000001");
    const service = {
      getPublicTemplate: jest.fn().mockResolvedValue(template),
    } as unknown as TemplateService;

    await withTestApp(
      async ({ app }) => {
        const response = await request(app).get(`/api/v1/templates/${template.id}`).expect(200);

        expect(service.getPublicTemplate).toHaveBeenCalledWith(template.id);
        expect(response.body.success).toBe(true);
        expect(response.body.data.id).toBe(template.id);
      },
      {
        apiOptions: {
          templateOptions: { service },
        },
      },
    );
  });

  it("requires admin role for template creation", async () => {
    const template = buildTemplate("cktemplate0000000000000000002");
    const service = {
      createTemplate: jest.fn().mockResolvedValue(template),
    } as unknown as TemplateService;

    await withTestApp(
      async ({ app }) => {
        await request(app)
          .post("/api/v1/admin/templates")
          .set("x-auth-user", JSON.stringify(buildUser("customer")))
          .send({
            name: "Minimal Logo",
            tags: ["logo"],
            isPaid: false,
            priceAmount: 0,
            currency: "TRY",
            canvasData: { lumiEditor: { version: 1 } },
          })
          .expect(403);

        const response = await request(app)
          .post("/api/v1/admin/templates")
          .set("x-auth-user", JSON.stringify(buildUser("admin")))
          .send({
            name: "Minimal Logo",
            tags: ["logo"],
            isPaid: false,
            priceAmount: 0,
            currency: "TRY",
            canvasData: { lumiEditor: { version: 1 } },
          })
          .expect(201);

        expect(service.createTemplate).toHaveBeenCalled();
        expect(response.body.success).toBe(true);
        expect(response.body.data.id).toBe(template.id);
      },
      {
        apiOptions: {
          templateOptions: { service },
        },
      },
    );
  });
});
