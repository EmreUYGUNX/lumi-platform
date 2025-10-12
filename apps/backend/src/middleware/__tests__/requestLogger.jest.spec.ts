// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import express from "express";
import request from "supertest";
import type { Logger as WinstonLogger } from "winston";

import { resetEnvironmentCache } from "../../config/env.js";
import { withTemporaryEnvironment } from "../../config/testing.js";
import type { LogMetadata } from "../../lib/logger.js";
import { createRequestIdMiddleware } from "../requestId.js";
import { captureRequestError, createRequestLoggingMiddleware } from "../requestLogger.js";

const BASE_ENV = {
  NODE_ENV: "test",
  APP_NAME: "RequestLoggerTest",
  APP_PORT: "4600",
  API_BASE_URL: "http://localhost:4600",
  FRONTEND_URL: "http://localhost:3600",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/test",
  REDIS_URL: "redis://localhost:6379",
  STORAGE_BUCKET: "bucket-test",
  LOG_LEVEL: "info",
  LOG_ENABLE_CONSOLE: "false",
  LOG_REQUEST_SAMPLE_RATE: "1",
  JWT_SECRET: "12345678901234567890123456789012",
  METRICS_ENABLED: "false",
  METRICS_ENDPOINT: "/metrics",
  METRICS_COLLECT_DEFAULT: "false",
  METRICS_DEFAULT_INTERVAL: "5000",
  ALERTING_ENABLED: "false",
  HEALTH_UPTIME_GRACE_PERIOD: "10",
  FEATURE_FLAGS: "{}",
  CONFIG_HOT_RELOAD: "false",
  CI: "true",
} as const;

interface CapturedLog {
  level: string;
  message: string;
  metadata: Record<string, unknown>;
}

type LoggerMethod = WinstonLogger["info"];

type LogErrorMethod = (error: unknown, message?: string, metadata?: LogMetadata) => void;

const normaliseError = (error: unknown) => {
  if (error instanceof Error) {
    return { message: error.message, name: error.name };
  }
  return { message: String(error) };
};

const createLogCollector = () => {
  const records: CapturedLog[] = [];

  const infoMock = jest.fn((message: string, metadata?: Record<string, unknown>) => {
    records.push({ level: "info", message, metadata: metadata ?? {} });
  });
  const warnMock = jest.fn((message: string, metadata?: Record<string, unknown>) => {
    records.push({ level: "warn", message, metadata: metadata ?? {} });
  });
  const errorMock = jest.fn((message: string, metadata?: Record<string, unknown>) => {
    records.push({ level: "error", message, metadata: metadata ?? {} });
  });
  const logErrorMock = jest.fn((error: unknown, message?: string, metadata: LogMetadata = {}) => {
    records.push({
      level: "error",
      message: message ?? "log-error",
      metadata: { ...metadata, error: normaliseError(error) },
    });
  });

  const restore = () => {
    infoMock.mockReset();
    warnMock.mockReset();
    errorMock.mockReset();
    logErrorMock.mockReset();
  };

  return {
    logger: {
      info: infoMock as unknown as LoggerMethod,
      warn: warnMock as unknown as LoggerMethod,
      error: errorMock as unknown as LoggerMethod,
    },
    logError: logErrorMock as unknown as LogErrorMethod,
    records,
    restore,
  };
};

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use(createRequestIdMiddleware());
  return app;
};

const loadConfigModule = () => import("../../config/index.js");

beforeEach(() => {
  jest.resetModules();
});

afterEach(() => {
  resetEnvironmentCache();
});

describe("request logging middleware", () => {
  it("logs structured metadata with sanitised payloads", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const { getConfig } = await loadConfigModule();
      const config = getConfig();
      const { logger, logError, records, restore } = createLogCollector();

      try {
        const app = buildApp();
        app.locals.config = config;
        app.use(createRequestLoggingMiddleware(config, { logger, logError }));

        app.post("/checkout", (req, res) => {
          res.status(201).json({ success: true });
        });

        await request(app)
          .post("/checkout")
          .set("User-Agent", "jest-suite")
          .set("Content-Type", "application/json")
          .send({
            email: "user@example.com",
            password: "super-secret",
            token: "abc123",
          })
          .expect(201);

        await new Promise<void>((resolve) => {
          setImmediate(resolve);
        });

        const entry = records.find((record) => record.level === "info");
        expect(entry).toBeDefined();
        expect(entry?.message).toBe("HTTP request completed");
        expect(entry?.metadata).toMatchObject({
          method: "POST",
          path: "/checkout",
          statusCode: 201,
          userAgent: "jest-suite",
        });
        expect(entry?.metadata.correlationId).toBeDefined();
        const body = entry?.metadata.requestBody as string | undefined;
        expect(body).toBeDefined();
        expect(body).toContain('"password":"[REDACTED]"');
        expect(body).toContain('"token":"[REDACTED]"');
        expect(body).not.toContain("super-secret");
        expect(body).not.toContain("abc123");
        expect(entry?.metadata.redactedFields).toEqual(
          expect.arrayContaining(["password", "token"]),
        );
      } finally {
        restore();
      }
    });
  });

  it("skips sampled successes while preserving error logging", async () => {
    await withTemporaryEnvironment(
      {
        ...BASE_ENV,
        LOG_REQUEST_SAMPLE_RATE: "0",
      },
      async () => {
        const { getConfig } = await loadConfigModule();
        const config = getConfig();
        const { logger, logError, records, restore } = createLogCollector();

        try {
          const app = buildApp();
          app.locals.config = config;
          app.use(createRequestLoggingMiddleware(config, { logger, logError }));

          app.get("/ping", (req, res) => {
            res.json({ ok: true });
          });

          app.get("/fail", (req, res) => {
            const error = new Error("boom");
            captureRequestError(res, error);
            res.status(500).json({ success: false });
          });

          await request(app).get("/ping").expect(200);
          expect(records.filter((record) => record.level === "info")).toHaveLength(0);

          await request(app).get("/fail").expect(500);
          await new Promise<void>((resolve) => {
            setImmediate(resolve);
          });

          const entry = records.find((record) => record.level === "error");
          expect(entry).toBeDefined();
          expect(entry?.message).toBe("HTTP request failed");
          expect(entry?.metadata.statusCode).toBe(500);
          const payload = entry?.metadata.error as Record<string, unknown> | undefined;
          expect(payload?.message).toBe("boom");
        } finally {
          restore();
        }
      },
    );
  });

  it("flags truncated payloads when exceeding configured limits", async () => {
    await withTemporaryEnvironment(
      {
        ...BASE_ENV,
        LOG_REQUEST_MAX_BODY_LENGTH: "48",
      },
      async () => {
        const { getConfig } = await loadConfigModule();
        const config = getConfig();
        const { logger, logError, records, restore } = createLogCollector();

        try {
          const app = buildApp();
          app.locals.config = config;
          app.use(createRequestLoggingMiddleware(config, { logger, logError }));

          app.post("/notes", (req, res) => {
            res.status(200).json({ stored: true });
          });

          await request(app)
            .post("/notes")
            .set("Content-Type", "application/json")
            .send({
              note: "a".repeat(200),
            })
            .expect(200);

          await new Promise<void>((resolve) => {
            setImmediate(resolve);
          });

          const entry = records.find((record) => record.level === "info");
          expect(entry).toBeDefined();
          expect(entry?.metadata.requestBodyTruncated).toBe(true);
          const body = entry?.metadata.requestBody as string | undefined;
          expect(body).toBeDefined();
          expect(body?.endsWith("...")).toBe(true);
        } finally {
          restore();
        }
      },
    );
  });
});
