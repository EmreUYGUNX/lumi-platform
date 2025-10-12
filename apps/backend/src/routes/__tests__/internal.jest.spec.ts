// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";

import { resetEnvironmentCache } from "../../config/env.js";
import { withTemporaryEnvironment } from "../../config/testing.js";

const BASE_ENV = {
  NODE_ENV: "test",
  APP_NAME: "InternalRoutesTest",
  APP_PORT: "4900",
  API_BASE_URL: "http://localhost:4900",
  FRONTEND_URL: "http://localhost:3900",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/test",
  REDIS_URL: "redis://localhost:6379/0",
  STORAGE_BUCKET: "internal-routes",
  LOG_LEVEL: "info",
  JWT_SECRET: "12345678901234567890123456789012",
  METRICS_ENABLED: "true",
  METRICS_ENDPOINT: "/metrics",
  METRICS_PREFIX: "lumi_",
  METRICS_COLLECT_DEFAULT: "false",
  METRICS_DEFAULT_INTERVAL: "5000",
  METRICS_BASIC_AUTH_USERNAME: "metrics",
  METRICS_BASIC_AUTH_PASSWORD: "metrics-pass",
  ALERTING_ENABLED: "false",
  HEALTH_UPTIME_GRACE_PERIOD: "0",
  FEATURE_FLAGS: "{}",
  CONFIG_HOT_RELOAD: "false",
  CI: "true",
} as const;

beforeEach(() => {
  jest.resetModules();
});

afterEach(() => {
  resetEnvironmentCache();
  jest.resetModules();
});

const toAuthHeader = (username: string, password: string) => {
  const credentials = `${username}:${password}`;
  return `Basic ${Buffer.from(credentials).toString("base64")}`;
};

describe("internal router", () => {
  it("exposes metrics behind basic authentication", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const { createApp } = await import("../../app.js");
      const app = createApp();

      const response = await request(app)
        .get("/internal/metrics")
        .set("Authorization", toAuthHeader("metrics", "metrics-pass"))
        .expect(200);

      expect(response.headers["content-type"]).toContain("text/plain");
      expect(response.text).toContain("lumi_http_requests_total");
    });
  });

  it("rejects metrics requests without valid credentials", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const { createApp } = await import("../../app.js");
      const app = createApp();

      const response = await request(app).get("/internal/metrics").expect(401);

      expect(response.headers["www-authenticate"]).toContain("Basic realm");
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
    });
  });

  it("returns 503 when metrics are disabled", async () => {
    await withTemporaryEnvironment(
      {
        ...BASE_ENV,
        METRICS_ENABLED: "false",
      },
      async () => {
        const { createApp } = await import("../../app.js");
        const app = createApp();

        const response = await request(app)
          .get("/internal/metrics")
          .set("Authorization", toAuthHeader("metrics", "metrics-pass"))
          .expect(503);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe("METRICS_DISABLED");
      },
    );
  });

  it("returns a health snapshot", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const { createApp } = await import("../../app.js");
      const app = createApp();

      const response = await request(app).get("/internal/health").expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("status");
      expect(response.body.meta).toHaveProperty("environment", "test");
    });
  });
});
