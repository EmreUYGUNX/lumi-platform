// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import express from "express";
import request from "supertest";

import { resetEnvironmentCache } from "../../config/env.js";
import { withTemporaryEnvironment } from "../../config/testing.js";

const BASE_ENV = {
  NODE_ENV: "test",
  APP_NAME: "MetricsMiddlewareTest",
  APP_PORT: "4800",
  API_BASE_URL: "http://localhost:4800",
  FRONTEND_URL: "http://localhost:3800",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/test",
  REDIS_URL: "redis://localhost:6379/0",
  STORAGE_BUCKET: "metrics-middleware",
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

describe("metrics middleware", () => {
  it("records HTTP metrics for handled requests", async () => {
    await withTemporaryEnvironment(BASE_ENV, async () => {
      const metrics = await import("../../observability/metrics.js");

      const { createMetricsMiddleware } = await import("../metrics.js");

      const app = express();
      app.use(createMetricsMiddleware());
      app.get("/users/:id", (req, res) => {
        res.json({
          success: true,
          data: {
            id: req.params.id,
          },
        });
      });

      await request(app).get("/users/42").expect(200);

      const snapshot = await metrics.getMetricsSnapshot();
      expect(snapshot).toContain("lumi_http_requests_total");
      expect(snapshot).toContain('route="/users/:id"');
      expect(snapshot).toContain('status="200"');
    });
  });
});
