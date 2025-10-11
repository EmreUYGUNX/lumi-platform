/* eslint-disable security/detect-object-injection -- Test configuration utilities operate on trusted overrides. */
import type { ApplicationConfig } from "@lumi/types";

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

const isMergeableObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const deepMerge = <T>(base: T, overrides: DeepPartial<T> = {}): T => {
  if (!isMergeableObject(base)) {
    return (overrides === undefined ? base : (overrides as T)) as T;
  }

  const result: Record<string, unknown> = { ...(base as Record<string, unknown>) };

  Object.entries(overrides as Record<string, unknown>).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }

    const currentValue = (base as Record<string, unknown>)[key];

    if (Array.isArray(value) || Array.isArray(currentValue)) {
      // eslint-disable-next-line security/detect-object-injection -- Keys originate from trusted overrides in tests.
      result[key] = value;
      return;
    }

    if (isMergeableObject(currentValue) && isMergeableObject(value)) {
      // eslint-disable-next-line security/detect-object-injection -- Keys originate from trusted overrides in tests.
      result[key] = deepMerge(currentValue, value as DeepPartial<typeof currentValue>);
      return;
    }

    // eslint-disable-next-line security/detect-object-injection -- Keys originate from trusted overrides in tests.
    result[key] = value;
  });

  return result as T;
};

export const createTestConfig = (
  overrides: DeepPartial<ApplicationConfig> = {},
): ApplicationConfig => {
  const baseConfig: ApplicationConfig = {
    app: {
      name: "Lumi Backend",
      environment: "test",
      port: 4100,
      apiBaseUrl: "http://localhost:4100",
      frontendUrl: "http://localhost:3100",
      logLevel: "info",
    },
    database: {
      url: "postgresql://localhost:5432/lumi",
    },
    cache: {
      redisUrl: "redis://localhost:6379/0",
    },
    storage: {
      bucket: "lumi-test-bucket",
    },
    security: {
      jwtSecret: "abcdefghijklmnopqrstuvwxyzABCDEF",
      cors: {
        enabled: true,
        allowedOrigins: ["http://localhost:3100"],
        allowedMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
        exposedHeaders: ["X-Request-Id"],
        allowCredentials: true,
        maxAgeSeconds: 600,
      },
      headers: {
        enabled: true,
        contentSecurityPolicy:
          "default-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self';",
        referrerPolicy: "strict-origin-when-cross-origin",
        frameGuard: "DENY",
        permissionsPolicy:
          "accelerometer=(),camera=(),geolocation=(),gyroscope=(),microphone=(),payment=()",
        strictTransportSecurity: {
          maxAgeSeconds: 63_072_000,
          includeSubDomains: true,
          preload: true,
        },
        expectCt: {
          enforce: false,
          maxAgeSeconds: 86_400,
          reportUri: undefined,
        },
        crossOriginEmbedderPolicy: "require-corp",
        crossOriginOpenerPolicy: "same-origin",
        crossOriginResourcePolicy: "same-site",
        xContentTypeOptions: "nosniff",
      },
      rateLimit: {
        enabled: true,
        keyPrefix: "lumi:test",
        points: 100,
        durationSeconds: 900,
        blockDurationSeconds: 900,
        strategy: "memory",
        routes: {
          auth: {
            points: 5,
            durationSeconds: 900,
            blockDurationSeconds: 900,
          },
        },
      },
      validation: {
        strict: true,
        sanitize: true,
        stripUnknown: true,
        maxBodySizeKb: 512,
      },
    },
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
        prefix: "lumi",
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
    featureFlags: {},
    runtime: {
      ci: false,
    },
  };

  return deepMerge(baseConfig, overrides);
};
