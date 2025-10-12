import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import express from "express";
import type { ErrorRequestHandler, Express, Request, RequestHandler, Response } from "express";
import request from "supertest";

import { createApp } from "../../app.js";
import { AppError, ERROR_CODES, ValidationError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { registerRoute } from "../../routes/registry.js";
import { createTestConfig } from "../../testing/config.js";
import { registerErrorHandlers } from "../errorHandler.js";

const triggerRefresh = (app: Express) => {
  const refresh = app.get("refreshErrorHandlers") as (() => void) | undefined;
  refresh?.();
};

const createCircularError = () => {
  const details: Record<string, unknown> = {};
  details.self = details;
  return new AppError("Circular", 500, {
    code: ERROR_CODES.INTERNAL,
    details,
    exposeDetails: true,
  });
};

const createDetailLessError = () =>
  new AppError("Oops", 500, {
    code: ERROR_CODES.INTERNAL,
    exposeDetails: true,
  });

describe("global error handling middleware", () => {
  let warnSpy: jest.SpiedFunction<typeof logger.warn>;
  let errorSpy: jest.SpiedFunction<typeof logger.error>;

  beforeAll(() => {
    warnSpy = jest.spyOn(logger, "warn").mockImplementation(() => logger);
    errorSpy = jest.spyOn(logger, "error").mockImplementation(() => logger);
  });

  beforeEach(() => {
    warnSpy.mockClear();
    errorSpy.mockClear();
  });

  afterAll(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("returns Q2 compliant payload for unknown routes", async () => {
    const app = createApp({ config: createTestConfig() });

    const response = await request(app).get("/unknown-route").expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("NOT_FOUND");
    expect(response.body.error.message).toBe("Resource not found.");
    expect(response.body.error).not.toHaveProperty("stack");
    expect(response.body.meta.requestId).toBeDefined();
    expect(warnSpy).toHaveBeenCalled();
  });

  it("returns 405 with allowed methods for disallowed verb", async () => {
    const app = createApp({ config: createTestConfig() });

    const response = await request(app).post("/api/v1/health").expect(405);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("METHOD_NOT_ALLOWED");
    expect(
      response.header.allow
        ?.split(",")
        .map((entry) => entry.trim())
        .sort(),
    ).toEqual(["GET", "HEAD"]);
    expect(response.body.error.details.allowedMethods).toContain("GET");
  });

  it("falls through to subsequent handlers when no alternative methods exist", async () => {
    const app = createApp({ config: createTestConfig() });
    const registry = app.get("routeRegistry");

    if (registry) {
      registerRoute(registry, "HEAD", "/api/orphan");
    }

    const response = await request(app).head("/api/orphan").expect(404);

    expect(response.headers.allow).toBeUndefined();
  });

  it("masks internal error details while logging the incident", async () => {
    const app = createApp({ config: createTestConfig() });
    const registry = app.get("routeRegistry");

    if (registry) {
      registerRoute(registry, "GET", "/api/v1/error-trigger");
    }

    app.get("/api/v1/error-trigger", () => {
      throw new Error("boom");
    });
    triggerRefresh(app);

    const response = await request(app).get("/api/v1/error-trigger").expect(500);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(response.body.error.message).toBe("Internal server error.");
    expect(response.body.error).not.toHaveProperty("details");
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
  });

  it("captures errors thrown from async handlers via express-async-errors integration", async () => {
    const app = createApp({ config: createTestConfig() });
    const registry = app.get("routeRegistry");

    if (registry) {
      registerRoute(registry, "GET", "/api/v1/async-error");
    }

    app.get("/api/v1/async-error", async () => {
      throw new Error("async failure");
    });
    triggerRefresh(app);

    const response = await request(app).get("/api/v1/async-error").expect(500);

    expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
  });

  it("includes validation details for operational errors", async () => {
    const app = createApp({ config: createTestConfig() });
    const registry = app.get("routeRegistry");

    if (registry) {
      registerRoute(registry, "GET", "/api/v1/validation-error");
    }

    app.get("/api/v1/validation-error", () => {
      throw new ValidationError("Invalid payload", {
        issues: [{ path: "email", message: "Invalid email" }],
      });
    });
    triggerRefresh(app);

    const response = await request(app).get("/api/v1/validation-error").expect(400);

    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.details.issues).toEqual([
      { path: "email", message: "Invalid email" },
    ]);
  });

  it("propagates allowed methods metadata for unknown routes with registry entries", async () => {
    const app = createApp({ config: createTestConfig() });
    const registry = app.get("routeRegistry");

    if (registry) {
      registerRoute(registry, "GET", "/ghost");
    }

    const response = await request(app).get("/ghost").expect(404);

    expect(response.body.error.details.allowedMethods).toEqual(["GET"]);
  });

  it("exposes stack traces in development environment", async () => {
    const app = createApp({
      config: createTestConfig({ app: { environment: "development" } }),
    });
    const registry = app.get("routeRegistry");

    if (registry) {
      registerRoute(registry, "GET", "/api/v1/dev-error");
    }

    app.get("/api/v1/dev-error", () => {
      const error: AppError = new ValidationError("Invalid payload", {
        issues: [{ path: "name", message: "Required" }],
      });
      error.stack = "custom-stack";
      throw error;
    });
    triggerRefresh(app);

    const response = await request(app).get("/api/v1/dev-error").expect(400);

    expect(response.body.error.stack).toBe("custom-stack");
  });

  it("normalises non-error thrown values", async () => {
    const app = createApp({ config: createTestConfig() });
    const registry = app.get("routeRegistry");

    if (registry) {
      registerRoute(registry, "GET", "/api/object-error");
    }

    app.get("/api/object-error", () => {
      class PlainFailure {
        details = "boom";
      }

      throw new PlainFailure();
    });
    triggerRefresh(app);

    const response = await request(app).get("/api/object-error").expect(500);

    expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(response.body.error.message).toBe("Internal server error.");
  });

  it("removes unserialisable error details from responses", async () => {
    const app = createApp({ config: createTestConfig() });
    const registry = app.get("routeRegistry");

    if (registry) {
      registerRoute(registry, "GET", "/api/circular-error");
    }

    app.get("/api/circular-error", () => {
      throw createCircularError();
    });
    triggerRefresh(app);

    const response = await request(app).get("/api/circular-error").expect(500);

    expect(response.body.error.details).toBeUndefined();
  });

  it("forwards processing when the response has already been sent", () => {
    const config = createTestConfig();
    const app = createApp({ config });
    const handlers = registerErrorHandlers(app, config);
    const globalHandler = handlers.at(-1) as ErrorRequestHandler;

    const next = jest.fn();
    const res = { headersSent: true } as unknown as Response;
    const simulatedError = new Error("handled");

    globalHandler(simulatedError, {} as Request, res, next);

    expect(next).toHaveBeenCalledWith(simulatedError);
  });

  it("omits details when none are provided despite expose flag", async () => {
    const app = createApp({ config: createTestConfig() });
    const registry = app.get("routeRegistry");

    if (registry) {
      registerRoute(registry, "GET", "/api/detail-less");
    }

    app.get("/api/detail-less", () => {
      throw createDetailLessError();
    });
    triggerRefresh(app);

    const response = await request(app).get("/api/detail-less").expect(500);

    expect(response.body.error.details).toBeUndefined();
  });

  it("delegates when registry information is unavailable", () => {
    const config = createTestConfig();
    const app = express();
    app.locals.config = config;

    const [methodHandler] = registerErrorHandlers(app, config) as [RequestHandler];
    const next = jest.fn();

    methodHandler(
      {
        app: undefined,
        method: "GET",
        baseUrl: "",
        path: "/ghost",
        originalUrl: "/ghost",
      } as unknown as Request,
      {} as Response,
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("invokes error flow when headers are already sent for method handler", () => {
    const config = createTestConfig();
    const app = createApp({ config });
    const [methodHandler] = registerErrorHandlers(app, config) as [RequestHandler];
    const next = jest.fn();
    methodHandler(
      {
        app,
        method: "DELETE",
        baseUrl: "",
        path: "/api/v1/health",
        originalUrl: "/api/v1/health",
      } as unknown as Request,
      {
        headersSent: true,
      } as unknown as Response,
      next,
    );

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
