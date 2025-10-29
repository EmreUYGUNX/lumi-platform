import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import express from "express";

import { createApiClient } from "@lumi/testing";

const config = {
  security: {
    validation: {
      maxBodySizeKb: 1,
      strict: true,
    },
  },
};

const getConfigMock = jest.fn(() => config);

jest.mock("../../config/index.js", () => ({
  __esModule: true,
  getConfig: () => getConfigMock(),
}));

const requestLoggerMiddleware = jest.fn(
  (_req: unknown, _res: unknown, next: (error?: unknown) => void) => next(),
);
const requestLogger = jest.fn((req: unknown, res: unknown, next: (error?: unknown) => void) =>
  requestLoggerMiddleware(req, res, next),
);

jest.mock("../../middleware/request-logger.js", () => ({
  __esModule: true,
  requestLogger,
}));

const responseFormatterMiddleware = jest.fn(
  (req: Record<string, unknown>, res: Record<string, unknown>, next: () => void) => {
    const requestId = "test-request";
    req.requestId = requestId;
    res.requestId = requestId;
    const buildMetaPayload = (meta?: Record<string, unknown>) => ({
      requestId,
      timestamp: "2024-01-01T00:00:00.000Z",
      ...(meta ? { ...meta } : {}),
    });

    res.success = (data: unknown, meta?: Record<string, unknown>) =>
      (res as unknown as { json: (body: unknown) => unknown }).json({
        success: true,
        data,
        meta: buildMetaPayload(meta),
      });
    res.error = (error: unknown, meta?: Record<string, unknown>) =>
      (res as unknown as { status: (code: number) => { json: (body: unknown) => unknown } })
        .status(400)
        .json({
          success: false,
          error,
          meta: buildMetaPayload(meta),
        });
    next();
  },
);

const responseFormatter = jest.fn(
  (req: Record<string, unknown>, res: Record<string, unknown>, next: (error?: unknown) => void) =>
    responseFormatterMiddleware(req, res, next),
);

jest.mock("../../middleware/response-formatter.js", () => ({
  __esModule: true,
  responseFormatter,
}));

const errorHandlerMiddleware = jest.fn(
  (
    error: unknown,
    _req: unknown,
    res: Record<string, unknown>,
    _next?: (err?: unknown) => void,
  ) => {
    const status =
      (error as { status?: number; statusCode?: number })?.status ??
      (error as { status?: number; statusCode?: number })?.statusCode ??
      ((error as { type?: string })?.type === "entity.too.large" ? 413 : 500);

    (res as unknown as { status: (code: number) => { json: (body: unknown) => unknown } })
      .status(status)
      .json({
        success: false,
        handled: true,
        message: (error as { message?: string })?.message ?? "error",
      });
  },
);

const errorHandler = jest.fn(
  (
    incomingError: unknown,
    req: Record<string, unknown>,
    res: Record<string, unknown>,
    next: (error?: unknown) => void,
  ) => errorHandlerMiddleware(incomingError, req, res, next),
);

jest.mock("../../middleware/error-handler.js", () => ({
  __esModule: true,
  errorHandler,
}));

jest.mock("../../routes/admin/audit.js", () => {
  const router = express.Router();

  router.get("/", (req, res) => {
    if (typeof res.success === "function") {
      res.success({ route: "audit" });
      return;
    }

    res.json({ success: true, data: { route: "audit" } });
  });

  router.get("/error", (_req, _res, next) => {
    next(new Error("router failure"));
  });

  router.post("/", (req, res) => {
    if (typeof res.success === "function") {
      res.success({ received: req.body });
      return;
    }

    res.json({ success: true, data: { received: req.body } });
  });

  return {
    __esModule: true,
    auditAdminRouter: router,
  };
});

describe("http app factory", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("mounts the admin audit router behind the core middleware stack", async () => {
    const { createHttpApp } = await import("../app.js");
    const app = createHttpApp();
    const api = createApiClient(app);

    const response = await api.get("/api/v1/admin/audit-logs").expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.route).toBe("audit");
    expect(responseFormatterMiddleware).toHaveBeenCalled();
    expect(requestLoggerMiddleware).toHaveBeenCalled();
    expect(getConfigMock).toHaveBeenCalled();
  });

  it("delegates router errors to the global error handler", async () => {
    const { createHttpApp } = await import("../app.js");
    const app = createHttpApp();
    const api = createApiClient(app);

    const response = await api.get("/api/v1/admin/audit-logs/error").expect(500);

    expect(response.body.handled).toBe(true);
    expect(response.body.message).toBe("router failure");
    expect(errorHandlerMiddleware).toHaveBeenCalled();
  });

  it("applies configured body size limits to JSON payloads", async () => {
    const { createHttpApp } = await import("../app.js");
    const app = createHttpApp();
    const api = createApiClient(app);

    const oversizedPayload = {
      message: "a".repeat(2048),
    };

    const response = await api
      .post("/api/v1/admin/audit-logs")
      .send(oversizedPayload)
      .set("content-type", "application/json")
      .expect(413);

    expect(response.body.handled).toBe(true);
    expect(errorHandlerMiddleware).toHaveBeenCalled();
  });
});
