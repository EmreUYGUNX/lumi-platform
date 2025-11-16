import { afterEach, describe, expect, it, jest } from "@jest/globals";
import type { Request, RequestHandler } from "express";
import request from "supertest";

import type { AuthenticatedUser } from "@/modules/auth/token.types.js";

import { createMediaAssetFixture, createMediaTestHarness } from "../media/media-test-harness.js";

const buildUser = (overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser => {
  const roles =
    overrides.roles ?? ([{ id: "role_customer", name: "customer" }] as AuthenticatedUser["roles"]);
  const id = overrides.id ?? "ckmediaerror000000000000000";
  const email = overrides.email ?? "error@example.com";
  const sessionId = overrides.sessionId ?? "session_error";

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

const user = buildUser();

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
  const parsedUser = parseUserHeader(req);
  if (!parsedUser) {
    next(new UnauthorizedError("Authentication required."));
    return;
  }

  req.user = parsedUser;
  next();
};

const createRoleMiddleware = (roles: string[]): RequestHandler => {
  return (req, _res, next) => {
    const { ForbiddenError } = loadErrors();
    const hasRole = req.user?.roles?.some((role) => roles.includes(role.name));
    if (hasRole) {
      next();
      return;
    }

    next(new ForbiddenError("Forbidden"));
  };
};

jest.mock("@/middleware/auth/requireAuth.js", () => ({
  createRequireAuthMiddleware: () => requireAuthMiddleware,
}));

jest.mock("@/middleware/auth/requireRole.js", () => ({
  createRequireRoleMiddleware: (roles: string[]) => createRoleMiddleware(roles),
}));

const rateLimitState = {
  limited: false,
};

jest.mock("@/middleware/rate-limiter.js", () => ({
  createRateLimiter: () =>
    ((req: Request, res, next) => {
      if (rateLimitState.limited) {
        res.status(429).json({
          success: false,
          error: { code: "RATE_LIMITED", message: "Too many requests." },
        });
        return;
      }
      next();
    }) as RequestHandler,
}));

describe("media error scenarios", () => {
  afterEach(() => {
    rateLimitState.limited = false;
    jest.clearAllMocks();
  });

  it("returns 413 for oversized uploads", async () => {
    const { app } = createMediaTestHarness();
    const buffer = Buffer.alloc(6 * 1024 * 1024, 1);

    const response = await request(app)
      .post("/api/v1/media/upload")
      .set("x-auth-user", JSON.stringify(user))
      .attach("files", buffer, { filename: "product.png", contentType: "image/png" })
      .expect(413);

    expect(response.body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("returns 415 for unsupported MIME uploads", async () => {
    const { app } = createMediaTestHarness();

    const response = await request(app)
      .post("/api/v1/media/upload")
      .set("x-auth-user", JSON.stringify(user))
      .attach("files", Buffer.from("binary"), { filename: "script.sh", contentType: "text/plain" })
      .expect(415);

    expect(response.body.error.code).toBe("INVALID_MIME_TYPE");
  });

  it("returns 429 when rate limits are exceeded", async () => {
    rateLimitState.limited = true;
    const { app } = createMediaTestHarness();

    const response = await request(app)
      .post("/api/v1/media/upload")
      .set("x-auth-user", JSON.stringify(user))
      .attach("files", Buffer.from("binary"), { filename: "hero.jpg", contentType: "image/jpeg" })
      .expect(429);

    expect(response.body.error.code).toBe("RATE_LIMITED");
  });

  it("returns 401 when no authentication token is provided", async () => {
    const { app } = createMediaTestHarness();

    const response = await request(app)
      .post("/api/v1/media/upload")
      .attach("files", Buffer.from("binary"), { filename: "hero.jpg", contentType: "image/jpeg" })
      .expect(401);

    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 403 when non-admin attempts deletion", async () => {
    const asset = createMediaAssetFixture();
    const { app } = createMediaTestHarness({ initialAssets: [asset] });

    const response = await request(app)
      .delete(`/api/v1/admin/media/${asset.id}`)
      .set("x-auth-user", JSON.stringify(user))
      .expect(403);

    expect(response.body.error.code).toBe("FORBIDDEN");
  });
});
