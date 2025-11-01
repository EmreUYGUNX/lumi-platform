import * as fs from "node:fs";
import path from "node:path";

import { describe, expect, it, jest } from "@jest/globals";

import { loadEnvironment, resetEnvironmentCache } from "../env.js";
import { withTemporaryEnvironment } from "../testing.js";

type EnvOverrides = Record<string, string | undefined>;

const REQUIRED_ENV: EnvOverrides = {
  NODE_ENV: "test",
  APP_NAME: "Lumi Test Backend",
  APP_PORT: "4100",
  API_BASE_URL: "http://localhost:4100",
  FRONTEND_URL: "http://localhost:3100",
  DATABASE_URL: "postgresql://localhost:5432/lumi",
  REDIS_URL: "redis://localhost:6379/0",
  STORAGE_BUCKET: "lumi-test-bucket",
  JWT_SECRET: "abcdefghijklmnopqrstuvwxyzABCDEF",
  JWT_ACCESS_SECRET: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKL",
  JWT_REFRESH_SECRET: "mnopqrstuvwxyzABCDEFGHIJKLabcdefghijkl",
  JWT_ACCESS_TTL: "15m",
  JWT_REFRESH_TTL: "14d",
  COOKIE_DOMAIN: "localhost",
  COOKIE_SECRET: "cookie-secret-placeholder-value-32!!",
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
};

const createEnv = (overrides: EnvOverrides = {}) => ({
  ...REQUIRED_ENV,
  ...overrides,
});

describe("loadEnvironment", () => {
  afterEach(() => {
    resetEnvironmentCache();
    jest.restoreAllMocks();
  });

  it("returns the cached environment when reload is not requested", async () => {
    await withTemporaryEnvironment(createEnv(), async (initialEnv) => {
      const cached = loadEnvironment();
      expect(cached).toBe(initialEnv);

      const reloaded = loadEnvironment({ reload: true, reason: "explicit-reload" });
      expect(reloaded).not.toBe(initialEnv);
      expect(reloaded.appPort).toBe(initialEnv.appPort);
    });
  });

  it("parses authentication-related configuration entries", async () => {
    await withTemporaryEnvironment(createEnv(), async (env) => {
      expect(env.jwtAccessSecret).toBe(REQUIRED_ENV.JWT_ACCESS_SECRET);
      expect(env.jwtRefreshSecret).toBe(REQUIRED_ENV.JWT_REFRESH_SECRET);
      expect(env.jwtAccessTtlSeconds).toBe(15 * 60);
      expect(env.jwtRefreshTtlSeconds).toBe(14 * 24 * 60 * 60);
      expect(env.cookieDomain).toBe(REQUIRED_ENV.COOKIE_DOMAIN);
      expect(env.cookieSecret).toBe(REQUIRED_ENV.COOKIE_SECRET);
      expect(env.emailVerificationTtlSeconds).toBe(24 * 60 * 60);
      expect(env.passwordResetTtlSeconds).toBe(60 * 60);
      expect(env.sessionFingerprintSecret).toBe(REQUIRED_ENV.SESSION_FINGERPRINT_SECRET);
      expect(env.lockoutDurationSeconds).toBe(15 * 60);
      expect(env.maxLoginAttempts).toBe(Number(REQUIRED_ENV.MAX_LOGIN_ATTEMPTS));
      expect(env.authBruteForce).toEqual({
        enabled: true,
        windowSeconds: 15 * 60,
        progressiveDelays: {
          baseDelayMs: 250,
          stepDelayMs: 250,
          maxDelayMs: 5000,
        },
        captchaThreshold: 10,
      });
    });
  });

  it("parses email configuration entries", async () => {
    await withTemporaryEnvironment(createEnv(), async (env) => {
      expect(env.email.enabled).toBe(true);
      expect(env.email.defaultSender).toEqual({
        email: REQUIRED_ENV.EMAIL_FROM_ADDRESS,
        name: REQUIRED_ENV.EMAIL_FROM_NAME,
        replyTo: REQUIRED_ENV.EMAIL_REPLY_TO_ADDRESS,
      });
      expect(env.email.signingSecret).toBe(REQUIRED_ENV.EMAIL_SIGNING_SECRET);
      expect(env.email.transport.smtp.host).toBe(REQUIRED_ENV.EMAIL_SMTP_HOST);
      expect(env.email.transport.smtp.port).toBe(Number(REQUIRED_ENV.EMAIL_SMTP_PORT));
      expect(env.email.transport.smtp.secure).toBe(false);
      expect(env.email.transport.smtp.username).toBe(REQUIRED_ENV.EMAIL_SMTP_USERNAME);
      expect(env.email.transport.smtp.password).toBe(REQUIRED_ENV.EMAIL_SMTP_PASSWORD);
      expect(env.email.rateLimit.windowSeconds).toBe(120);
      expect(env.email.rateLimit.maxPerRecipient).toBe(8);
      expect(env.email.queue.driver).toBe("inline");
      expect(env.email.queue.concurrency).toBe(4);
      expect(env.email.logging.deliveries).toBe(true);
      expect(env.email.template.baseUrl).toBe(REQUIRED_ENV.EMAIL_TEMPLATE_BASE_URL);
      expect(env.email.template.supportEmail).toBe(REQUIRED_ENV.EMAIL_SUPPORT_ADDRESS);
      expect(env.email.template.supportUrl).toBe(REQUIRED_ENV.EMAIL_SUPPORT_URL);
      expect(env.email.template.defaultLocale).toBe(REQUIRED_ENV.EMAIL_TEMPLATE_DEFAULT_LOCALE);
    });
  });

  it("parses email configuration entries", async () => {
    await withTemporaryEnvironment(createEnv(), async (env) => {
      expect(env.email.enabled).toBe(true);
      expect(env.email.defaultSender).toEqual({
        email: REQUIRED_ENV.EMAIL_FROM_ADDRESS,
        name: REQUIRED_ENV.EMAIL_FROM_NAME,
        replyTo: REQUIRED_ENV.EMAIL_REPLY_TO_ADDRESS,
      });
      expect(env.email.signingSecret).toBe(REQUIRED_ENV.EMAIL_SIGNING_SECRET);
      expect(env.email.transport.smtp.host).toBe(REQUIRED_ENV.EMAIL_SMTP_HOST);
      expect(env.email.transport.smtp.port).toBe(Number(REQUIRED_ENV.EMAIL_SMTP_PORT));
      expect(env.email.transport.smtp.secure).toBe(false);
      expect(env.email.transport.smtp.username).toBe(REQUIRED_ENV.EMAIL_SMTP_USERNAME);
      expect(env.email.transport.smtp.password).toBe(REQUIRED_ENV.EMAIL_SMTP_PASSWORD);
      expect(env.email.rateLimit.windowSeconds).toBe(120);
      expect(env.email.rateLimit.maxPerRecipient).toBe(8);
      expect(env.email.queue.driver).toBe("inline");
      expect(env.email.queue.concurrency).toBe(4);
      expect(env.email.logging.deliveries).toBe(true);
      expect(env.email.template.baseUrl).toBe(REQUIRED_ENV.EMAIL_TEMPLATE_BASE_URL);
      expect(env.email.template.supportEmail).toBe(REQUIRED_ENV.EMAIL_SUPPORT_ADDRESS);
      expect(env.email.template.supportUrl).toBe(REQUIRED_ENV.EMAIL_SUPPORT_URL);
      expect(env.email.template.defaultLocale).toBe(REQUIRED_ENV.EMAIL_TEMPLATE_DEFAULT_LOCALE);
    });
  });

  it("enforces paired credentials for metrics basic auth", async () => {
    await expect(
      withTemporaryEnvironment(
        createEnv({ METRICS_BASIC_AUTH_USERNAME: "metrics-user" }),
        async () => {},
      ),
    ).rejects.toThrow("METRICS_BASIC_AUTH_PASSWORD is required when username is provided");

    await expect(
      withTemporaryEnvironment(
        createEnv({ METRICS_BASIC_AUTH_PASSWORD: "super-secret" }),
        async () => {},
      ),
    ).rejects.toThrow("METRICS_BASIC_AUTH_USERNAME is required when password is provided");
  });

  it("parses optional port variations", async () => {
    await withTemporaryEnvironment(createEnv({ PORT: "5100" }), async (env) => {
      expect(env.appPort).toBe(5100);
    });

    await withTemporaryEnvironment(createEnv({ PORT: "   " }), async (env) => {
      expect(env.appPort).toBe(Number(REQUIRED_ENV.APP_PORT));
    });

    await expect(
      withTemporaryEnvironment(createEnv({ PORT: "not-a-number" }), async () => {}),
    ).rejects.toThrow("PORT must be a positive integer");
  });

  it("parses feature flags payloads and tolerates invalid JSON", async () => {
    await withTemporaryEnvironment(
      createEnv({
        FEATURE_FLAGS:
          '{"betaCheckout": true, "newUi": "0", "useNumber": 1, "stringTrue": "YES", "objectFlag": {"nested": true}}',
      }),
      async (env) => {
        expect(env.featureFlags).toEqual({
          betaCheckout: true,
          newUi: false,
          useNumber: true,
          stringTrue: true,
          objectFlag: false,
        });
      },
    );

    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {
      // suppress noisy output in tests
    });

    await withTemporaryEnvironment(createEnv({ FEATURE_FLAGS: "{invalid json" }), async (env) => {
      expect(env.featureFlags).toEqual({});
    });

    expect(warnSpy).toHaveBeenCalled();
  });

  it("normalises request redact fields and falls back to defaults when empty", async () => {
    await withTemporaryEnvironment(
      createEnv({ LOG_REQUEST_REDACT_FIELDS: " password , TOKEN , , password ,   token  " }),
      async (env) => {
        expect(env.logRequestRedactFields).toEqual(["password", "token"]);
      },
    );

    await withTemporaryEnvironment(
      createEnv({ LOG_REQUEST_REDACT_FIELDS: "   ,   ,   " }),
      async (env) => {
        expect(env.logRequestRedactFields).toEqual([
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
        ]);
      },
    );
  });

  it("rejects blank JWT access TTL values", async () => {
    await expect(
      withTemporaryEnvironment(createEnv({ JWT_ACCESS_TTL: "   " }), async () => {}),
    ).rejects.toThrow("JWT_ACCESS_TTL is required");
  });

  it("rejects numeric JWT access TTL values below the minimum threshold", async () => {
    await expect(
      withTemporaryEnvironment(createEnv({ JWT_ACCESS_TTL: "30" }), async () => {}),
    ).rejects.toThrow("JWT_ACCESS_TTL must be at least 60 seconds");
  });

  it("rejects JWT access TTL values with unsupported units", async () => {
    await expect(
      withTemporaryEnvironment(createEnv({ JWT_ACCESS_TTL: "15x" }), async () => {}),
    ).rejects.toThrow("JWT_ACCESS_TTL must end with one of: s, m, h, d");
  });

  it("rejects JWT access TTL values with non-numeric magnitudes", async () => {
    await expect(
      withTemporaryEnvironment(createEnv({ JWT_ACCESS_TTL: "1xm" }), async () => {}),
    ).rejects.toThrow("JWT_ACCESS_TTL must use a numeric magnitude (e.g. 15m, 1h)");
  });

  it("rejects JWT access TTL values with non-positive magnitudes", async () => {
    await expect(
      withTemporaryEnvironment(createEnv({ JWT_ACCESS_TTL: "0m" }), async () => {}),
    ).rejects.toThrow("JWT_ACCESS_TTL must be greater than zero");
  });

  it("rejects fractional JWT access TTL values that fall below the minimum duration", async () => {
    await expect(
      withTemporaryEnvironment(createEnv({ JWT_ACCESS_TTL: "30s" }), async () => {}),
    ).rejects.toThrow("JWT_ACCESS_TTL must be at least 60 seconds");
  });

  it("accepts fractional JWT access TTL values that meet the minimum requirement", async () => {
    await withTemporaryEnvironment(createEnv({ JWT_ACCESS_TTL: "1.5m" }), async (env) => {
      expect(env.jwtAccessTtlSeconds).toBe(90);
    });
  });

  it("rejects infinite JWT access TTL representations", async () => {
    await expect(
      withTemporaryEnvironment(createEnv({ JWT_ACCESS_TTL: "Infinity" }), async () => {}),
    ).rejects.toThrow("JWT_ACCESS_TTL must end with one of: s, m, h, d");
  });

  it("parses numeric JWT refresh TTL values declared in seconds", async () => {
    await withTemporaryEnvironment(createEnv({ JWT_REFRESH_TTL: `${90 * 60}` }), async (env) => {
      expect(env.jwtRefreshTtlSeconds).toBe(90 * 60);
    });
  });

  it("interprets boolean configuration toggles expressed as strings", async () => {
    await withTemporaryEnvironment(
      createEnv({
        SECURITY_HEADERS_HSTS_INCLUDE_SUBDOMAINS: "0",
        SECURITY_HEADERS_HSTS_PRELOAD: "yes",
        SECURITY_HEADERS_EXPECT_CT_ENFORCE: "ON",
      }),
      async (env) => {
        expect(env.securityHeaders.strictTransportSecurity.maxAgeSeconds).toBeGreaterThan(0);
        expect(env.securityHeaders.strictTransportSecurity.includeSubDomains).toBe(false);
        expect(env.securityHeaders.strictTransportSecurity.preload).toBe(true);
        expect(env.securityHeaders.expectCt.enforce).toBe(true);
      },
    );
  });

  it("falls back to default request redact fields when the override is empty", async () => {
    await withTemporaryEnvironment(createEnv({ LOG_REQUEST_REDACT_FIELDS: "   " }), async (env) => {
      expect(env.logRequestRedactFields).toEqual([
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
      ]);
    });
  });

  it("enables redis-backed rate limiting when configured", async () => {
    await withTemporaryEnvironment(
      createEnv({
        RATE_LIMIT_STRATEGY: "redis",
        RATE_LIMIT_REDIS_URL: "redis://localhost:6390/1",
      }),
      async (env) => {
        expect(env.rateLimit.strategy).toBe("redis");
        expect(env.rateLimit.redis).toEqual({ url: "redis://localhost:6390/1" });
      },
    );
  });

  it("parses auth rate limit route configuration and whitelist", async () => {
    await withTemporaryEnvironment(
      createEnv({
        RATE_LIMIT_IP_WHITELIST: "127.0.0.1, 10.0.0.5",
        RATE_LIMIT_AUTH_LOGIN_POINTS: "7",
        RATE_LIMIT_AUTH_REFRESH_BLOCK_DURATION: "90",
      }),
      async (env) => {
        expect(env.rateLimit.ipWhitelist).toEqual(["127.0.0.1", "10.0.0.5"]);
        expect(env.rateLimit.routes.auth.global.points).toBe(5);
        expect(env.rateLimit.routes.auth.login.points).toBe(7);
        expect(env.rateLimit.routes.auth.refresh.blockDurationSeconds).toBe(90);
        expect(env.rateLimit.routes.auth.forgotPassword.points).toBe(3);
      },
    );
  });

  it("validates port ranges and encryption key requirements", async () => {
    await expect(
      withTemporaryEnvironment(createEnv({ PORT: "70000" }), async () => {}),
    ).rejects.toThrow("PORT must be between 1 and 65535");

    await expect(
      withTemporaryEnvironment(
        createEnv({ CONFIG_ENCRYPTION_KEY: "too-short-key" }),
        async () => {},
      ),
    ).rejects.toThrow("CONFIG_ENCRYPTION_KEY must be at least 32 characters when provided");
  });

  it("normalises optional credentials when blank values are provided", async () => {
    await withTemporaryEnvironment(
      createEnv({
        METRICS_BASIC_AUTH_USERNAME: "   ",
        METRICS_BASIC_AUTH_PASSWORD: "   ",
        CORS_ALLOW_CREDENTIALS: "",
      }),
      async (env) => {
        expect(env.metricsBasicAuthUsername).toBeUndefined();
        expect(env.metricsBasicAuthPassword).toBeUndefined();
        expect(env.cors.allowCredentials).toBe(true);
      },
    );
  });

  it("controls configuration hot reload watchers by environment", async () => {
    const envFilePath = path.resolve(process.cwd(), ".env");
    const hadExistingEnvFile = fs.existsSync(envFilePath);

    if (!hadExistingEnvFile) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      fs.writeFileSync(envFilePath, "APP_NAME=Lumi");
    }

    try {
      await withTemporaryEnvironment(
        createEnv({ NODE_ENV: "development", CONFIG_HOT_RELOAD: "true" }),
        async (env) => {
          expect(env.configHotReload).toBe(true);
        },
      );

      await withTemporaryEnvironment(
        createEnv({ NODE_ENV: "production", CONFIG_HOT_RELOAD: "true" }),
        async (env) => {
          expect(env.configHotReload).toBe(true);
        },
      );
    } finally {
      if (!hadExistingEnvFile && fs.existsSync(envFilePath)) {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        fs.unlinkSync(envFilePath);
      }
    }
  });
});
