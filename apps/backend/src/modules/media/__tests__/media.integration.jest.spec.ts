import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Request, RequestHandler } from "express";
import request from "supertest";

import type { AuthenticatedUser } from "@/modules/auth/token.types.js";

import {
  createMediaAssetFixture,
  createMediaTestHarness,
} from "../../../../tests/media/media-test-harness.js";

const buildUser = (overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser => {
  const roles =
    overrides.roles ?? ([{ id: "role_customer", name: "customer" }] as AuthenticatedUser["roles"]);
  const id = overrides.id ?? "ckmediauser000000000000000";
  const email = overrides.email ?? "media@example.com";
  const sessionId = overrides.sessionId ?? "session_media";

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

const buildRoleMiddleware = (allowed: string[]): RequestHandler => {
  return (req, _res, next) => {
    const { ForbiddenError } = jest.requireActual("@/lib/errors.js") as {
      ForbiddenError: new (...args: ConstructorParameters<typeof Error>) => Error;
    };
    const roles = req.user?.roles ?? [];
    if (roles.some((role) => allowed.includes(role.name))) {
      next();
      return;
    }

    next(new ForbiddenError("Insufficient permissions."));
  };
};

jest.mock("@/middleware/auth/requireAuth.js", () => ({
  createRequireAuthMiddleware: () => requireAuthMiddleware,
}));

jest.mock("@/middleware/auth/requireRole.js", () => ({
  createRequireRoleMiddleware: (allowed: string[]) => buildRoleMiddleware(allowed),
}));

jest.mock("@/middleware/rate-limiter.js", () => ({
  createRateLimiter: () => ((_req, _res, next) => next()) as RequestHandler,
}));

describe("media.router integration", () => {
  const baseUser = buildUser();
  const userHeader = serialiseUser(baseUser);
  const adminUser = buildUser({
    id: "ckmediaadmin000000000000000",
    roles: [{ id: "role_admin", name: "admin" }] as AuthenticatedUser["roles"],
  });
  const adminHeader = serialiseUser(adminUser);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uploads a single image successfully", async () => {
    const { app, service } = createMediaTestHarness();

    const response = await request(app)
      .post("/api/v1/media/upload")
      .set("x-auth-user", userHeader)
      .attach("files", Buffer.from("binary-data"), {
        filename: "hero.png",
        contentType: "image/png",
      })
      .field("tags", "hero,primary")
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.uploads).toHaveLength(1);
    expect(service.upload).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          originalName: "hero.png",
          mimeType: "image/png",
        }),
      ]),
      expect.objectContaining({
        tags: ["hero", "primary"],
        uploadedById: baseUser.id,
      }),
    );
  });

  it("supports multi-file uploads with independent metadata", async () => {
    const { app, service } = createMediaTestHarness();

    const response = await request(app)
      .post("/api/v1/media/upload")
      .set("x-auth-user", userHeader)
      .field("tags", ["gallery", "summer"])
      .attach("files", Buffer.from("first"), {
        filename: "gallery-1.jpg",
        contentType: "image/jpeg",
      })
      .attach("files", Buffer.from("second"), {
        filename: "gallery-2.jpg",
        contentType: "image/jpeg",
      })
      .expect(200);

    expect(response.body.data.uploads).toHaveLength(2);
    expect(service.upload).toHaveBeenCalledTimes(1);
    const [firstUpload, secondUpload] = service.upload.mock.calls[0]![0];
    expect(firstUpload).toBeDefined();
    expect(secondUpload).toBeDefined();
    expect(firstUpload?.originalName).toBe("gallery-1.jpg");
    expect(secondUpload?.originalName).toBe("gallery-2.jpg");
  });

  it("rejects uploads with unsupported MIME types", async () => {
    const { app } = createMediaTestHarness();

    const response = await request(app)
      .post("/api/v1/media/upload")
      .set("x-auth-user", userHeader)
      .attach("files", Buffer.from("pdf"), {
        filename: "manual.pdf",
        contentType: "application/pdf",
      })
      .expect(415);

    expect(response.body.error.code).toBe("INVALID_MIME_TYPE");
  });

  it("rejects uploads exceeding folder limits", async () => {
    const { app } = createMediaTestHarness();
    const oversizedBuffer = Buffer.alloc(11 * 1024 * 1024, 1);

    const response = await request(app)
      .post("/api/v1/media/upload")
      .set("x-auth-user", userHeader)
      .field("folder", "lumi/banners")
      .attach("files", oversizedBuffer, {
        filename: "banner.png",
        contentType: "image/png",
      })
      .expect(413);

    expect(response.body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("rejects unauthenticated uploads", async () => {
    const { app } = createMediaTestHarness();

    const response = await request(app)
      .post("/api/v1/media/upload")
      .attach("files", Buffer.from("data"), { filename: "hero.png", contentType: "image/png" })
      .expect(401);

    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns paginated media list with cache headers", async () => {
    const fixture = createMediaAssetFixture({ tags: ["gallery"] });
    const { app, service } = createMediaTestHarness({ initialAssets: [fixture] });
    const response = await request(app)
      .get("/api/v1/media")
      .query({ page: 1, tag: "gallery" })
      .set("x-auth-user", userHeader)
      .expect(200);

    expect(response.headers["cache-control"]).toBe("private, max-age=300");
    expect(response.body.meta.pagination.page).toBe(1);
    expect(response.body.data).toHaveLength(1);
    expect(service.listAssets).toHaveBeenCalledWith(
      expect.objectContaining({ tag: "gallery" }),
      expect.objectContaining({ userId: baseUser.id }),
    );
  });

  it("supports query parameters for filtering by folder and uploader", async () => {
    const fixture = createMediaAssetFixture({ folder: "lumi/banners" });
    const { app, service } = createMediaTestHarness({ initialAssets: [fixture] });

    const filterResponse = await request(app)
      .get("/api/v1/media")
      .query({ folder: "lumi/banners", uploadedById: baseUser.id })
      .set("x-auth-user", userHeader)
      .expect(200);

    expect(filterResponse.body.meta.pagination.pageSize).toBeGreaterThan(0);
    expect(service.listAssets).toHaveBeenCalledWith(
      expect.objectContaining({
        folder: "lumi/banners",
        uploadedById: baseUser.id,
      }),
      expect.objectContaining({ userId: baseUser.id }),
    );
  });

  it("soft deletes media assets for admin actors and records audit trail", async () => {
    const asset = createMediaAssetFixture();
    const { app, auditTrail } = createMediaTestHarness({ initialAssets: [asset] });

    const response = await request(app)
      .delete(`/api/v1/admin/media/${asset.id}`)
      .set("x-auth-user", adminHeader)
      .expect(200);

    expect(response.body.data.deletedAt).toBeDefined();
    expect(auditTrail.at(-1)).toMatchObject({
      action: "media.assets.soft-delete",
      entityId: asset.id,
    });
  });

  it("prevents deletion when asset is still referenced", async () => {
    const asset = createMediaAssetFixture({
      usage: { products: [{ id: "prod_1", title: "Lamp", slug: "lamp" }], variants: [] },
    });
    const { app } = createMediaTestHarness({ initialAssets: [asset] });

    await request(app)
      .delete(`/api/v1/admin/media/${asset.id}`)
      .set("x-auth-user", adminHeader)
      .expect(409);
  });

  it("rejects delete attempts from non-admin actors", async () => {
    const asset = createMediaAssetFixture();
    const { app } = createMediaTestHarness({ initialAssets: [asset] });

    const response = await request(app)
      .delete(`/api/v1/admin/media/${asset.id}`)
      .set("x-auth-user", userHeader)
      .expect(403);

    expect(response.body.error.code).toBe("FORBIDDEN");
  });
});
