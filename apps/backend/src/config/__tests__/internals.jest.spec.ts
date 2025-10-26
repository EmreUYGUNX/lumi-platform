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
  DATABASE_POOL_MIN: "5",
  DATABASE_POOL_MAX: "20",
  DATABASE_SLOW_QUERY_THRESHOLD_MS: "200",
  QUERY_TIMEOUT_MS: "5000",
  REDIS_URL: "redis://localhost:6379/0",
  STORAGE_BUCKET: "lumi-testing",
  LOG_LEVEL: "info",
  JWT_SECRET: "12345678901234567890123456789012",
  JWT_ACCESS_SECRET: "abcdefghijklmnopqrstuvwxyzABCDEFG",
  JWT_REFRESH_SECRET: "hijklmnopqrstuvwxyzABCDEFGHIJKLMNOP",
  JWT_ACCESS_TTL: "15m",
  JWT_REFRESH_TTL: "14d",
  COOKIE_DOMAIN: "localhost",
  COOKIE_SECRET: "cookie-secret-placeholder-value-32!!",
  SENTRY_DSN: "",
  FEATURE_FLAGS: '{"betaCheckout":true}',
  CONFIG_HOT_RELOAD: "false",
  CONFIG_ENCRYPTION_KEY: "",
  CI: "true",
  EMAIL_VERIFICATION_TTL: "24h",
  PASSWORD_RESET_TTL: "1h",
  SESSION_FINGERPRINT_SECRET: "fingerprint-secret-placeholder-32chars!!",
  LOCKOUT_DURATION: "15m",
  MAX_LOGIN_ATTEMPTS: "5",
  EMAIL_ENABLED: "true",
  EMAIL_FROM_ADDRESS: "notifications@lumi.dev",
  EMAIL_FROM_NAME: "Lumi Notifications",
  EMAIL_REPLY_TO_ADDRESS: "reply@lumi.dev",
  EMAIL_SIGNING_SECRET: "email-signing-secret-placeholder-value-32!!",
  EMAIL_SMTP_HOST: "localhost",
  EMAIL_SMTP_PORT: "1025",
  EMAIL_SMTP_SECURE: "false",
  EMAIL_SMTP_USERNAME: "mailer",
  EMAIL_SMTP_PASSWORD: "mailer-password",
  EMAIL_SMTP_TLS_REJECT_UNAUTHORIZED: "false",
  EMAIL_RATE_LIMIT_WINDOW: "2m",
  EMAIL_RATE_LIMIT_MAX_PER_RECIPIENT: "8",
  EMAIL_QUEUE_DRIVER: "inline",
  EMAIL_QUEUE_CONCURRENCY: "4",
  EMAIL_LOG_DELIVERIES: "true",
  EMAIL_TEMPLATE_BASE_URL: "http://localhost:3100/app",
  EMAIL_SUPPORT_ADDRESS: "support@lumi.dev",
  EMAIL_SUPPORT_URL: "https://support.lumi.dev",
  EMAIL_TEMPLATE_DEFAULT_LOCALE: "en-GB",
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
    ipWhitelist: [],
    routes: {
      auth: {
        global: {
          points: 5,
          durationSeconds: 900,
          blockDurationSeconds: 900,
        },
        login: {
          points: 5,
          durationSeconds: 900,
          blockDurationSeconds: 900,
        },
        register: {
          points: 5,
          durationSeconds: 900,
          blockDurationSeconds: 900,
        },
        forgotPassword: {
          points: 3,
          durationSeconds: 3600,
          blockDurationSeconds: 3600,
        },
        resendVerification: {
          points: 3,
          durationSeconds: 3600,
          blockDurationSeconds: 3600,
        },
        refresh: {
          points: 10,
          durationSeconds: 60,
          blockDurationSeconds: 120,
        },
        changePassword: {
          points: 5,
          durationSeconds: 3600,
          blockDurationSeconds: 3600,
        },
      },
    },
  },
  validation: {
    strict: true,
    sanitize: true,
    stripUnknown: true,
    maxBodySizeKb: 512,
  },
});

const createAuthSection = (): ApplicationConfig["auth"] => ({
  jwt: {
    access: {
      secret: "access-token-secret-placeholder-value-32!!",
      ttlSeconds: 15 * 60,
    },
    refresh: {
      secret: "refresh-token-secret-placeholder-value-32!!",
      ttlSeconds: 14 * 24 * 60 * 60,
    },
  },
  cookies: {
    domain: "localhost",
    secret: "cookie-secret-placeholder-value-32!!",
  },
  tokens: {
    emailVerification: {
      ttlSeconds: 24 * 60 * 60,
    },
    passwordReset: {
      ttlSeconds: 60 * 60,
    },
  },
  session: {
    fingerprintSecret: "fingerprint-secret-placeholder-value-32!!",
    lockoutDurationSeconds: 15 * 60,
    maxLoginAttempts: 5,
  },
  bruteForce: {
    enabled: true,
    windowSeconds: 15 * 60,
    progressiveDelays: {
      baseDelayMs: 250,
      stepDelayMs: 250,
      maxDelayMs: 5000,
    },
    captchaThreshold: 10,
  },
});

const createEmailSection = (): ApplicationConfig["email"] => ({
  enabled: true,
  defaultSender: {
    email: "notifications@lumi.dev",
    name: "Lumi Notifications",
    replyTo: "reply@lumi.dev",
  },
  signingSecret: "email-signing-secret-placeholder-value-32!!",
  transport: {
    driver: "smtp" as const,
    smtp: {
      host: "localhost",
      port: 1025,
      secure: false,
      username: "mailer",
      password: "mailer-password",
      tls: {
        rejectUnauthorized: false,
      },
    },
  },
  rateLimit: {
    windowSeconds: 120,
    maxPerRecipient: 8,
  },
  queue: {
    driver: "inline",
    concurrency: 4,
  },
  logging: {
    deliveries: true,
  },
  template: {
    baseUrl: "http://localhost:3100/app",
    defaultLocale: "en-GB",
    branding: {
      productName: "Lumi",
      supportEmail: "support@lumi.dev",
      supportUrl: "https://support.lumi.dev",
    },
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
      database: {
        url: "postgresql://localhost:5432/lumi",
        pool: {
          minConnections: 5,
          maxConnections: 20,
          idleTimeoutMs: 30 * 1e3,
          maxLifetimeMs: 300 * 1e3,
          connectionTimeoutMs: 5 * 1e3,
        },
        slowQueryThresholdMs: 200,
        queryTimeoutMs: 5 * 1e3,
      },
      cache: { redisUrl: "redis://localhost:6379" },
      storage: { bucket: "lumi-local" },
      security: createSecuritySection(),
      auth: createAuthSection(),
      email: createEmailSection(),
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
          request: {
            sampleRate: 1,
            maxBodyLength: 2048,
            redactFields: ["password", "token"],
          },
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
      database: {
        url: "postgresql://localhost:5432/lumi",
        pool: {
          minConnections: 5,
          maxConnections: 20,
          idleTimeoutMs: 30 * 1e3,
          maxLifetimeMs: 300 * 1e3,
          connectionTimeoutMs: 5 * 1e3,
        },
        slowQueryThresholdMs: 200,
        queryTimeoutMs: 5 * 1e3,
      },
      cache: { redisUrl: "redis://localhost:6379" },
      storage: { bucket: "lumi-local" },
      security: createSecuritySection(),
      auth: createAuthSection(),
      email: createEmailSection(),
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
          request: {
            sampleRate: 1,
            maxBodyLength: 2048,
            redactFields: ["password", "token"],
          },
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
