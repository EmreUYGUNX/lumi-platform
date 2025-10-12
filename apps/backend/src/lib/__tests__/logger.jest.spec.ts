/* eslint-disable max-classes-per-file */
import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

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

const installRotationMock = () => {
  const instances: {
    close: jest.Mock;
    dirname?: string;
  }[] = [];

  jest.doMock("winston-daily-rotate-file", () => {
    class DailyRotateFile extends TransportStream {
      public readonly dirname: string | undefined;

      private readonly closeMock = jest.fn();

      constructor(options: Record<string, unknown>) {
        super(options);
        this.dirname = options.dirname as string | undefined;
        instances.push({
          close: this.closeMock,
          dirname: this.dirname,
        });
      }

      // eslint-disable-next-line class-methods-use-this
      override log(_info: unknown, next: () => void): void {
        next();
      }

      override close(): void {
        this.closeMock();
      }
    }

    return DailyRotateFile;
  });

  return instances;
};

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

  it("creates rotating file transports when disk logging is enabled", async () => {
    jest.resetModules();
    const rotationInstances = installRotationMock();

    const tempDirectory = path.join(process.cwd(), "logs-test-suite");
    if (existsSync(tempDirectory)) {
      rmSync(tempDirectory, { recursive: true, force: true });
    }

    try {
      await withTemporaryEnvironment(
        {
          ...BASE_ENV,
          NODE_ENV: "production",
          LOG_ENABLE_CONSOLE: "true",
          LOG_DIRECTORY: "logs-test-suite",
          CI: "false",
        },
        async () => {
          const { logger } = await loadLoggerModule();
          const { getConfig } = await loadConfigModule();
          const config = getConfig();

          expect(config.app.environment).toBe("production");
          expect(config.runtime.ci).toBe(false);
          expect(existsSync(tempDirectory)).toBe(true);

          const rotationTransports = logger.transports.filter(
            (transport) => transport.constructor?.name === "DailyRotateFile",
          );
          expect(rotationTransports).toHaveLength(2);
          expect(rotationInstances).toHaveLength(2);

          logger.close();
          await new Promise<void>((resolve) => {
            setImmediate(resolve);
          });
        },
      );
    } finally {
      jest.dontMock("winston-daily-rotate-file");
      jest.resetModules();
      if (existsSync(tempDirectory)) {
        rmSync(tempDirectory, { recursive: true, force: true });
      }
    }
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

  it("stringifies primitive error payloads", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const { logError, logger } = await loadLoggerModule();
      const errorSpy = jest.spyOn(logger, "error");
      logError(404, "primitive-error");
      expect(errorSpy).toHaveBeenCalledWith(
        "primitive-error",
        expect.objectContaining({
          error: { message: "404" },
        }),
      );
      errorSpy.mockRestore();
    });
  });

  it("shuts down console transport when disabled at runtime", async () => {
    await withTemporaryEnvironment(
      {
        ...BASE_ENV,
        LOG_ENABLE_CONSOLE: "true",
      },
      async () => {
        const { logger } = await loadLoggerModule();
        const consoleTransport = logger.transports.find(
          (transport) => transport.constructor?.name === "Console",
        );
        expect(consoleTransport).toBeDefined();
        if (!consoleTransport) {
          throw new Error("Console transport not initialised");
        }
        const closeSpy = jest.fn();
        // eslint-disable-next-line no-param-reassign
        (consoleTransport as { close?: () => void }).close = closeSpy;

        process.env.LOG_ENABLE_CONSOLE = "false";
        const { reloadConfiguration } = await loadConfigModule();
        reloadConfiguration("console-disable");

        expect(closeSpy).toHaveBeenCalled();
        const hasConsole = logger.transports.some(
          (transport) => transport.constructor?.name === "Console",
        );
        expect(hasConsole).toBe(false);
      },
    );
  });

  it("closes rotation transports when disk logging is disabled", async () => {
    jest.resetModules();
    const rotationInstances = installRotationMock();
    const tempDirectory = path.join(process.cwd(), "logs-rotate-close");
    if (existsSync(tempDirectory)) {
      rmSync(tempDirectory, { recursive: true, force: true });
    }
    mkdirSync(tempDirectory, { recursive: true });

    try {
      await withTemporaryEnvironment(
        {
          ...BASE_ENV,
          NODE_ENV: "production",
          CI: "false",
          LOG_ENABLE_CONSOLE: "false",
          LOG_DIRECTORY: "logs-rotate-close",
        },
        async () => {
          const { logger } = await loadLoggerModule();
          const rotationTransports = logger.transports.filter(
            (transport) => transport.constructor?.name === "DailyRotateFile",
          );
          expect(rotationTransports).toHaveLength(2);
          expect(rotationInstances).toHaveLength(2);
          rotationInstances.forEach(({ close }) => {
            expect(close).not.toHaveBeenCalled();
          });

          process.env.CI = "true";
          const { reloadConfiguration } = await loadConfigModule();
          reloadConfiguration("disable-disk");

          rotationInstances.forEach(({ close }) => {
            expect(close).toHaveBeenCalled();
          });
          const hasRotation = logger.transports.some(
            (transport) => transport.constructor?.name === "DailyRotateFile",
          );
          expect(hasRotation).toBe(false);

          logger.close();
          await new Promise<void>((resolve) => {
            setImmediate(resolve);
          });
        },
      );
    } finally {
      jest.dontMock("winston-daily-rotate-file");
      jest.resetModules();
      if (existsSync(tempDirectory)) {
        rmSync(tempDirectory, { recursive: true, force: true });
      }
    }
  });

  it("renders colourised console output in pretty mode", async () => {
    jest.resetModules();
    jest.doMock("winston-daily-rotate-file", () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
      const MockedTransportStream = require("winston-transport");
      return class MockRotationTransport extends MockedTransportStream {
        public readonly dirname: string | undefined;

        constructor(options: Record<string, unknown>) {
          super(options);
          this.dirname = options.dirname as string | undefined;
        }

        // eslint-disable-next-line class-methods-use-this
        log(_info: unknown, next: () => void): void {
          next();
        }
      };
    });

    try {
      const prettyDirectory = path.join(process.cwd(), "logs-pretty-mode");
      mkdirSync(prettyDirectory, { recursive: true });

      await withTemporaryEnvironment(
        {
          ...BASE_ENV,
          NODE_ENV: "development",
          LOG_ENABLE_CONSOLE: "true",
          CI: "false",
          LOG_DIRECTORY: "logs-pretty-mode",
        },
        async () => {
          const { logger, withRequestContext } = await loadLoggerModule();
          const consoleTransport = logger.transports.find(
            (transport) => transport.constructor?.name === "Console",
          );
          expect(consoleTransport).toBeDefined();
          if (!consoleTransport) {
            throw new Error("Console transport not initialised");
          }
          const messageKey = Symbol.for("message");
          const emitted: string[] = [];
          const logSpy = jest.spyOn(consoleTransport, "log").mockImplementation((info, next) => {
            emitted.push(info[messageKey] as string);
            next();
          });

          withRequestContext({ requestId: "pretty-req" }, () => {
            logger.info("pretty-output", { correlationId: "corr-1" });
          });

          expect(emitted).toHaveLength(1);
          expect(emitted[0]).toContain("[request:pretty-req]");
          expect(emitted[0]).toContain('"correlationId":"corr-1"');
          logSpy.mockRestore();
        },
      );
    } finally {
      jest.dontMock("winston-daily-rotate-file");
      jest.resetModules();
    }
  });

  it("ignores unregister requests for unknown transports", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const { unregisterLogTransport, listRegisteredTransports } = await loadLoggerModule();
      expect(() => unregisterLogTransport("missing" as string)).not.toThrow();
      expect(listRegisteredTransports()).not.toContain("missing");
    });
  });

  it("returns undefined when structured payload serialisation fails", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const { extractStructuredLog } = await loadLoggerModule();
      const payload = { count: BigInt(42) } as unknown as Record<string, unknown>;
      expect(extractStructuredLog(payload)).toBeUndefined();
    });
  });
});
