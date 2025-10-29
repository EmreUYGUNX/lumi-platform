import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import express from "express";

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

const recordAuditLog = auditLogModule.recordAuditLog as unknown as jest.Mock;

describe("request logger middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("masks sensitive payloads before logging warnings or errors", async () => {
    const app = express();
    app.use(express.json());
    app.use(responseFormatter);
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
});
