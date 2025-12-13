import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Request, RequestHandler } from "express";
import request from "supertest";

import type { AuthenticatedUser } from "@/modules/auth/token.types.js";
import { withTestApp } from "@/testing/index.js";

import type { CustomerDesignView, DesignService } from "../design.service.js";

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
  const id = overrides.id ?? "ckdesignuser000000000000000";
  const email = overrides.email ?? "design@example.com";
  const sessionId = overrides.sessionId ?? "session_design";

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

const buildDesignView = (userId: string): CustomerDesignView => {
  const timestamp = new Date("2025-02-01T10:00:00.000Z");
  return {
    id: "ckdesign0000000000000000000",
    publicId: `lumi/customer-designs/${userId}/design-1`,
    url: "http://cdn.lumi.test/design.png",
    secureUrl: "https://cdn.lumi.test/design.png",
    thumbnailUrl: "https://cdn.lumi.test/design-thumb.png",
    format: "svg",
    width: undefined,
    height: undefined,
    bytes: 1234,
    tags: ["hero"],
    userId,
    isPublic: false,
    usageCount: 0,
    viewCount: 0,
    metadata: { originalFilename: "design.svg", uploadedFrom: "canvas-editor" },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

describe("design.router integration", () => {
  const user = buildUser();
  const userHeader = JSON.stringify(user);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uploads an SVG design and sanitizes malicious payloads", async () => {
    const view = buildDesignView(user.id);

    const uploadDesign = jest.fn(async (_file: unknown, _userId: string, _body: unknown) => {
      return view;
    });
    const service = { uploadDesign } as unknown as DesignService;

    await withTestApp(
      async ({ app }) => {
        const maliciousSvg = `
          <svg xmlns="http://www.w3.org/2000/svg">
            <script>alert("XSS")</script>
            <rect width="10" height="10" onclick="alert('XSS')" />
          </svg>
        `;

        const response = await request(app)
          .post("/api/v1/designs/upload")
          .set("x-auth-user", userHeader)
          .attach("file", Buffer.from(maliciousSvg), {
            filename: "malicious.svg",
            contentType: "image/svg+xml",
          })
          .field("tags", "hero")
          .field("uploadedFrom", "canvas-editor")
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.id).toBe(view.id);
        expect(response.body.meta.requestId).toBeDefined();

        expect(uploadDesign).toHaveBeenCalledTimes(1);
        const call = uploadDesign.mock.calls[0];
        const preparedFile = call?.[0] as { buffer: Buffer } | undefined;
        expect(preparedFile).toBeDefined();
        const sanitized = preparedFile?.buffer.toString("utf8") ?? "";
        expect(sanitized).not.toContain("<script");
        expect(sanitized).not.toContain("onclick");
      },
      {
        apiOptions: {
          designOptions: { service: service as DesignService },
        },
      },
    );
  });

  it("rejects oversized uploads (413)", async () => {
    const uploadDesign = jest.fn();
    const service = { uploadDesign } as unknown as DesignService;

    await withTestApp(
      async ({ app }) => {
        const oversized = Buffer.alloc(6 * 1024 * 1024, 1);
        const response = await request(app)
          .post("/api/v1/designs/upload")
          .set("x-auth-user", userHeader)
          .attach("file", oversized, {
            filename: "large.png",
            contentType: "image/png",
          })
          .expect(413);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe("PAYLOAD_TOO_LARGE");
        expect(uploadDesign).not.toHaveBeenCalled();
      },
      {
        apiOptions: {
          designOptions: { service: service as DesignService },
        },
      },
    );
  });

  it("requires authentication for uploads", async () => {
    const uploadDesign = jest.fn();
    const service = { uploadDesign } as unknown as DesignService;

    await withTestApp(
      async ({ app }) => {
        const response = await request(app)
          .post("/api/v1/designs/upload")
          .attach("file", Buffer.from("png"), {
            filename: "design.png",
            contentType: "image/png",
          })
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe("UNAUTHORIZED");
        expect(uploadDesign).not.toHaveBeenCalled();
      },
      {
        apiOptions: {
          designOptions: { service: service as DesignService },
        },
      },
    );
  });
});
