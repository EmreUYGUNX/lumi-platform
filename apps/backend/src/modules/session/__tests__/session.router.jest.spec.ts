import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Request, RequestHandler } from "express";
import request from "supertest";

import type { AuthenticatedUser } from "@/modules/auth/token.types.js";
import { withTestApp } from "@/testing/index.js";

import type {
  DesignSessionShareResult,
  DesignSessionSummaryView,
  DesignSessionView,
  SessionService,
} from "../session.service.js";

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
  const id = overrides.id ?? "cksessionuser0000000000000";
  const email = overrides.email ?? "session@example.com";
  const sessionId = overrides.sessionId ?? "session_user";

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

const buildSessionView = (userId: string): DesignSessionView => {
  const now = new Date("2025-02-01T10:00:00.000Z").toISOString();
  return {
    id: "cksession0000000000000000000",
    userId,
    productId: "ckprod0000000000000000000",
    designArea: "front",
    sessionData: { objects: [], layers: [] },
    previewUrl: "https://cdn.lumi.test/preview.webp",
    thumbnailUrl: "https://cdn.lumi.test/preview-thumb.webp",
    shareToken: undefined,
    isPublic: false,
    viewCount: 0,
    lastEditedAt: now,
    expiresAt: new Date("2025-03-03T10:00:00.000Z").toISOString(),
    createdAt: now,
    updatedAt: now,
  };
};

describe("session router", () => {
  const user = buildUser();
  const userHeader = JSON.stringify(user);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("saves a design session and returns the persisted payload", async () => {
    const view = buildSessionView(user.id);
    const saveSession = jest.fn(async (_userId: string, _body: unknown) => view);
    const service = { saveSession } as unknown as SessionService;

    await withTestApp(
      async ({ app }) => {
        const response = await request(app)
          .post("/api/v1/sessions/save")
          .set("x-auth-user", userHeader)
          .send({
            productId: view.productId,
            designArea: view.designArea,
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
            sessionData: { objects: [] },
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.id).toBe(view.id);
        expect(saveSession).toHaveBeenCalledTimes(1);
      },
      {
        apiOptions: {
          sessionOptions: { service },
        },
      },
    );
  });

  it("lists sessions for the authenticated user", async () => {
    const summary: DesignSessionSummaryView = {
      id: "cksession0000000000000000000",
      productId: "ckprod0000000000000000000",
      designArea: "front",
      previewUrl: "https://cdn.lumi.test/preview.webp",
      thumbnailUrl: "https://cdn.lumi.test/preview-thumb.webp",
      isPublic: false,
      shareToken: undefined,
      lastEditedAt: new Date("2025-02-01T10:00:00.000Z").toISOString(),
      expiresAt: new Date("2025-03-03T10:00:00.000Z").toISOString(),
    };

    const listUserSessions = jest.fn(async (_userId: string, _query: unknown) => ({
      items: [summary],
      meta: {
        page: 1,
        pageSize: 24,
        totalItems: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    }));
    const service = { listUserSessions } as unknown as SessionService;

    await withTestApp(
      async ({ app }) => {
        const response = await request(app)
          .get("/api/v1/sessions")
          .set("x-auth-user", userHeader)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.meta.pagination.totalItems).toBe(1);
        expect(listUserSessions).toHaveBeenCalledTimes(1);
      },
      {
        apiOptions: {
          sessionOptions: { service },
        },
      },
    );
  });

  it("loads a session by id", async () => {
    const view = buildSessionView(user.id);
    const getSession = jest.fn(async (_id: string, _userId?: string) => view);
    const service = { getSession } as unknown as SessionService;

    await withTestApp(
      async ({ app }) => {
        const response = await request(app)
          .get(`/api/v1/sessions/${view.id}`)
          .set("x-auth-user", userHeader)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.id).toBe(view.id);
        expect(getSession).toHaveBeenCalledWith(view.id, undefined);
      },
      {
        apiOptions: {
          sessionOptions: { service },
        },
      },
    );
  });

  it("deletes a session", async () => {
    const deleteSession = jest.fn(async (_id: string, _userId: string) => {});
    const service = { deleteSession } as unknown as SessionService;

    await withTestApp(
      async ({ app }) => {
        await request(app)
          .delete("/api/v1/sessions/cksession0000000000000000000")
          .set("x-auth-user", userHeader)
          .expect(204);

        expect(deleteSession).toHaveBeenCalledTimes(1);
      },
      {
        apiOptions: {
          sessionOptions: { service },
        },
      },
    );
  });

  it("shares a session", async () => {
    const share: DesignSessionShareResult = {
      sessionId: "cksession0000000000000000000",
      shareToken: "token_abc1234567890",
      shareUrl: "/editor/shared/token_abc1234567890",
      expiresAt: new Date("2025-03-03T10:00:00.000Z").toISOString(),
    };

    const shareSession = jest.fn(async (_id: string, _userId: string) => share);
    const service = { shareSession } as unknown as SessionService;

    await withTestApp(
      async ({ app }) => {
        const response = await request(app)
          .post("/api/v1/sessions/cksession0000000000000000000/share")
          .set("x-auth-user", userHeader)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.shareToken).toBe(share.shareToken);
        expect(shareSession).toHaveBeenCalledTimes(1);
      },
      {
        apiOptions: {
          sessionOptions: { service },
        },
      },
    );
  });

  it("loads a shared session by token", async () => {
    const view = buildSessionView(user.id);
    const getSharedSession = jest.fn(async (_token: string) => view);
    const service = { getSharedSession } as unknown as SessionService;

    await withTestApp(
      async ({ app }) => {
        const response = await request(app)
          .get("/api/v1/sessions/shared/token_abc1234567890")
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.id).toBe(view.id);
        expect(getSharedSession).toHaveBeenCalledWith("token_abc1234567890");
      },
      {
        apiOptions: {
          sessionOptions: { service },
        },
      },
    );
  });
});
