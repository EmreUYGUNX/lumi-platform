import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import express from "express";
import rateLimit from "express-rate-limit";

import { createApiClient } from "@lumi/testing";

import { createAuthenticatedUser } from "../../__tests__/helpers/auth.js";
import * as auditLogModule from "../../audit/audit-log.service.js";
import * as loggerModule from "../../lib/logger.js";
import { requestLogger } from "../request-logger.js";
import { responseFormatter } from "../response-formatter.js";

process.env.APP_NAME ??= "BackendTest";
process.env.API_BASE_URL ??= "http://localhost:4000";
process.env.FRONTEND_URL ??= "http://localhost:3000";
process.env.DATABASE_URL ??= "postgres://user:pass@localhost:5432/db";
process.env.REDIS_URL ??= "redis://localhost:6379";
process.env.STORAGE_BUCKET ??= "bucket";
process.env.JWT_SECRET ??= "test-secret-key-value";

jest.mock("../../lib/logger.js", () => ({
  __esModule: true,
  logger: {
    info: jest.fn(),
    log: jest.fn(),
    error: jest.fn(),
  },
  mergeRequestContext: jest.fn(),
}));

jest.mock("../../audit/audit-log.service.js", () => ({
  __esModule: true,
  recordAuditLog: jest.fn(() => Promise.resolve()),
}));

const logger = loggerModule.logger as unknown as {
  info: jest.Mock;
  log: jest.Mock;
  error: jest.Mock;
};

const createTestRateLimiter = () =>
  rateLimit({
    windowMs: 1000,
    limit: 1000,
    standardHeaders: false,
    legacyHeaders: false,
  });

const recordAuditLog = auditLogModule.recordAuditLog as unknown as jest.Mock;

describe("request logger middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("masks sensitive payloads before logging warnings or errors", async () => {
    const app = express();
    app.use(express.json());
    app.use(responseFormatter);
    app.use(createTestRateLimiter());
    // codeql[js/missing-rate-limiting]: Test-only middleware executed in-memory; no public exposure or rate limiting required.
    app.use((req, _res, next) => {
      req.user = createAuthenticatedUser({
        id: "user-1",
        roles: [{ id: "role_customer", name: "customer" }],
      });
      next();
    });
    app.use(requestLogger);
    app.post("/login", (_req, res) => {
      res.status(401).json({ success: false, error: { code: "INVALID", message: "Invalid" } });
    });

    const api = createApiClient(app);
    await api
      .post("/login")
      .send({ email: "user@example.com", password: "super-secret" })
      .expect(401);

    const logCalls = logger.log as jest.Mock;
    const warningCall = logCalls.mock.calls.find((call) => call[0] === "warn");
    expect(warningCall).toBeDefined();
    const warningArgs = warningCall as unknown[];
    const metadata = warningArgs[2] as { body?: unknown };
    const body = metadata.body as Record<string, string>;
    expect(body.password).toBe("[REDACTED]");
  });

  it("records audit entries for admin mutations", async () => {
    const app = express();
    app.use(express.json());
    app.use(responseFormatter);
    app.use(createTestRateLimiter());
    // codeql[js/missing-rate-limiting]: Test-only middleware executed in-memory; no public exposure or rate limiting required.
    app.use((req, res, next) => {
      req.user = createAuthenticatedUser({
        id: "admin-1",
        roles: [{ id: "role_admin", name: "admin" }],
      });
      res.locals.audit = { entity: "products", entityId: "prod-1", action: "products.update" };
      next();
    });
    app.use(requestLogger);
    app.patch("/api/v1/admin/products/prod-1", (_req, res) => {
      res.json({ success: true });
    });

    const api = createApiClient(app);
    await api
      .patch("/api/v1/admin/products/prod-1")
      .send({ title: "Updated", price: 100 })
      .expect(200);

    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });

    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "admin-1",
        action: "products.update",
        entity: "products",
        entityId: "prod-1",
      }),
    );
  });

  it("logs error-level output and masks nested sensitive payloads for server failures", async () => {
    const app = express();
    app.use(express.json());
    app.use(responseFormatter);
    app.use(createTestRateLimiter());
    app.use((req, _res, next) => {
      req.user = createAuthenticatedUser({
        id: "user-2",
        roles: [{ id: "role_support", name: "support" }],
      });
      next();
    });
    app.use(requestLogger);
    app.post("/api/v1/support/action", (_req, res) => {
      res.status(500).json({ error: { code: "FAIL", token: "secret-token" } });
    });

    const api = createApiClient(app);
    await api
      .post("/api/v1/support/action")
      .send({ meta: { token: "nested-secret", password: "super" } })
      .expect(500);

    const logFn = logger.log as jest.Mock;
    const errorCall = logFn.mock.calls.find((call) => call[0] === "error");
    expect(errorCall).toBeDefined();
    const metadata = errorCall?.[2] as { body?: unknown } | undefined;
    const body = metadata?.body as Record<string, unknown>;
    expect(body?.meta).toMatchObject({ token: "[REDACTED]", password: "[REDACTED]" });
  });

  it("derives audit metadata when admin mutation omits explicit context", async () => {
    const app = express();
    app.use(express.json());
    app.use(responseFormatter);
    app.use(createTestRateLimiter());
    app.use((req, _res, next) => {
      req.user = createAuthenticatedUser({
        id: "admin-2",
        roles: [{ id: "role_admin", name: "admin" }],
      });
      next();
    });
    app.use(requestLogger);
    app.patch("/api/v1/admin/users/user-42", (_req, res) => {
      res.status(200).json({ success: true });
    });

    const api = createApiClient(app);
    await api.patch("/api/v1/admin/users/user-42").send({ status: "active" }).expect(200);

    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });

    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "admin-2",
        entity: "users",
        entityId: "user-42",
        action: "users.patch",
      }),
    );
  });

  it("logs informational responses without attaching diagnostic payloads", async () => {
    const app = express();
    app.use(express.json());
    app.use(responseFormatter);
    app.use(createTestRateLimiter());
    app.use((req, _res, next) => {
      req.user = createAuthenticatedUser({
        id: "user-3",
        roles: [{ id: "role_customer", name: "customer" }],
      });
      next();
    });
    app.use(requestLogger);
    app.get("/api/v1/profile", (_req, res) => {
      res.status(200).json({ success: true });
    });

    const api = createApiClient(app);
    await api.get("/api/v1/profile?expand=1").expect(200);

    const infoCall = (logger.log as jest.Mock).mock.calls.find((call) => call[0] === "info");
    expect(infoCall).toBeDefined();
    const metadata = infoCall?.[2] as Record<string, unknown>;
    expect(metadata).not.toHaveProperty("body");
    expect(metadata).not.toHaveProperty("query");
  });

  it("skips audit logging for read-only admin routes and failing mutations", async () => {
    const app = express();
    app.use(express.json());
    app.use(responseFormatter);
    app.use(createTestRateLimiter());
    app.use((req, _res, next) => {
      req.user = createAuthenticatedUser({
        id: "admin-3",
        roles: [{ id: "role_admin", name: "admin" }],
      });
      next();
    });
    app.use(requestLogger);
    app.get("/api/v1/admin/products", (_req, res) => {
      res.status(200).json({ ok: true });
    });
    app.patch("/api/v1/admin/settings", (_req, res) => {
      res.status(503).json({ success: false });
    });

    const api = createApiClient(app);
    await api.get("/api/v1/admin/products").expect(200);
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(recordAuditLog).not.toHaveBeenCalled();

    recordAuditLog.mockClear();
    await api.patch("/api/v1/admin/settings").expect(503);
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(recordAuditLog).not.toHaveBeenCalled();
  });

  it("falls back to admin root entity metadata when no path segments exist", async () => {
    const app = express();
    app.use(express.json());
    app.use(responseFormatter);
    app.use(createTestRateLimiter());
    app.use((req, _res, next) => {
      req.user = createAuthenticatedUser({
        id: "admin-4",
        roles: [{ id: "role_admin", name: "admin" }],
      });
      next();
    });
    app.use(requestLogger);
    app.post("/api/v1/admin", (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const api = createApiClient(app);
    await api.post("/api/v1/admin").send({ ping: true }).expect(200);
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });

    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "admin",
        entityId: "root",
      }),
    );
  });
});
