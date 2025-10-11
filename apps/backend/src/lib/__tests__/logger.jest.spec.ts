// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import TransportStream from "winston-transport";

import { resetEnvironmentCache } from "../../config/env.js";
import { withTemporaryEnvironment } from "../../config/testing.js";

const BASE_ENV = {
  NODE_ENV: "test",
  APP_NAME: "LoggerTest",
  APP_PORT: "4500",
  API_BASE_URL: "http://localhost:4500",
  FRONTEND_URL: "http://localhost:3500",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/test",
  REDIS_URL: "redis://localhost:6379",
  STORAGE_BUCKET: "bucket-test",
  LOG_LEVEL: "info",
  JWT_SECRET: "12345678901234567890123456789012",
  SENTRY_DSN: "",
  LOG_DIRECTORY: "logs",
  LOG_MAX_SIZE: "10m",
  LOG_MAX_FILES: "7d",
  LOG_ENABLE_CONSOLE: "false",
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

class MemoryTransport extends TransportStream {
  public readonly logs: Record<string, unknown>[] = [];

  override log(info: unknown, next: () => void) {
    this.logs.push(info as Record<string, unknown>);
    next();
  }

  override close() {
    return this;
  }
}

const loadLoggerModule = async () => import("../logger.js");
const loadConfigModule = async () => import("../../config/index.js");

beforeEach(() => {
  jest.resetModules();
});

afterEach(() => {
  jest.resetModules();
  resetEnvironmentCache();
});

describe("logger", () => {
  it("enriches log entries with request-scoped context", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const {
        logger,
        registerLogTransport,
        unregisterLogTransport,
        withRequestContext,
        extractStructuredLog,
      } = await loadLoggerModule();

      const transport = new MemoryTransport();
      registerLogTransport("memory", transport);

      withRequestContext({ requestId: "req-123", userId: "user-5" }, () => {
        logger.info("context-test", { flow: "checkout" });
      });

      expect(transport.logs).toHaveLength(1);
      const entry = transport.logs[0];
      expect(entry).toBeDefined();

      const structured = extractStructuredLog(entry!)!;
      const metadata = structured.metadata as Record<string, unknown> | undefined;
      expect(structured).toMatchObject({
        level: "info",
        message: "context-test",
        requestId: "req-123",
        context: expect.objectContaining({
          requestId: "req-123",
          userId: "user-5",
        }),
      });
      expect(metadata?.flow).toBe("checkout");

      unregisterLogTransport("memory");
    });
  });

  it("updates log level when configuration changes", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const { logger } = await loadLoggerModule();
      expect(logger.level).toBe("info");

      process.env.LOG_LEVEL = "error";
      const { reloadConfiguration } = await loadConfigModule();
      reloadConfiguration("unit-test");

      expect(logger.level).toBe("error");
    });
  });

  it("normalises thrown errors via logError helper", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const { logError, registerLogTransport, unregisterLogTransport, extractStructuredLog } =
        await loadLoggerModule();

      const transport = new MemoryTransport();
      registerLogTransport("memory", transport);

      const cause = new Error("Root failure");
      const error = new Error("Top level failure", { cause });

      logError(error, "process failed", { correlationId: "abc" });

      const entry = transport.logs[0];
      expect(entry).toBeDefined();

      const structured = extractStructuredLog(entry!)!;
      const metadata = structured.metadata as Record<string, unknown> | undefined;

      expect(structured).toMatchObject({
        level: "error",
        message: "process failed",
      });
      expect(metadata?.correlationId).toBe("abc");
      expect(metadata?.error).toEqual(
        expect.objectContaining({
          name: "Error",
          message: "Top level failure",
          cause: expect.objectContaining({ message: "Root failure" }),
        }),
      );

      unregisterLogTransport("memory");
    });
  });

  it("supports registering and unregistering external transports", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const {
        logger,
        registerLogTransport,
        unregisterLogTransport,
        listRegisteredTransports,
        extractStructuredLog,
      } = await loadLoggerModule();

      const transport = new MemoryTransport();
      registerLogTransport("memory", transport);

      expect(listRegisteredTransports()).toContain("memory");

      logger.info("first");
      expect(transport.logs).toHaveLength(1);
      const entry = transport.logs[0];
      expect(entry).toBeDefined();
      expect(extractStructuredLog(entry!)).toBeDefined();

      unregisterLogTransport("memory");

      expect(listRegisteredTransports()).not.toContain("memory");

      logger.info("second");
      expect(transport.logs).toHaveLength(1);
    });
  });

  it("merges contextual data when augmenting active request scope", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const { mergeRequestContext, withRequestContext, getRequestContext } =
        await loadLoggerModule();
      withRequestContext({ requestId: "req-456" }, () => {
        mergeRequestContext({ correlationId: "corr-9" });
        expect(getRequestContext()).toMatchObject({
          requestId: "req-456",
          correlationId: "corr-9",
        });
      });
    });
  });

  it("handles malformed structured log payloads gracefully", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const { extractStructuredLog } = await loadLoggerModule();
      expect(extractStructuredLog({})).toBeUndefined();
      const payload = { [Symbol.for("message")]: "not-json" } as Record<string, unknown>;
      expect(extractStructuredLog(payload)).toBeUndefined();
    });
  });

  it("closes existing transports when re-registering with same name", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const { registerLogTransport, unregisterLogTransport, listRegisteredTransports } =
        await loadLoggerModule();
      const first = new MemoryTransport();
      const closeSpy = jest.spyOn(first, "close");
      registerLogTransport("duplicate", first);
      expect(listRegisteredTransports()).toContain("duplicate");

      const replacement = new MemoryTransport();
      registerLogTransport("duplicate", replacement);
      expect(closeSpy).toHaveBeenCalled();
      unregisterLogTransport("duplicate");
    });
  });

  it("creates log directories when disk logging is enabled", async () => {
    const existsSpy = jest.fn().mockReturnValue(false);
    const mkdirSpy = jest.fn().mockReturnValue("tmp-observability-logs");
    jest.doMock("node:fs", () => ({
      existsSync: existsSpy,
      mkdirSync: mkdirSpy,
    }));

    await withTemporaryEnvironment(
      {
        ...BASE_ENV,
        NODE_ENV: "development",
        CI: "false",
        LOG_ENABLE_CONSOLE: "false",
        LOG_DIRECTORY: "tmp-observability-logs",
      },
      async () => {
        await loadLoggerModule();
        const { reloadConfiguration } = await loadConfigModule();
        reloadConfiguration("disk-test");
        expect(existsSpy).toHaveBeenCalled();
        expect(mkdirSpy).toHaveBeenCalled();
      },
    );

    jest.dontMock("node:fs");
  });

  it("serialises unexpected error payloads gracefully", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const { logError, logger } = await loadLoggerModule();
      const errorSpy = jest.spyOn(logger, "error");
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      logError(circular, "circular-error", { scope: "test" });
      expect(errorSpy).toHaveBeenCalledWith(
        "circular-error",
        expect.objectContaining({
          scope: "test",
          error: { message: "[unserializable-error-object]" },
        }),
      );
      errorSpy.mockRestore();
    });
  });
});
