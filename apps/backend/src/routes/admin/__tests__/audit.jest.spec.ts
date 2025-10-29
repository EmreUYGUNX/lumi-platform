import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import express, { type Router } from "express";

import { createApiClient } from "@lumi/testing";

import * as auditService from "../../../audit/audit-log.service.js";
import type * as ErrorHandlerModule from "../../../middleware/error-handler.js";
import type * as ResponseFormatterModule from "../../../middleware/response-formatter.js";

type ErrorHandlerFn = typeof ErrorHandlerModule.errorHandler;
type ResponseFormatterFn = typeof ResponseFormatterModule.responseFormatter;

process.env.APP_NAME ??= "BackendTest";
process.env.API_BASE_URL ??= "http://localhost:4000";
process.env.FRONTEND_URL ??= "http://localhost:3000";
process.env.DATABASE_URL ??= "postgres://user:pass@localhost:5432/db";
process.env.REDIS_URL ??= "redis://localhost:6379";
process.env.STORAGE_BUCKET ??= "bucket";
process.env.JWT_SECRET ??= "test-secret-key-value";

const passthroughRateLimiter = (
  _req: express.Request,
  _res: express.Response,
  next: express.NextFunction,
) => {
  next();
};

jest.mock("../../../middleware/rate-limiter.js", () => ({
  __esModule: true,
  createAdminRateLimiter: jest.fn(() => passthroughRateLimiter),
}));

jest.mock("../../../audit/audit-log.service.js", () => ({
  __esModule: true,
  queryAuditLogs: jest.fn(),
}));

const mockedAuditService = jest.mocked(auditService);

let auditAdminRouter: Router;
let errorHandler: ErrorHandlerFn;
let responseFormatter: ResponseFormatterFn;

beforeAll(async () => {
  ({ auditAdminRouter } = await import("../audit.js"));
  ({ errorHandler } = await import("../../../middleware/error-handler.js"));
  ({ responseFormatter } = await import("../../../middleware/response-formatter.js"));
});

describe("admin audit log routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects non-admin users with a 403 response", async () => {
    const app = express();
    app.use(responseFormatter);
    app.use((req, _res, next) => {
      req.user = { id: "user-1", role: "customer" };
      next();
    });
    app.use("/api/v1/admin/audit-logs", auditAdminRouter);
    app.use(errorHandler);

    const api = createApiClient(app);
    const response = await api.get("/api/v1/admin/audit-logs").expect(403);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("returns audit log entries for admin users", async () => {
    mockedAuditService.queryAuditLogs.mockResolvedValue({
      data: [
        {
          id: "audit-1",
          action: "product.update",
          entity: "product",
          entityId: "prod-1",
          actorType: "ADMIN",
          userId: "admin-1",
          ipAddress: "127.0.0.1",
          userAgent: "jest",
          before: [],
          after: { metadata: { requestId: "req" } },
          createdAt: new Date("2024-01-01T00:00:00.000Z"),
          updatedAt: new Date("2024-01-01T00:00:00.000Z"),
        },
      ],
      pagination: {
        page: 1,
        perPage: 20,
        total: 1,
        totalPages: 1,
      },
    });

    const app = express();
    app.use(responseFormatter);
    app.use((req, _res, next) => {
      req.user = { id: "admin-1", role: "admin" };
      next();
    });
    app.use("/api/v1/admin/audit-logs", auditAdminRouter);
    app.use(errorHandler);

    const api = createApiClient(app);
    const response = await api.get("/api/v1/admin/audit-logs").expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.meta.pagination.total).toBe(1);
    expect(mockedAuditService.queryAuditLogs).toHaveBeenCalledWith({
      page: undefined,
      perPage: undefined,
      actorType: undefined,
      entity: undefined,
      userId: undefined,
    });
  });
});
