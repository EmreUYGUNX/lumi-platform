/* eslint-disable security/detect-object-injection -- Test configuration utilities operate on trusted overrides. */
import type { ApplicationConfig } from "@lumi/types";

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

const isMergeableObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const deepMerge = <T>(base: T, overrides: DeepPartial<T> = {}): T => {
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

export const mergeTestOverrides = <T>(...overrides: DeepPartial<T>[]): DeepPartial<T> => {
  let accumulator: DeepPartial<T> = {};

  overrides.forEach((override) => {
    if (!override) {
      return;
    }

    accumulator = deepMerge(accumulator as T, override);
  });

  return accumulator;
};

const LOCAL_FRONTEND_ORIGIN = "http://localhost:3100";

export const createTestConfig = (
  overrides: DeepPartial<ApplicationConfig> = {},
): ApplicationConfig => {
  const baseConfig: ApplicationConfig = {
    app: {
      name: "Lumi Backend",
      environment: "test",
      port: 4100,
      apiBaseUrl: "http://localhost:4100",
      frontendUrl: LOCAL_FRONTEND_ORIGIN,
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
        allowedOrigins: [LOCAL_FRONTEND_ORIGIN],
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
    },
    auth: {
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
    },
    email: {
      enabled: true,
      defaultSender: {
        email: "notifications@lumi.dev",
        name: "Lumi Notifications",
        replyTo: "support@lumi.dev",
      },
      signingSecret: "email-signing-secret-placeholder-value-32!!",
      transport: {
        driver: "smtp",
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
        baseUrl: LOCAL_FRONTEND_ORIGIN,
        defaultLocale: "en-US",
        branding: {
          productName: "Lumi Backend",
          supportEmail: "support@lumi.dev",
          supportUrl: `${LOCAL_FRONTEND_ORIGIN}/support`,
        },
      },
    },
    media: {
      cloudinary: {
        credentials: {
          cloudName: "lumi-test",
          apiKey: "cloudinary-api-key",
          apiSecret: "cloudinary-api-secret",
          secure: true,
        },
        uploadPresets: {
          products: "lumi_products",
          banners: "lumi_banners",
          avatars: "lumi_avatars",
        },
        folders: {
          products: "lumi/products",
          banners: "lumi/banners",
          avatars: "lumi/avatars",
        },
        responsiveBreakpoints: [320, 640, 768],
        signatureTtlSeconds: 300,
        defaultDelivery: {
          format: "auto",
          fetchFormat: "auto",
          quality: "auto:good",
          dpr: "auto",
        },
        webhook: {},
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
        request: {
          sampleRate: 1,
          maxBodyLength: 2048,
          redactFields: [
            "password",
            "pass",
            "token",
            "secret",
            "authorization",
            "apikey",
            "refreshtoken",
            "accesstoken",
            "clientsecret",
            "creditcard",
          ],
        },
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

  const merged = deepMerge(baseConfig, overrides);

  if (merged?.email?.template?.branding) {
    merged.email.template.branding.productName = merged.app.name;
    if (!merged.email.template.branding.supportUrl) {
      merged.email.template.branding.supportUrl = `${merged.app.frontendUrl.replace(/\/$/, "")}/support`;
    }
    if (!merged.email.template.baseUrl) {
      merged.email.template.baseUrl = merged.app.frontendUrl;
    }
  }

  return merged;
};
