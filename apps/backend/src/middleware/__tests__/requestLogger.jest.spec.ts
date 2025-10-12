// eslint-disable-next-line import/no-extraneous-dependencies
import { EventEmitter } from "node:events";

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import express from "express";
import type { Request, Response } from "express";
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

  it("logs server failures with complex payload structures", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const { getConfig } = await loadConfigModule();
      const config = getConfig();
      const { logger, logError, records, restore } = createLogCollector();

      try {
        const middleware = createRequestLoggingMiddleware(config, { logger, logError });

        const req = Object.assign(new EventEmitter(), {
          method: "POST",
          originalUrl: "/upload",
          url: "/upload",
          ip: "127.0.0.1",
          httpVersion: "1.1",
          app: { locals: { config } },
        }) as unknown as Request & EventEmitter;

        const nested: Record<string, unknown> = {};
        let cursor = nested;
        for (let depth = 0; depth < 6; depth += 1) {
          const nextLevel: Record<string, unknown> = {};
          // eslint-disable-next-line security/detect-object-injection -- Controlled test scaffold.
          cursor.next = nextLevel;
          cursor = nextLevel;
        }

        const circular: Record<string, unknown> = {};
        circular.self = circular;

        const complexPayload = {
          text: "hello",
          buffer: Buffer.from("payload"),
          createdAt: new Date("2025-01-01T00:00:00Z"),
          bigInt: BigInt(42),
          symbol: Symbol("token"),
          fn: () => "noop",
          set: new Set(["alpha", "beta"]),
          map: new Map<unknown, unknown>([
            ["stringKey", "value"],
            [{ nestedKey: true }, { deep: "value" }],
          ]),
          nested,
          circular,
        };

        req.body = complexPayload;
        const inboundHeaders: Record<string, string | number | string[] | undefined> = {
          "user-agent": "jest-agent",
          "content-length": 128,
        };
        req.get = ((name: string) => inboundHeaders[name.toLowerCase()]) as Request["get"];

        const responses: Record<string, string | number | string[] | undefined> = {
          "content-length": 256,
        };

        const res = Object.assign(new EventEmitter(), {
          locals: { requestId: "req-complex" },
          statusCode: 500,
          getHeader: ((name: string) => responses[name.toLowerCase()]) as Response["getHeader"],
          setHeader: jest.fn(),
        }) as unknown as Response & EventEmitter;

        middleware(req, res, jest.fn());

        res.emit("finish");

        await new Promise<void>((resolve) => {
          setImmediate(resolve);
        });

        const errorEntry = records.find((record) => record.level === "error");
        expect(errorEntry).toBeDefined();
        expect(errorEntry?.metadata.statusCode).toBe(500);
        expect(errorEntry?.metadata.missingError).toBe(true);
        expect(errorEntry?.metadata.correlationId).toBe("req-complex");
        expect(errorEntry?.metadata.requestContentLength).toBe(128);
        expect(errorEntry?.metadata.responseContentLength).toBe(256);

        const serialised = errorEntry?.metadata.requestBody as string | undefined;
        expect(serialised).toBeDefined();
        expect(serialised).toContain("[binary:");
        expect(serialised).toContain('["alpha","beta"]');
        expect(serialised).toContain('"Symbol(token)"');
        expect(serialised).toContain("[Function]");
        expect(serialised).toContain('"[Circular]"');
        expect(serialised).toContain('{\\"nestedKey\\":true}');
        expect(serialised).toContain("[DepthExceeded]");
      } finally {
        restore();
      }
    });
  });

  it("records lifecycle metadata when response emits an error", async () => {
    await withTemporaryEnvironment(
      {
        ...BASE_ENV,
        LOG_REQUEST_SAMPLE_RATE: "0.5",
      },
      async () => {
        const { getConfig } = await loadConfigModule();
        const config = getConfig();
        const { logger, logError, records, restore } = createLogCollector();
        const randomSpy = jest.spyOn(Math, "random").mockReturnValue(0.9);

        try {
          const middleware = createRequestLoggingMiddleware(config, { logger, logError });

          const req = Object.assign(new EventEmitter(), {
            method: "GET",
            originalUrl: "/unstable",
            url: "/unstable",
            id: "req-error",
            ip: "127.0.0.1",
            httpVersion: "1.1",
            app: { locals: { config } },
            body: "   hello world   ",
          }) as unknown as Request & EventEmitter;

          const inboundHeaders: Record<string, string | number | string[] | undefined> = {
            "user-agent": "jest-agent",
            "content-length": 42,
          };
          req.get = ((name: string) => inboundHeaders[name.toLowerCase()]) as Request["get"];

          const res = Object.assign(new EventEmitter(), {
            locals: { requestId: "req-error" },
            statusCode: 0,
            getHeader: (() => {}) as Response["getHeader"],
            setHeader: jest.fn(),
          }) as unknown as Response & EventEmitter;

          middleware(req, res, jest.fn());

          const failure = new Error("socket failure");
          captureRequestError(res, failure);
          res.emit("error", failure);

          await new Promise<void>((resolve) => {
            setImmediate(resolve);
          });

          const logEntry = records.find((entry) => entry.level === "error");
          expect(logEntry).toBeDefined();
          expect(logEntry?.metadata.lifecycle).toBe("error");
          expect(logEntry?.metadata.statusCode).toBe(500);
          expect(logEntry?.metadata.sampled).toBe(false);
          expect(logEntry?.metadata.requestBody).toBe("hello world");
        } finally {
          restore();
          randomSpy.mockRestore();
        }
      },
    );
  });

  it("serialises raw buffer payloads without truncation", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const { getConfig } = await loadConfigModule();
      const config = getConfig();
      const { logger, logError, records, restore } = createLogCollector();

      try {
        const middleware = createRequestLoggingMiddleware(config, { logger, logError });

        const req = Object.assign(new EventEmitter(), {
          method: "PUT",
          originalUrl: "/binary",
          url: "/binary",
          ip: "127.0.0.1",
          httpVersion: "1.1",
          app: { locals: { config } },
          body: Buffer.from("payload"),
        }) as unknown as Request & EventEmitter;

        const headers: Record<string, string | number | string[] | undefined> = {
          "user-agent": "jest-agent",
          "content-length": "7",
        };
        req.get = ((name: string) => headers[name.toLowerCase()]) as Request["get"];

        const res = Object.assign(new EventEmitter(), {
          locals: { requestId: "req-buffer" },
          statusCode: 204,
          getHeader: (() => {}) as Response["getHeader"],
          setHeader: jest.fn(),
        }) as unknown as Response & EventEmitter;

        middleware(req, res, jest.fn());
        res.emit("finish");

        await new Promise<void>((resolve) => {
          setImmediate(resolve);
        });

        const infoEntry = records.find((entry) => entry.level === "info");
        expect(infoEntry).toBeDefined();
        expect(infoEntry?.metadata.statusCode).toBe(204);
        expect(infoEntry?.metadata.requestBody).toBe("[binary:7 bytes]");
        expect(infoEntry?.metadata.requestBodyTruncated).toBeUndefined();
      } finally {
        restore();
      }
    });
  });

  it("logs aborted requests with lifecycle metadata when responses close early", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const { getConfig } = await loadConfigModule();
      const config = getConfig();
      const { logger, logError, records, restore } = createLogCollector();

      try {
        const middleware = createRequestLoggingMiddleware(config, { logger, logError });

        const req = Object.assign(new EventEmitter(), {
          method: "DELETE",
          url: "/api/resource",
          baseUrl: "/api",
          route: { path: "/resource/:id" },
          ip: "127.0.0.1",
        }) as unknown as Request & EventEmitter;

        const headers: Record<string, string | number | string[] | undefined> = {};
        req.get = ((name: string) => headers[name.toLowerCase()]) as Request["get"];

        const res = Object.assign(new EventEmitter(), {
          locals: { requestId: "req-close" },
          statusCode: 0,
          // eslint-disable-next-line unicorn/no-useless-undefined
          getHeader: (() => undefined) as Response["getHeader"],
          setHeader: jest.fn(),
        }) as unknown as Response & EventEmitter;

        middleware(req, res, jest.fn());
        res.emit("close");

        await new Promise<void>((resolve) => {
          setImmediate(resolve);
        });

        const warnEntry = records.find((entry) => entry.level === "warn");
        expect(warnEntry).toBeDefined();
        expect(warnEntry?.message).toBe("HTTP request completed with client error");
        expect(warnEntry?.metadata.lifecycle).toBe("close");
        expect(warnEntry?.metadata.statusCode).toBe(499);
        expect(warnEntry?.metadata.baseUrl).toBe("/api");
        expect(warnEntry?.metadata.route).toBe("/resource/:id");
        expect(warnEntry?.metadata.path).toBe("/api/resource");
        expect(warnEntry?.metadata.httpVersion).toBeUndefined();
        expect(warnEntry?.metadata.requestBody).toBeUndefined();
        expect(warnEntry?.metadata.sampled).toBe(true);
      } finally {
        restore();
      }
    });
  });

  it("falls back to placeholder payloads when serialisation fails", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const { getConfig } = await loadConfigModule();
      const config = getConfig();
      const { logger, logError, records, restore } = createLogCollector();
      const stringifySpy = jest.spyOn(JSON, "stringify");

      try {
        const originalStringify = JSON.stringify;
        stringifySpy.mockImplementationOnce(() => {
          throw new TypeError("serialise failure");
        });
        stringifySpy.mockImplementation(originalStringify);

        const middleware = createRequestLoggingMiddleware(config, { logger, logError });

        const req = Object.assign(new EventEmitter(), {
          method: "POST",
          originalUrl: "/unsafe",
          url: "/unsafe",
          ip: "127.0.0.1",
          httpVersion: "1.1",
          app: { locals: { config } },
          body: {
            password: "sensitive-value",
            note: "hello",
          },
        }) as unknown as Request & EventEmitter;

        const headers: Record<string, string | number | string[] | undefined> = {
          "user-agent": "jest-agent",
        };
        req.get = ((name: string) => headers[name.toLowerCase()]) as Request["get"];

        const res = Object.assign(new EventEmitter(), {
          locals: { requestId: "req-unserializable" },
          statusCode: 200,
          // eslint-disable-next-line unicorn/no-useless-undefined
          getHeader: (() => undefined) as Response["getHeader"],
          setHeader: jest.fn(),
        }) as unknown as Response & EventEmitter;

        middleware(req, res, jest.fn());
        res.emit("finish");

        await new Promise<void>((resolve) => {
          setImmediate(resolve);
        });

        const infoEntry = records.find((entry) => entry.level === "info");
        expect(infoEntry).toBeDefined();
        expect(infoEntry?.metadata.requestBody).toBe("[Unserializable]");
        expect(infoEntry?.metadata.redactedFields).toEqual(["password"]);
        expect(infoEntry?.metadata.requestBodyTruncated).toBeUndefined();
      } finally {
        stringifySpy.mockRestore();
        restore();
      }
    });
  });

  it("omits empty object payloads from structured metadata", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const { getConfig } = await loadConfigModule();
      const config = getConfig();
      const { logger, logError, records, restore } = createLogCollector();

      try {
        const middleware = createRequestLoggingMiddleware(config, { logger, logError });

        const req = Object.assign(new EventEmitter(), {
          method: "GET",
          originalUrl: "/empty",
          url: "/empty",
          ip: "127.0.0.1",
          httpVersion: "1.1",
          app: { locals: { config } },
          body: {},
        }) as unknown as Request & EventEmitter;

        const emptyHeaders: Record<string, string | number | string[] | undefined> = {
          "user-agent": "jest-agent",
          "content-length": 10,
        };
        req.get = ((name: string) => emptyHeaders[name.toLowerCase()]) as Request["get"];

        const res = Object.assign(new EventEmitter(), {
          locals: { requestId: "req-empty" },
          statusCode: 200,
          getHeader: (() => {}) as Response["getHeader"],
          setHeader: jest.fn(),
        }) as unknown as Response & EventEmitter;

        middleware(req, res, jest.fn());
        res.emit("finish");

        await new Promise<void>((resolve) => {
          setImmediate(resolve);
        });

        const infoEntry = records.find((entry) => entry.level === "info");
        expect(infoEntry).toBeDefined();
        expect(infoEntry?.metadata.requestBody).toBeUndefined();
        expect(infoEntry?.metadata.redactedFields).toBeUndefined();
      } finally {
        restore();
      }
    });
  });

  it("skips whitespace-only bodies while serialising primitive payloads", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const { getConfig } = await loadConfigModule();
      const config = getConfig();
      const { logger, logError, records, restore } = createLogCollector();

      try {
        const middleware = createRequestLoggingMiddleware(config, { logger, logError });

        const primitiveReq = Object.assign(new EventEmitter(), {
          method: "PATCH",
          originalUrl: "/numbers",
          url: "/numbers",
          ip: "127.0.0.1",
          httpVersion: "1.1",
          app: { locals: { config } },
          body: 42,
        }) as unknown as Request & EventEmitter;

        const primitiveHeaders: Record<string, string | string[] | undefined> = {
          "user-agent": "jest-agent",
        };
        primitiveReq.get = ((name: string) =>
          primitiveHeaders[name.toLowerCase()]) as Request["get"];

        const primitiveRes = Object.assign(new EventEmitter(), {
          locals: { requestId: "req-number" },
          statusCode: 201,
          getHeader: (() => {}) as Response["getHeader"],
          setHeader: jest.fn(),
        }) as unknown as Response & EventEmitter;

        middleware(primitiveReq, primitiveRes, jest.fn());
        primitiveRes.emit("finish");

        await new Promise<void>((resolve) => {
          setImmediate(resolve);
        });

        const numberEntry = records.find((entry) => entry.metadata.path === "/numbers");
        expect(numberEntry).toBeDefined();
        expect(numberEntry?.metadata.requestBody).toBe("42");
        expect(numberEntry?.metadata.requestBodyTruncated).toBeUndefined();

        const trimmedReq = Object.assign(new EventEmitter(), {
          method: "POST",
          originalUrl: "/trimmed",
          url: "/trimmed",
          ip: "127.0.0.1",
          httpVersion: "1.1",
          app: { locals: { config } },
          body: "    ",
        }) as unknown as Request & EventEmitter;

        trimmedReq.get = ((name: string) => primitiveHeaders[name.toLowerCase()]) as Request["get"];

        const trimmedRes = Object.assign(new EventEmitter(), {
          locals: { requestId: "req-trimmed" },
          statusCode: 200,
          getHeader: (() => {}) as Response["getHeader"],
          setHeader: jest.fn(),
        }) as unknown as Response & EventEmitter;

        middleware(trimmedReq, trimmedRes, jest.fn());
        trimmedRes.emit("finish");

        await new Promise<void>((resolve) => {
          setImmediate(resolve);
        });

        const trimmedEntry = records.find((entry) => entry.metadata.path === "/trimmed");
        expect(trimmedEntry).toBeDefined();
        expect(trimmedEntry?.metadata.requestBody).toBeUndefined();

        const arrayReq = Object.assign(new EventEmitter(), {
          method: "POST",
          originalUrl: "/array",
          url: "/array",
          ip: "127.0.0.1",
          httpVersion: "1.1",
          app: { locals: { config } },
          body: ["alpha", "beta"],
        }) as unknown as Request & EventEmitter;

        arrayReq.get = ((name: string) => primitiveHeaders[name.toLowerCase()]) as Request["get"];

        const arrayRes = Object.assign(new EventEmitter(), {
          locals: { requestId: "req-array" },
          statusCode: 202,
          getHeader: (() => {}) as Response["getHeader"],
          setHeader: jest.fn(),
        }) as unknown as Response & EventEmitter;

        middleware(arrayReq, arrayRes, jest.fn());
        arrayRes.emit("finish");

        await new Promise<void>((resolve) => {
          setImmediate(resolve);
        });

        const arrayEntry = records.find((entry) => entry.metadata.path === "/array");
        expect(arrayEntry).toBeDefined();
        expect(arrayEntry?.metadata.requestBody).toBe('["alpha","beta"]');
      } finally {
        restore();
      }
    });
  });
});
