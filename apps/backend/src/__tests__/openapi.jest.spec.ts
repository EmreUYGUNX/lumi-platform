import request from "supertest";

import type * as AppModule from "../app.js";
import { createOpenApiDocument } from "../config/swagger.js";
import { withTemporaryEnvironment } from "../config/testing.js";
import { createTestConfig } from "../testing/config.js";

let createApp: typeof AppModule.createApp | undefined;

const getCreateApp = (): typeof AppModule.createApp => {
  if (!createApp) {
    throw new Error("createApp has not been initialised for tests.");
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

describe("OpenAPI documentation", () => {
  it("returns an OpenAPI 3.1 document with documented endpoints", async () => {
    const config = createTestConfig();
    const app = getCreateApp()({ config });

    const response = await request(app).get("/api/docs/openapi.json").expect(200);

    expect(response.body.openapi).toBe("3.1.0");
    expect(response.body.info?.title).toBe(`${config.app.name} API`);
    expect(response.body.paths?.["/api/v1/health"]?.get?.tags).toContain("Health");
    expect(response.body.paths?.["/internal/metrics"]?.get?.security?.[0]).toHaveProperty(
      "basicAuth",
    );
    expect(response.body.paths?.["/api/v1/products"]?.get).toBeDefined();
  });

  it("exposes a builder for generating documentation outside HTTP context", () => {
    const config = createTestConfig();
    const document = createOpenApiDocument(config);

    expect(document.paths?.["/api/v1/admin/users"]?.get?.responses?.["403"]).toBeDefined();
    expect(document.paths?.["/api/v1/products"]?.get?.summary).toBeDefined();
  });

  it("serves Swagger UI using the configured site title", async () => {
    const config = createTestConfig();
    const app = getCreateApp()({ config });

    const response = await request(app).get("/api/docs/").expect(200);

    expect(response.text).toContain(`<title>${config.app.name} API Reference</title>`);
  });
});
