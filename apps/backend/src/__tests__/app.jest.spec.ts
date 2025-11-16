import { createApiClient } from "@lumi/testing";

import type * as AppModule from "../app.js";
import { withTemporaryEnvironment } from "../config/testing.js";
import type { createChildLogger } from "../lib/logger.js";
import type { resolveRouter as resolveRouterType } from "../middleware/errorHandler.js";
import { createTestConfig } from "../testing/config.js";

type ChildLoggerFactory = typeof createChildLogger;

const queueLoggerDouble = {
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};
const queueLoggerMock = queueLoggerDouble as unknown as ReturnType<ChildLoggerFactory>;

const getMediaQueueControllerMock = jest.fn();

jest.mock("../queues/media.queue.js", () => ({
  __esModule: true,
  getMediaQueueController: (...args: unknown[]) => getMediaQueueControllerMock(...args),
}));

const createQueueControllerDouble = () => ({
  scheduleDailyCleanup: jest.fn(() => Promise.resolve()),
  scheduleWeeklyTransformationRegeneration: jest.fn(() => Promise.resolve()),
  enqueueWebhookEvent: jest.fn(() => Promise.resolve({ jobId: "webhook" })),
  enqueueCleanupNow: jest.fn(() => Promise.resolve({ jobId: "cleanup" })),
  enqueueTransformationRegeneration: jest.fn(() => Promise.resolve({ jobId: "regen" })),
  shutdown: jest.fn(() => Promise.resolve()),
});

let createApp: typeof AppModule.createApp | undefined;
let createChildLoggerSpy:
  | jest.SpyInstance<ReturnType<ChildLoggerFactory>, Parameters<ChildLoggerFactory>>
  | undefined;
let originalCreateChildLogger: ChildLoggerFactory | undefined;

const getCreateApp = (): typeof AppModule.createApp => {
  if (!createApp) {
    throw new Error("createApp factory has not been initialised for the test environment.");
  }

  return createApp;
};

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
      JWT_SECRET: "abcdefghijklmnopqrstuvwxyzABCDEF",
    },
    async () => {
      const loggerModule = await import("../lib/logger.js");
      originalCreateChildLogger = loggerModule.createChildLogger;
      createChildLoggerSpy = jest
        .spyOn(loggerModule, "createChildLogger")
        .mockImplementation((component: string) => {
          if (component === "media:queue:init") {
            return queueLoggerMock;
          }
          return originalCreateChildLogger!(component);
        });

      ({ createApp } = await import("../app.js"));
    },
  );
});

beforeEach(() => {
  queueLoggerDouble.warn.mockClear();
  queueLoggerDouble.info.mockClear();
  queueLoggerDouble.error.mockClear();
  queueLoggerDouble.debug.mockClear();
  getMediaQueueControllerMock.mockReset();
  getMediaQueueControllerMock.mockImplementation(() => createQueueControllerDouble());
});

afterAll(() => {
  createChildLoggerSpy?.mockRestore();
});

describe("createApp", () => {
  it("attaches the provided configuration to app locals", () => {
    const config = createTestConfig();
    const app = getCreateApp()({ config });

    expect(app.locals.config).toBe(config);
    expect(app.get("port")).toBe(config.app.port);
  });

  it("disables trust proxy outside staging and production", () => {
    const config = createTestConfig({ app: { environment: "development" } });
    const app = getCreateApp()({ config });

    expect(app.get("trust proxy")).toBe(false);
  });

  it("enables single-hop trust proxy when running behind load balancers", () => {
    const productionConfig = createTestConfig({ app: { environment: "production" } });
    const stagingConfig = createTestConfig({ app: { environment: "staging" } });

    expect(getCreateApp()({ config: productionConfig }).get("trust proxy")).toBe(1);
    expect(getCreateApp()({ config: stagingConfig }).get("trust proxy")).toBe(1);
  });

  it("exposes the OpenAPI document via the docs route with no-store caching", async () => {
    const config = createTestConfig();
    const app = getCreateApp()({ config });
    const client = createApiClient(app);

    const response = await client.get("/api/docs/openapi.json").expect(200);

    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body?.openapi).toBe("3.1.0");
    expect(response.body?.info?.title).toContain(config.app.name);
  });

  it("refreshes registered error handlers when explicitly invoked", () => {
    const config = createTestConfig();
    const app = getCreateApp()({ config });

    const refreshErrorHandlers = app.get("refreshErrorHandlers") as (() => void) | undefined;
    expect(typeof refreshErrorHandlers).toBe("function");

    const storedLayers = [{ name: "error-layer" }];
    app.set("errorHandlerLayers", storedLayers as unknown as []);

    const sentinelLayer = { name: "sentinel" };
    const customRouter = { stack: [sentinelLayer, storedLayers[0]] };
    Reflect.set(app as unknown as Record<string, unknown>, "_router", customRouter);

    refreshErrorHandlers?.();

    expect(customRouter.stack.at(-1)).toBe(storedLayers.at(-1));
    expect(customRouter.stack).toContain(sentinelLayer);
  });

  it("skips refresh work when no stored error handlers exist", () => {
    const config = createTestConfig();
    const app = getCreateApp()({ config });

    const refreshErrorHandlers = app.get("refreshErrorHandlers") as (() => void) | undefined;
    expect(typeof refreshErrorHandlers).toBe("function");

    app.set("errorHandlerLayers", []);
    const originalRouter = Reflect.get(app as unknown as Record<string, unknown>, "_router");
    Reflect.set(app as unknown as Record<string, unknown>, "_router", undefined);

    expect(() => refreshErrorHandlers?.()).not.toThrow();

    Reflect.set(app as unknown as Record<string, unknown>, "_router", originalRouter);
  });

  it("guards API documentation with an access token when configured", async () => {
    const config = createTestConfig();
    const previousToken = process.env.API_DOCS_ACCESS_TOKEN;
    process.env.API_DOCS_ACCESS_TOKEN = "top-secret";

    try {
      const app = getCreateApp()({ config });
      const client = createApiClient(app);

      await client.get("/api/docs/openapi.json").expect(401);

      const authorised = await client
        .get("/api/docs/openapi.json")
        .set("x-docs-access", "top-secret")
        .expect(200);

      expect(authorised.body?.openapi).toBe("3.1.0");
    } finally {
      if (previousToken) {
        process.env.API_DOCS_ACCESS_TOKEN = previousToken;
      } else {
        delete process.env.API_DOCS_ACCESS_TOKEN;
      }
    }
  });

  it("disables docs route responses in production when no token is configured", async () => {
    const config = createTestConfig({ app: { environment: "production" } });
    delete process.env.API_DOCS_ACCESS_TOKEN;

    const app = getCreateApp()({ config });
    const client = createApiClient(app);

    const response = await client.get("/api/docs").expect(404);

    expect(response.body?.error?.code).toBe("DOCS_DISABLED");
  });

  it("logs queue scheduling failures without interrupting app creation", async () => {
    const config = createTestConfig();
    const cleanupError = new Error("cleanup fail");
    const transformationError = new Error("transformation fail");
    const queue = createQueueControllerDouble();
    queue.scheduleDailyCleanup.mockRejectedValue(cleanupError);
    queue.scheduleWeeklyTransformationRegeneration.mockRejectedValue(transformationError);
    getMediaQueueControllerMock.mockImplementationOnce(() => queue);

    const app = getCreateApp()({ config });
    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });

    expect(queue.scheduleDailyCleanup).toHaveBeenCalled();
    expect(queue.scheduleWeeklyTransformationRegeneration).toHaveBeenCalled();
    expect(queueLoggerDouble.warn).toHaveBeenCalledWith("Failed to schedule media cleanup job", {
      error: cleanupError,
    });
    expect(queueLoggerDouble.warn).toHaveBeenCalledWith(
      "Failed to schedule media transformation job",
      {
        error: transformationError,
      },
    );
    expect(typeof app.get("mediaQueueCleanup")).toBe("function");
  });

  it("initialises the router when refreshing error handlers without an active stack", () => {
    const config = createTestConfig();
    const app = getCreateApp()({ config });
    const refreshErrorHandlers = app.get("refreshErrorHandlers") as (() => void) | undefined;

    const storedLayers = [{ name: "error-layer" }];
    app.set("errorHandlerLayers", storedLayers as unknown as []);

    const appWithRouter = app as unknown as { lazyrouter?: () => void };
    const originalLazyRouter = appWithRouter.lazyrouter;
    const lazyrouterMock = jest.fn(() => {
      originalLazyRouter?.call(app);
    });
    Reflect.set(appWithRouter, "lazyrouter", lazyrouterMock);

    const errorHandlerModule = jest.requireActual("../middleware/errorHandler.js") as {
      resolveRouter: resolveRouterType;
    };
    const originalResolveRouter = errorHandlerModule.resolveRouter;
    const resolveRouterSpy = jest
      .spyOn(errorHandlerModule, "resolveRouter")
      .mockImplementationOnce(() => undefined as never)
      .mockImplementation((...args) => originalResolveRouter(...args));

    refreshErrorHandlers?.();

    expect(resolveRouterSpy).toHaveBeenCalled();
    expect(lazyrouterMock).toHaveBeenCalled();
    resolveRouterSpy.mockRestore();
    const router = originalResolveRouter(app);
    expect(router?.stack).toEqual(expect.arrayContaining(storedLayers));

    if (originalLazyRouter) {
      Reflect.set(appWithRouter, "lazyrouter", originalLazyRouter);
    } else {
      Reflect.deleteProperty(appWithRouter, "lazyrouter");
    }
  });
});
