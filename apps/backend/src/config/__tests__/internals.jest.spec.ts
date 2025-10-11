// eslint-disable-next-line import/no-extraneous-dependencies
import { afterAll, beforeAll, describe, expect, it, jest } from "@jest/globals";

import type { ApplicationConfig } from "@lumi/types";

const REQUIRED_ENV = {
  NODE_ENV: "test",
  APP_NAME: "Lumi",
  APP_PORT: "4100",
  API_BASE_URL: "http://localhost:4100",
  FRONTEND_URL: "http://localhost:3100",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/test",
  REDIS_URL: "redis://localhost:6379/0",
  STORAGE_BUCKET: "lumi-testing",
  LOG_LEVEL: "info",
  JWT_SECRET: "12345678901234567890123456789012",
  SENTRY_DSN: "",
  FEATURE_FLAGS: '{"betaCheckout":true}',
  CONFIG_HOT_RELOAD: "false",
  CONFIG_ENCRYPTION_KEY: "",
  CI: "true",
} as const;

interface ConfigInternals {
  flatten: (input: unknown, prefix?: string) => Record<string, unknown>;
  computeDiffKeys: (previous: ApplicationConfig | undefined, next: ApplicationConfig) => string[];
}

const createSecuritySection = (): ApplicationConfig["security"] => ({
  jwtSecret: "development-secret".padEnd(32, "x"),
  cors: {
    enabled: true,
    allowedOrigins: ["http://localhost:3000"],
    allowedMethods: ["GET", "POST"],
    allowedHeaders: ["content-type", "authorization"],
    exposedHeaders: ["x-request-id"],
    allowCredentials: true,
    maxAgeSeconds: 600,
  },
  headers: {
    enabled: true,
    contentSecurityPolicy: "default-src 'self';",
    referrerPolicy: "strict-origin-when-cross-origin",
    frameGuard: "DENY",
    permissionsPolicy: "camera=(), microphone=()",
    strictTransportSecurity: {
      maxAgeSeconds: 63_072_000,
      includeSubDomains: true,
      preload: true,
    },
    expectCt: {
      enforce: false,
      maxAgeSeconds: 0,
      reportUri: undefined,
    },
    crossOriginEmbedderPolicy: "require-corp",
    crossOriginOpenerPolicy: "same-origin",
    crossOriginResourcePolicy: "same-site",
    xContentTypeOptions: "nosniff",
  },
  rateLimit: {
    enabled: true,
    keyPrefix: "test",
    points: 120,
    durationSeconds: 60,
    blockDurationSeconds: 300,
    strategy: "memory",
  },
  validation: {
    strict: true,
    sanitize: true,
    stripUnknown: true,
    maxBodySizeKb: 512,
  },
});

describe("configuration internals", () => {
  let internals: ConfigInternals;
  let restoreEnv: NodeJS.ProcessEnv;

  beforeAll(async () => {
    restoreEnv = { ...process.env };
    Object.entries(REQUIRED_ENV).forEach(([key, value]) => {
      process.env[key] = value;
    });

    const module = await import("../index.js");
    internals = module.configInternals;
  });

  afterAll(async () => {
    process.env = restoreEnv;
    const { resetEnvironmentCache } = await import("../env.js");
    resetEnvironmentCache();
    jest.resetModules();
  });

  it("returns an empty object when flattening primitives without a prefix", () => {
    expect(internals.flatten("value")).toEqual({});
  });

  it("decorates primitives with the provided prefix during flattening", () => {
    expect(internals.flatten("value", "root")).toEqual({ root: "value" });
  });

  it("enumerates all keys when computing differences without a previous snapshot", () => {
    const baseConfig: ApplicationConfig = {
      app: {
        name: "Lumi",
        environment: "development",
        port: 4000,
        apiBaseUrl: "http://localhost:4000",
        frontendUrl: "http://localhost:3000",
        logLevel: "info",
      },
      database: { url: "postgresql://localhost:5432/lumi" },
      cache: { redisUrl: "redis://localhost:6379" },
      storage: { bucket: "lumi-local" },
      security: createSecuritySection(),
      observability: {
        sentryDsn: undefined,
        logs: {
          directory: "logs",
          rotation: {
            maxFiles: "14d",
            maxSize: "20m",
            zippedArchive: true,
          },
          consoleEnabled: true,
        },
        metrics: {
          enabled: true,
          endpoint: "/metrics",
          collectDefaultMetrics: true,
          defaultMetricsInterval: 5000,
        },
        alerting: {
          enabled: false,
          webhookUrl: undefined,
          severityThreshold: "error",
        },
        health: {
          uptimeGracePeriodSeconds: 30,
        },
      },
      featureFlags: { betaCheckout: true },
      runtime: { ci: false },
    };

    const diff = internals.computeDiffKeys(undefined, baseConfig);
    expect(diff).toEqual(expect.arrayContaining(["app.name", "runtime.ci"]));
    expect(diff.length).toBeGreaterThan(0);
  });

  it("detects modified keys between configuration snapshots", () => {
    const previous: ApplicationConfig = {
      app: {
        name: "Lumi",
        environment: "development",
        port: 4000,
        apiBaseUrl: "http://localhost:4000",
        frontendUrl: "http://localhost:3000",
        logLevel: "info",
      },
      database: { url: "postgresql://localhost:5432/lumi" },
      cache: { redisUrl: "redis://localhost:6379" },
      storage: { bucket: "lumi-local" },
      security: createSecuritySection(),
      observability: {
        sentryDsn: undefined,
        logs: {
          directory: "logs",
          rotation: {
            maxFiles: "14d",
            maxSize: "20m",
            zippedArchive: true,
          },
          consoleEnabled: true,
        },
        metrics: {
          enabled: true,
          endpoint: "/metrics",
          collectDefaultMetrics: true,
          defaultMetricsInterval: 5000,
        },
        alerting: {
          enabled: false,
          webhookUrl: undefined,
          severityThreshold: "error",
        },
        health: {
          uptimeGracePeriodSeconds: 30,
        },
      },
      featureFlags: { betaCheckout: true },
      runtime: { ci: false },
    };

    const next: ApplicationConfig = {
      ...previous,
      app: {
        ...previous.app,
        port: 4500,
      },
      runtime: {
        ...previous.runtime,
        ci: true,
      },
    };

    const diff = internals.computeDiffKeys(previous, next);
    expect(diff).toEqual(expect.arrayContaining(["app.port", "runtime.ci"]));
  });
});
