import { describe, expect, it } from "@jest/globals";

import { buildAuthConfig } from "../auth.config.js";
import { withTemporaryEnvironment } from "../testing.js";

type EnvOverrides = Record<string, string | undefined>;

const REQUIRED_ENV: EnvOverrides = {
  NODE_ENV: "test",
  APP_NAME: "Lumi Auth Test",
  APP_PORT: "4100",
  API_BASE_URL: "http://localhost:4100",
  FRONTEND_URL: "http://localhost:3100",
  DATABASE_URL: "postgresql://localhost:5432/lumi",
  REDIS_URL: "redis://localhost:6379/0",
  STORAGE_BUCKET: "lumi-test-bucket",
  LOG_LEVEL: "info",
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
};

const createEnv = (overrides: EnvOverrides = {}): EnvOverrides => ({
  ...REQUIRED_ENV,
  ...overrides,
});

describe("buildAuthConfig", () => {
  it("derives auth configuration from the resolved environment", async () => {
    await withTemporaryEnvironment(createEnv(), async (resolvedEnv) => {
      const config = buildAuthConfig(resolvedEnv);

      expect(config.jwt.access.secret).toBe(REQUIRED_ENV.JWT_ACCESS_SECRET);
      expect(config.jwt.access.ttlSeconds).toBe(15 * 60);
      expect(config.jwt.refresh.secret).toBe(REQUIRED_ENV.JWT_REFRESH_SECRET);
      expect(config.jwt.refresh.ttlSeconds).toBe(14 * 24 * 60 * 60);
      expect(config.cookies.domain).toBe(REQUIRED_ENV.COOKIE_DOMAIN);
      expect(config.cookies.secret).toBe(REQUIRED_ENV.COOKIE_SECRET);
      expect(config.tokens.emailVerification.ttlSeconds).toBe(24 * 60 * 60);
      expect(config.tokens.passwordReset.ttlSeconds).toBe(60 * 60);
      expect(config.session.fingerprintSecret).toBe(REQUIRED_ENV.SESSION_FINGERPRINT_SECRET);
      expect(config.session.lockoutDurationSeconds).toBe(15 * 60);
      expect(config.session.maxLoginAttempts).toBe(5);
    });
  });

  it("handles optional cookie domains", async () => {
    await withTemporaryEnvironment(createEnv({ COOKIE_DOMAIN: undefined }), async (resolvedEnv) => {
      const config = buildAuthConfig(resolvedEnv);
      expect(config.cookies.domain).toBeUndefined();
    });
  });

  it("validates TTL requirements", async () => {
    await expect(
      withTemporaryEnvironment(createEnv({ JWT_ACCESS_TTL: "30s" }), async (resolvedEnv) => {
        buildAuthConfig(resolvedEnv);
      }),
    ).rejects.toThrow("JWT_ACCESS_TTL must be at least 60 seconds");
  });
});
