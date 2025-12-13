import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Request, RequestHandler } from "express";
import request from "supertest";

import type { AuthenticatedUser } from "@/modules/auth/token.types.js";
import { withTestApp } from "@/testing/index.js";

import type { PreviewService } from "../preview.service.js";

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

jest.mock("@/middleware/rate-limiter.js", () => ({
  createRateLimiter: () => ((_req, _res, next) => next()) as RequestHandler,
}));

const buildUser = (overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser => {
  const roles =
    overrides.roles ?? ([{ id: "role_customer", name: "customer" }] as AuthenticatedUser["roles"]);
  const id = overrides.id ?? "ckpreviewuser000000000000000";
  const email = overrides.email ?? "preview@example.com";
  const sessionId = overrides.sessionId ?? "session_preview";

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

describe("preview router", () => {
  const user = buildUser();
  const userHeader = JSON.stringify(user);
  const productId = "ckl7apwqq0000u1sdf9x0w3w4";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("generates a preview and returns metadata", async () => {
    const generatePreview = jest.fn(
      async (_productId: string, _body: unknown, _userId: string) => ({
        previewId: `${productId}:hash`,
        previewUrl: "https://cdn.example/preview.webp",
        productId,
        designArea: "front",
        resolution: "web",
        timestamp: new Date("2025-01-01T00:00:00.000Z").toISOString(),
        cached: false,
      }),
    );

    const service = {
      generatePreview,
    } as unknown as PreviewService;

    await withTestApp(
      async ({ app }) => {
        const response = await request(app)
          .post("/api/v1/previews/generate")
          .set("x-auth-user", userHeader)
          .send({
            productId,
            designArea: "front",
            resolution: "web",
            layers: [
              {
                layerId: "layer-1",
                type: "text",
                text: "Hello",
                font: "Helvetica",
                fontSize: 24,
                position: { x: 0, y: 0, width: 10, height: 10, rotation: 0 },
                zIndex: 1,
              },
            ],
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.previewUrl).toBe("https://cdn.example/preview.webp");
        expect(response.body.data.designLayers).toHaveLength(1);
        const call = generatePreview.mock.calls[0];
        expect(call?.[0]).toBe(productId);
      },
      {
        apiOptions: {
          previewOptions: { service },
        },
      },
    );
  });

  it("returns cached previews by id", async () => {
    const getCachedPreview = jest.fn(async (_previewId: string) => ({
      previewUrl: "https://cdn.example/cached.webp",
      cachedAt: new Date("2025-01-01T00:00:00.000Z").toISOString(),
      expiresAt: new Date("2999-01-01T00:00:00.000Z").toISOString(),
      resolution: "web",
      designArea: "front",
    }));

    const service = {
      getCachedPreview,
    } as unknown as PreviewService;

    await withTestApp(
      async ({ app }) => {
        const previewId = `${productId}:${"a".repeat(64)}`;
        const response = await request(app)
          .get(`/api/v1/previews/${previewId}`)
          .set("x-auth-user", userHeader)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.previewUrl).toBe("https://cdn.example/cached.webp");
        expect(getCachedPreview).toHaveBeenCalled();
      },
      {
        apiOptions: {
          previewOptions: { service },
        },
      },
    );
  });

  it("generates previews in batch", async () => {
    const generatePreview = jest.fn(
      async (_productId: string, _body: unknown, _userId: string) => ({
        previewId: `${productId}:hash`,
        previewUrl: "https://cdn.example/preview.webp",
        productId,
        designArea: "front",
        resolution: "web",
        timestamp: new Date("2025-01-01T00:00:00.000Z").toISOString(),
        cached: false,
      }),
    );

    const service = {
      generatePreview,
    } as unknown as PreviewService;

    await withTestApp(
      async ({ app }) => {
        const response = await request(app)
          .post("/api/v1/previews/batch")
          .set("x-auth-user", userHeader)
          .send({
            previews: [
              {
                productId,
                designArea: "front",
                resolution: "web",
                layers: [
                  {
                    layerId: "layer-1",
                    type: "text",
                    text: "Hello",
                    font: "Helvetica",
                    fontSize: 24,
                    position: { x: 0, y: 0, width: 10, height: 10, rotation: 0 },
                    zIndex: 1,
                  },
                ],
              },
              {
                productId,
                designArea: "front",
                resolution: "web",
                layers: [
                  {
                    layerId: "layer-2",
                    type: "text",
                    text: "World",
                    font: "Helvetica",
                    fontSize: 24,
                    position: { x: 0, y: 0, width: 10, height: 10, rotation: 0 },
                    zIndex: 1,
                  },
                ],
              },
            ],
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(2);
        expect(generatePreview).toHaveBeenCalledTimes(2);
      },
      {
        apiOptions: {
          previewOptions: { service },
        },
      },
    );
  });
});
