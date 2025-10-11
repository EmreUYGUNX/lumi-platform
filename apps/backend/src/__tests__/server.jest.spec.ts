import type { Logger as WinstonLogger } from "winston";

import { withTemporaryEnvironment } from "../config/testing.js";
import type * as ServerModule from "../server.js";
import { createTestConfig } from "../testing/config.js";

let cachedStartServer: typeof ServerModule.startServer | undefined;
let loggerInstance: WinstonLogger | undefined;
let infoSpy: jest.SpyInstance;
let errorSpy: jest.SpyInstance;

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

describe("startServer", () => {
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
        JWT_SECRET: "test-secret-ensure-length",
      },
      async () => {
        ({ startServer: cachedStartServer } = await import("../server.js"));
        const loggerModule = await import("../lib/logger.js");
        loggerInstance = loggerModule.logger;
      },
    );

    const logger = getLogger();
    infoSpy = jest.spyOn(logger, "info").mockImplementation(() => logger);
    errorSpy = jest.spyOn(logger, "error").mockImplementation(() => logger);
  });

  afterEach(() => {
    infoSpy.mockClear();
    errorSpy.mockClear();
  });

  afterAll(() => {
    infoSpy.mockRestore();
    errorSpy.mockRestore();
  });

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
});
