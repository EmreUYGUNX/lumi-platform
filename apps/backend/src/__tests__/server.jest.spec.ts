import { EventEmitter } from "node:events";
import { createServer as createHttpServer } from "node:http";
import type { Server } from "node:http";
import type { AddressInfo, Socket } from "node:net";

import type { Logger as WinstonLogger } from "winston";

import { withTemporaryEnvironment } from "../config/testing.js";
import type * as ServerModule from "../server.js";
import { createTestConfig } from "../testing/config.js";

type ProcessEvent = NodeJS.Signals | "uncaughtException" | "unhandledRejection" | "exit";
type ProcessListenerFn = (...args: unknown[]) => unknown;

let cachedStartServer: typeof ServerModule.startServer | undefined;
let loggerInstance: WinstonLogger | undefined;
type ServerInternals = typeof ServerModule.serverInternals;

let serverInternalsRef: ServerInternals | undefined;
let infoSpy: jest.SpyInstance;
let errorSpy: jest.SpyInstance;
let warnSpy: jest.SpyInstance;
let initialExitCode: number | undefined;

const getStartServer = (): typeof ServerModule.startServer => {
  if (!cachedStartServer) {
    throw new Error("startServer has not been initialised for the test environment.");
  }

  return cachedStartServer;
};

const getLogger = (): WinstonLogger => {
  if (!loggerInstance) {
    throw new Error("Logger has not been initialised for the test environment.");
  }

  return loggerInstance;
};

const getServerInternals = (): ServerInternals => {
  if (!serverInternalsRef) {
    throw new Error("Server internals have not been initialised for the test environment.");
  }

  return serverInternalsRef;
};

const getNewListener = (event: ProcessEvent, before: ProcessListenerFn[]) => {
  const listeners = process.listeners(event as never) as ProcessListenerFn[];
  return listeners.find((listener) => !before.includes(listener));
};

const getExistingListeners = (event: ProcessEvent): ProcessListenerFn[] =>
  process.listeners(event as never).map((listener) => listener as ProcessListenerFn);

describe("startServer", () => {
  beforeEach(() => {
    initialExitCode = typeof process.exitCode === "number" ? process.exitCode : undefined;
  });

  beforeAll(async () => {
    await withTemporaryEnvironment(
      {
        NODE_ENV: "test",
        APP_NAME: "Lumi Test Backend",
        APP_PORT: "4100",
        API_BASE_URL: "http://localhost:4100",
        FRONTEND_URL: "http://localhost:3100",
        DATABASE_URL: "postgresql://localhost:5432/lumi",
        REDIS_URL: "redis://localhost:6379/0",
        STORAGE_BUCKET: "lumi-test-bucket",
        JWT_SECRET: "test-secret-ensure-length-32chars!!",
      },
      async () => {
        const serverModule = await import("../server.js");
        cachedStartServer = serverModule.startServer;
        serverInternalsRef = serverModule.serverInternals;
        ({ startServer: cachedStartServer } = await import("../server.js"));
        const loggerModule = await import("../lib/logger.js");
        loggerInstance = loggerModule.logger;
      },
    );

    const logger = getLogger();
    infoSpy = jest.spyOn(logger, "info").mockImplementation(() => logger);
    errorSpy = jest.spyOn(logger, "error").mockImplementation(() => logger);
    warnSpy = jest.spyOn(logger, "warn").mockImplementation(() => logger);
  });

  afterEach(() => {
    infoSpy.mockClear();
    errorSpy.mockClear();
    warnSpy.mockClear();
    process.exitCode = initialExitCode;
  });

  afterAll(() => {
    infoSpy.mockRestore();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  class FakeSocket extends EventEmitter {
    destroyed = false;

    setKeepAliveCalls = 0;

    timeoutMs: number | undefined;

    endCalls = 0;

    shouldThrowOnEnd = false;

    autoCloseDelayMs: number | undefined;

    constructor(options: { shouldThrowOnEnd?: boolean; autoCloseDelayMs?: number } = {}) {
      super();
      this.shouldThrowOnEnd = options.shouldThrowOnEnd ?? false;
      this.autoCloseDelayMs = options.autoCloseDelayMs;
    }

    setKeepAlive(): this {
      this.setKeepAliveCalls += 1;
      return this;
    }

    setTimeout(timeout: number): this {
      this.timeoutMs = timeout;
      return this;
    }

    end(): this {
      this.endCalls += 1;

      if (this.shouldThrowOnEnd) {
        throw new Error("socket end failure");
      }

      if (this.autoCloseDelayMs === undefined) {
        return this;
      }

      if (this.autoCloseDelayMs === 0) {
        this.emit("close");
        return this;
      }

      setTimeout(() => {
        this.emit("close");
      }, this.autoCloseDelayMs).unref?.();

      return this;
    }

    destroy(): this {
      this.destroyed = true;
      this.emit("close");
      return this;
    }
  }

  it("resolves the active port when binding to an ephemeral socket", async () => {
    const config = createTestConfig({ app: { port: 4100 } });

    const controller = await getStartServer()({
      config,
      port: 0,
      enableSignalHandlers: false,
    });

    expect(controller.server.listening).toBe(true);
    expect(controller.port).toBeGreaterThan(0);
    expect(controller.app.get("port")).toBe(config.app.port);

    await controller.shutdown({ reason: "test-suite" });
  });

  it("sets shutdown state while draining active connections", async () => {
    const controller = await getStartServer()({
      config: createTestConfig(),
      port: 0,
      enableSignalHandlers: false,
    });

    expect(controller.isShuttingDown()).toBe(false);

    const shutdownPromise = controller.shutdown({ reason: "test-shutdown" });
    expect(controller.isShuttingDown()).toBe(true);

    await shutdownPromise;
    expect(controller.isShuttingDown()).toBe(false);
  });

  it("returns the same shutdown promise when invoked multiple times", async () => {
    const controller = await getStartServer()({
      config: createTestConfig(),
      port: 0,
      enableSignalHandlers: false,
    });

    const first = controller.shutdown({ reason: "initial" });
    const second = controller.shutdown({ reason: "duplicate" });

    await first;
    await second;
  });

  it("logs a warning when rate limiter cleanup fails during shutdown", async () => {
    const controller = await getStartServer()({
      config: createTestConfig(),
      port: 0,
      enableSignalHandlers: false,
    });

    controller.app.set("rateLimiterCleanup", async () => {
      throw new Error("redis cleanup failure");
    });

    await controller.shutdown({ reason: "test-cleanup" });

    expect(warnSpy).toHaveBeenCalledWith("Rate limiter cleanup failed during shutdown", {
      error: expect.any(Error),
    });
  });

  it("forces lingering sockets to be destroyed when shutdown times out", async () => {
    jest.useFakeTimers();

    try {
      const controller = await getStartServer()({
        config: createTestConfig(),
        port: 0,
        enableSignalHandlers: false,
        shutdownTimeoutMs: 25,
      });

      const fakeSocket = new FakeSocket({ autoCloseDelayMs: undefined });
      controller.server.emit("connection", fakeSocket as unknown as Socket);

      const shutdownPromise = controller.shutdown({ reason: "timeout-test" });

      await jest.advanceTimersByTimeAsync(30);
      await shutdownPromise;

      expect(fakeSocket.setKeepAliveCalls).toBeGreaterThan(0);
      expect(fakeSocket.endCalls).toBe(1);
      expect(fakeSocket.destroyed).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it("destroys sockets immediately when socket.end throws", async () => {
    const controller = await getStartServer()({
      config: createTestConfig(),
      port: 0,
      enableSignalHandlers: false,
      shutdownTimeoutMs: 50,
    });

    const fakeSocket = new FakeSocket({ shouldThrowOnEnd: true });
    controller.server.emit("connection", fakeSocket as unknown as Socket);

    await controller.shutdown({ reason: "end-throws" });

    expect(fakeSocket.endCalls).toBe(1);
    expect(fakeSocket.destroyed).toBe(true);
  });

  it("responds to SIGTERM by performing a graceful shutdown", async () => {
    const sigtermListenersBefore = getExistingListeners("SIGTERM");

    const controller = await getStartServer()({
      config: createTestConfig(),
      port: 0,
    });

    const newListener = getNewListener("SIGTERM", sigtermListenersBefore);
    expect(newListener).toBeDefined();

    await (newListener as (...args: unknown[]) => Promise<void> | void)?.();

    expect(process.exitCode).toBe(0);
    expect(process.listeners("SIGTERM")).toEqual(sigtermListenersBefore);

    await controller.shutdown({ reason: "post-signal-cleanup" });
  });

  it("handles uncaught exceptions by setting the exit code to 1", async () => {
    const uncaughtBefore = getExistingListeners("uncaughtException");

    const controller = await getStartServer()({
      config: createTestConfig(),
      port: 0,
    });

    const newListener = getNewListener("uncaughtException", uncaughtBefore);
    expect(newListener).toBeDefined();

    await (newListener as (error: unknown) => Promise<void> | void)?.(new Error("boom"));

    expect(process.exitCode).toBe(1);
    expect(process.listeners("uncaughtException")).toEqual(uncaughtBefore);

    await controller.shutdown({ reason: "post-exception-cleanup" });
  });

  it("handles unhandled rejections by setting the exit code to 1", async () => {
    const unhandledBefore = getExistingListeners("unhandledRejection");

    const controller = await getStartServer()({
      config: createTestConfig(),
      port: 0,
    });

    const newListener = getNewListener("unhandledRejection", unhandledBefore);
    expect(newListener).toBeDefined();

    await (newListener as (reason: unknown) => Promise<void> | void)?.("reason");

    expect(process.exitCode).toBe(1);
    expect(process.listeners("unhandledRejection")).toEqual(unhandledBefore);

    await controller.shutdown({ reason: "post-rejection-cleanup" });
  });

  it("rejects when the requested port is already in use", async () => {
    const occupiedServer = createHttpServer();

    await new Promise<void>((resolve) => {
      occupiedServer.listen(0, resolve);
    });

    const address = occupiedServer.address() as AddressInfo;

    await expect(
      getStartServer()({
        config: createTestConfig(),
        port: address.port,
        enableSignalHandlers: false,
      }),
    ).rejects.toThrow();

    await new Promise<void>((resolve, reject) => {
      occupiedServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  });

  it("reports string and unknown server addresses correctly", () => {
    const internals = getServerInternals();

    infoSpy.mockClear();

    const stringResult = internals.logServerAddress("unix:/tmp/server.sock", 4321);
    expect(stringResult).toBe(4321);

    const defaultResult = internals.logServerAddress(undefined as unknown as AddressInfo, 9876);
    expect(defaultResult).toBe(9876);

    expect(infoSpy).toHaveBeenCalledWith("HTTP server listening", {
      path: "unix:/tmp/server.sock",
    });
    expect(infoSpy).toHaveBeenCalledWith("HTTP server listening", { port: 9876 });
  });

  it("reports structured server addresses when provided", async () => {
    const config = createTestConfig();
    const controller = await getStartServer()({
      config,
      port: 0,
      enableSignalHandlers: false,
    });

    const internals = getServerInternals();
    infoSpy.mockClear();

    const address = controller.server.address() as AddressInfo;
    const resolvedPort = internals.logServerAddress(address, 9999);

    expect(resolvedPort).toBe(address.port);
    expect(infoSpy).toHaveBeenCalledWith("HTTP server listening", {
      address: address.address,
      port: address.port,
      family: address.family,
    });

    await controller.shutdown({ reason: "address-check" });
  });

  it("propagates errors thrown when closing the server", async () => {
    const internals = getServerInternals();

    const fakeServer = {
      close: (callback?: (error?: Error | undefined) => void) => {
        callback?.(new Error("close failure"));
        return fakeServer;
      },
    } as unknown as Server;

    await expect(internals.createServerClosePromise(fakeServer)).rejects.toThrow("close failure");
  });

  it("logs an error when draining connections fails", async () => {
    const internals = getServerInternals();

    const tracker = {
      count: () => 3,
      drain: async () => {
        throw new Error("drain failure");
      },
    } as unknown as Parameters<ServerInternals["drainConnectionsSafely"]>[0];

    const initialInfoCalls = infoSpy.mock.calls.length;
    const initialErrorCalls = errorSpy.mock.calls.length;

    await internals.drainConnectionsSafely(tracker, 15);

    expect(infoSpy.mock.calls.length).toBeGreaterThan(initialInfoCalls);
    expect(errorSpy.mock.calls.length).toBeGreaterThan(initialErrorCalls);
    const lastErrorCall = errorSpy.mock.calls.at(-1);
    expect(lastErrorCall?.[0]).toBe("Failed to drain connections cleanly");
  });

  it("registerSignalHandlers skips registration when disabled", () => {
    const internals = getServerInternals();
    const register = jest.fn();
    const executeShutdown = jest.fn();
    const cleanup = jest.fn();

    internals.registerSignalHandlers(false, register, executeShutdown, cleanup);

    expect(register).not.toHaveBeenCalled();
    expect(executeShutdown).not.toHaveBeenCalled();
    expect(cleanup).not.toHaveBeenCalled();
  });

  it("registerSignalHandlers logs failures when executeShutdown rejects", async () => {
    const internals = getServerInternals();
    type HandlerEvent = NodeJS.Signals | "uncaughtException" | "unhandledRejection" | "exit";
    type RegisteredHandlers = Partial<
      Record<HandlerEvent, (...args: unknown[]) => Promise<void> | void>
    >;

    const handlers: RegisteredHandlers = {};
    const register = jest.fn(
      (event: HandlerEvent, handler: (...args: unknown[]) => Promise<void> | void) => {
        handlers[event] = handler;
      },
    );

    const executeShutdown = jest.fn().mockRejectedValue(new Error("shutdown failure"));
    const cleanup = jest.fn();

    internals.registerSignalHandlers(true, register, executeShutdown, cleanup);

    expect(register).toHaveBeenCalledTimes(5);

    const initialErrorCalls = errorSpy.mock.calls.length;

    await handlers.SIGTERM?.();
    let lastError = errorSpy.mock.calls.at(-1);
    expect(lastError?.[0]).toBe("Failed to shut down after SIGTERM");

    await handlers.SIGINT?.();
    lastError = errorSpy.mock.calls.at(-1);
    expect(lastError?.[0]).toBe("Failed to shut down after SIGINT");

    await handlers.uncaughtException?.(new Error("boom"));
    lastError = errorSpy.mock.calls.at(-1);
    expect(lastError?.[0]).toBe("Failed to shut down after uncaught exception");

    await handlers.unhandledRejection?.("reason");
    lastError = errorSpy.mock.calls.at(-1);
    expect(lastError?.[0]).toBe("Failed to shut down after unhandled rejection");

    expect(errorSpy.mock.calls.length).toBeGreaterThan(initialErrorCalls);

    handlers.exit?.(123);
    const lastInfo = infoSpy.mock.calls.at(-1);
    expect(lastInfo?.[0]).toBe("Process exiting");
    expect(lastInfo?.[1]).toEqual({ code: 123 });
    expect(cleanup).toHaveBeenCalled();
  });

  it("setExitCodeIfNeeded honours explicit exit codes", () => {
    const internals = getServerInternals();

    internals.setExitCodeIfNeeded(true, 5, undefined);
    expect(process.exitCode).toBe(5);

    internals.setExitCodeIfNeeded(false, 7, undefined);
    expect(process.exitCode).toBe(5);
  });

  it("logs an error when server close fails during shutdown", async () => {
    const controller = await getStartServer()({
      config: createTestConfig(),
      port: 0,
      enableSignalHandlers: false,
    });

    const closeSpy = jest.spyOn(controller.server, "close").mockImplementation((callback) => {
      callback?.(new Error("close failure"));
      return controller.server;
    });

    try {
      const initialErrorCalls = errorSpy.mock.calls.length;

      await controller.shutdown({ reason: "close-failure" });

      expect(errorSpy.mock.calls.length).toBeGreaterThan(initialErrorCalls);
      const lastErrorCall = errorSpy.mock.calls.at(-1);
      expect(lastErrorCall?.[0]).toBe("HTTP server close failed");
    } finally {
      closeSpy.mockRestore();

      if (controller.server.listening) {
        await new Promise<void>((resolve, reject) => {
          controller.server.close((error) => {
            if (error) {
              reject(error);
              return;
            }

            resolve();
          });
        });
      }
    }
  });

  it("sets exit code to zero when exitAfterShutdown is requested without an error", () => {
    const internals = getServerInternals();

    internals.setExitCodeIfNeeded(true, undefined, undefined);

    expect(process.exitCode).toBe(0);
  });

  it("sets exit code to one when exitAfterShutdown encounters an error", () => {
    const internals = getServerInternals();

    internals.setExitCodeIfNeeded(true, undefined, new Error("exit failure"));

    expect(process.exitCode).toBe(1);
  });
});
