import { describe, expect, it } from "@jest/globals";
import express from "express";

import { createApiClient } from "@lumi/testing";

import {
  type ErrorResponse,
  type SuccessResponse,
  buildPaginationMeta,
  formatError,
  formatSuccess,
  responseFormatter,
} from "../response-formatter.js";

describe("response formatter middleware", () => {
  it("wraps successful responses in Q2 format with generated metadata", async () => {
    const app = express();
    app.use(responseFormatter);
    app.get("/test", (_req, res) => {
      res.json({ hello: "world" });
    });

    const api = createApiClient(app);
    const response = await api.get("/test").expect(200);
    const body = response.body as SuccessResponse<{ hello: string }>;

    expect(body.success).toBe(true);
    expect(body.data).toEqual({ hello: "world" });
    expect(body.meta.requestId).toBeDefined();
    expect(typeof body.meta.timestamp).toBe("string");
  });

  it("preserves incoming request identifiers", async () => {
    const app = express();
    app.use(responseFormatter);
    app.get("/test", (_req, res) => {
      res.json({ hello: "world" });
    });

    const requestId = "11111111-2222-3333-4444-555555555555";
    const api = createApiClient(app);
    const response = await api.get("/test").set("X-Request-Id", requestId).expect(200);
    const body = response.body as SuccessResponse<{ hello: string }>;
    expect(body.meta.requestId).toBe(requestId);
    expect(response.headers["x-request-id"]).toBe(requestId);
  });

  it("exposes helper functions to format success and error responses", () => {
    const success = formatSuccess(
      { ok: true },
      { requestId: "req", pagination: buildPaginationMeta({ page: 1, perPage: 10, total: 25 }) },
    );
    expect(success.success).toBe(true);
    expect(success.meta.requestId).toBe("req");
    expect(success.meta.pagination).toEqual({
      page: 1,
      perPage: 10,
      total: 25,
      totalPages: 3,
    });

    const error = formatError(
      {
        code: "TEST_ERROR",
        message: "Failure",
        details: [{ field: "email", message: "Invalid" }],
      },
      { requestId: "req-2" },
    );

    expect(error.success).toBe(false);
    expect(error.error.code).toBe("TEST_ERROR");
    expect(error.meta.requestId).toBe("req-2");
  });

  it("reformats explicit error responses to guarantee metadata consistency", async () => {
    const app = express();
    app.use(responseFormatter);
    app.get("/test", (_req, res) => {
      const payload: ErrorResponse = {
        success: false,
        error: {
          code: "CUSTOM",
          message: "Custom error",
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: "incoming",
        },
      };
      res.status(400).json(payload);
    });

    const api = createApiClient(app);
    const response = await api.get("/test").expect(400);
    const body = response.body as ErrorResponse;
    expect(body.success).toBe(false);
    expect(body.meta.requestId).toBe("incoming");
    expect(body.error.code).toBe("CUSTOM");
  });
});
