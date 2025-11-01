import { createApiClient } from "@lumi/testing";

import type * as AppModule from "../app.js";
import { withTemporaryEnvironment } from "../config/testing.js";
import { createTestConfig } from "../testing/config.js";

let createApp: typeof AppModule.createApp | undefined;

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
      ({ createApp } = await import("../app.js"));
    },
  );
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
});
