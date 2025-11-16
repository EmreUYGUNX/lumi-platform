import { describe, expect, it, jest } from "@jest/globals";
import type { Request, RequestHandler } from "express";
import request from "supertest";

import type { AuthenticatedUser } from "@/modules/auth/token.types.js";

import { createMediaTestHarness } from "../media/media-test-harness.js";

const createUser = (overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser => {
  const roles =
    overrides.roles ?? ([{ id: "role_customer", name: "customer" }] as AuthenticatedUser["roles"]);
  const id = overrides.id ?? "ckaverageuser000000000000000";
  const email = overrides.email ?? "average@example.com";
  const sessionId = overrides.sessionId ?? "session_average";

  return {
    id,
    email,
    sessionId,
    permissions: overrides.permissions ?? [],
    token:
      overrides.token ??
      ({
        sub: id,
        email,
        sessionId,
        roleIds: roles.map((role) => role.id),
        permissions: [],
        jti: `jti-${id}`,
        iat: 0,
        exp: 0,
      } as AuthenticatedUser["token"]),
    roles,
  };
};

const baseUser = createUser();
const adminUser = createUser({
  id: "ckaverageadmin000000000000",
  roles: [{ id: "role_admin", name: "admin" }] as AuthenticatedUser["roles"],
});

const serialiseUser = (user: AuthenticatedUser) => JSON.stringify(user);

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

interface ErrorConstructors {
  UnauthorizedError: new (...args: ConstructorParameters<typeof Error>) => Error;
  ForbiddenError: new (...args: ConstructorParameters<typeof Error>) => Error;
}

const loadErrors = (): ErrorConstructors =>
  jest.requireActual("@/lib/errors.js") as ErrorConstructors;

const requireAuthMiddleware: RequestHandler = (req, _res, next) => {
  const { UnauthorizedError } = loadErrors();
  const user = parseUserHeader(req);
  if (!user) {
    next(new UnauthorizedError("Authentication required."));
    return;
  }
  req.user = user;
  next();
};

const createRoleMiddleware = (roles: string[]): RequestHandler => {
  return (req, _res, next) => {
    const { ForbiddenError } = loadErrors();
    const hasRole = req.user?.roles?.some((role) => roles.includes(role.name));
    if (!hasRole) {
      next(new ForbiddenError("Forbidden"));
      return;
    }
    next();
  };
};

jest.mock("@/middleware/auth/requireAuth.js", () => ({
  createRequireAuthMiddleware: () => requireAuthMiddleware,
}));

jest.mock("@/middleware/auth/requireRole.js", () => ({
  createRequireRoleMiddleware: (roles: string[]) => createRoleMiddleware(roles),
}));

jest.mock("@/middleware/rate-limiter.js", () => ({
  createRateLimiter: () => ((_req, _res, next) => next()) as RequestHandler,
}));

describe("media average scenario", () => {
  it("uploads gallery assets, renders transformations, and invalidates cache after deletion", async () => {
    const { app } = createMediaTestHarness();
    const userHeader = serialiseUser(baseUser);

    const uploads = await Promise.all(
      ["hero.jpg", "detail.jpg", "lifestyle.jpg"].map((filename) =>
        request(app)
          .post("/api/v1/media/upload")
          .set("x-auth-user", userHeader)
          .attach("files", Buffer.from(filename), {
            filename,
            contentType: "image/jpeg",
          })
          .field("tags", ["gallery", "summer"])
          .expect(200),
      ),
    );

    uploads.forEach((response) => {
      expect(response.body.data.uploads[0].transformations).toMatchObject({
        thumbnail: expect.any(String),
        medium: expect.any(String),
        large: expect.any(String),
      });
    });

    const listResponse = await request(app)
      .get("/api/v1/media")
      .set("x-auth-user", userHeader)
      .set("if-none-match", "invalid-etag")
      .expect(200);

    const etag = listResponse.headers.etag ?? "";
    expect(listResponse.body.data).toHaveLength(3);
    listResponse.body.data.forEach((asset: { transformations: Record<string, string> }) => {
      expect(asset.transformations.thumbnail).toContain("w_300");
      expect(asset.transformations.medium).toContain("w_800");
      expect(asset.transformations.large).toContain("w_1920");
    });

    const assetToDelete = listResponse.body.data[1];
    await request(app)
      .delete(`/api/v1/admin/media/${assetToDelete.id}`)
      .set("x-auth-user", serialiseUser(adminUser))
      .expect(200);

    const postDeleteResponse = await request(app)
      .get("/api/v1/media")
      .set("x-auth-user", userHeader)
      .set("if-none-match", etag || "")
      .expect(200);

    expect(postDeleteResponse.headers.etag).not.toBe(etag);
    expect(postDeleteResponse.body.data).toHaveLength(2);
  });
});
