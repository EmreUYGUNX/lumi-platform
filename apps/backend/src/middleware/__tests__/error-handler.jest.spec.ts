import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import express from "express";
import { z } from "zod";

import { createApiClient } from "@lumi/testing";

import { ApiError } from "../../errors/api-error.js";
import * as sentryModule from "../../observability/sentry.js";
import { errorHandler } from "../error-handler.js";
import { responseFormatter } from "../response-formatter.js";

process.env.APP_NAME ??= "BackendTest";
process.env.API_BASE_URL ??= "http://localhost:4000";
process.env.FRONTEND_URL ??= "http://localhost:3000";
process.env.DATABASE_URL ??= "postgres://user:pass@localhost:5432/db";
process.env.REDIS_URL ??= "redis://localhost:6379";
process.env.STORAGE_BUCKET ??= "bucket";
process.env.JWT_SECRET ??= "test-secret-key-value";

jest.mock("../../observability/sentry.js", () => ({
  __esModule: true,
  isSentryEnabled: jest.fn().mockReturnValue(false),
  getSentryInstance: jest.fn(() => ({
    captureException: jest.fn(),
  })),
}));

const mockedSentry = jest.mocked(sentryModule);

describe("error handler middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns structured response for ApiError instances", async () => {
    const app = express();
    app.use(responseFormatter);
    app.get("/boom", () => {
      throw new ApiError("Forbidden", { status: 403 });
    });
    app.use(errorHandler);

    const api = createApiClient(app);
    const response = await api.get("/boom").expect(403);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("maps Zod validation errors to 422 responses", async () => {
    const schema = z.object({
      email: z.string().email(),
    });

    const app = express();
    app.use(express.json());
    app.use(responseFormatter);
    app.post("/validate", (req) => {
      schema.parse(req.body);
    });
    app.use(errorHandler);

    const api = createApiClient(app);
    const response = await api.post("/validate").send({ email: "invalid" }).expect(422);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.details[0].field).toBe("email");
  });

  it("maps Prisma known request errors to appropriate HTTP codes", async () => {
    const app = express();
    app.use(responseFormatter);
    app.get("/conflict", () => {
      throw Object.assign(new Error("Unique constraint failed on the fields: (`email`)"), {
        code: "P2002",
        meta: { target: ["User_email_key"] },
        clientVersion: "5.0.0",
      });
    });
    app.use(errorHandler);

    const api = createApiClient(app);
    const response = await api.get("/conflict").expect(409);
    expect(response.body.error.code).toBe("UNIQUE_CONSTRAINT_VIOLATION");
  });

  it("captures unexpected errors with Sentry when enabled", async () => {
    mockedSentry.isSentryEnabled.mockReturnValue(true);
    const captureSpy = jest.fn();
    mockedSentry.getSentryInstance.mockReturnValue({
      captureException: captureSpy,
    } as never);

    const app = express();
    app.use(responseFormatter);
    app.get("/error", () => {
      throw new Error("boom");
    });
    app.use(errorHandler);

    const api = createApiClient(app);
    const response = await api.get("/error").expect(500);
    expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(captureSpy).toHaveBeenCalled();
  });
});
