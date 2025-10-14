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
