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

  it("normalises pagination metadata supplied as primitive values", () => {
    const response = formatSuccess(
      { ok: true },
      {
        requestId: "req-3",
        pagination: {
          page: "2",
          perPage: "5",
          total: "37",
          totalPages: 999,
        } as unknown as ReturnType<typeof buildPaginationMeta>,
      },
    );

    expect(response.meta.pagination).toEqual({
      page: 2,
      perPage: 5,
      total: 37,
      totalPages: 8,
    });
  });

  it("wraps unformatted error payloads to match the standard structure", async () => {
    const app = express();
    app.use(responseFormatter);
    app.get("/error", (_req, res) => {
      res.status(500).json({ message: "boom" });
    });

    const api = createApiClient(app);
    const response = await api.get("/error").expect(500);
    const body = response.body as ErrorResponse;

    expect(body.success).toBe(false);
    expect(body.error.code).toBe("UNHANDLED_ERROR");
    expect(body.error.message).toBe("An unexpected error occurred");
  });

  it("honours explicit error payloads without full response envelopes", async () => {
    const app = express();
    app.use(responseFormatter);
    app.get("/explicit", (_req, res) => {
      res.status(400).json({
        code: "INPUT_INVALID",
        message: "Bad input",
        details: ["Email address invalid"],
      });
    });

    const api = createApiClient(app);
    const response = await api.get("/explicit").expect(400);
    const body = response.body as ErrorResponse;

    expect(body.error.code).toBe("INPUT_INVALID");
    expect(body.error.details?.[0]?.message).toBe("Email address invalid");
  });

  it("preserves formatted success payloads that already include metadata", async () => {
    const app = express();
    app.use(responseFormatter);
    app.get("/success", (_req, res) => {
      res.json(
        formatSuccess(
          { ok: true },
          {
            requestId: "existing",
            pagination: buildPaginationMeta({ page: 1, perPage: 10, total: 10 }),
          },
        ),
      );
    });

    const api = createApiClient(app);
    const response = await api.get("/success").expect(200);
    const body = response.body as SuccessResponse<{ ok: boolean }>;

    expect(body.meta.requestId).toBe("existing");
    expect(body.meta.pagination?.totalPages).toBe(1);
  });
});
