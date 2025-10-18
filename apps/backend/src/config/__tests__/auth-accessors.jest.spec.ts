import { afterEach, describe, expect, it, jest } from "@jest/globals";

import { withTemporaryEnvironment } from "../testing.js";

type EnvOverrides = Record<string, string | undefined>;

const REQUIRED_ENV: EnvOverrides = {
  NODE_ENV: "test",
  APP_NAME: "Lumi Auth Accessors Test",
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

describe("auth configuration accessors", () => {
  afterEach(async () => {
    const { resetEnvironmentCache } = await import("../env.js");
    resetEnvironmentCache();
    jest.resetModules();
  });

  it("exposes stable references to auth configuration segments", async () => {
    await withTemporaryEnvironment(createEnv(), async () => {
      const { getConfig, getAuthConfig, getJwtConfig, getSessionSecurityConfig } = await import(
        "../index.js"
      );

      const config = getConfig();

      expect(getAuthConfig()).toBe(config.auth);
      expect(getJwtConfig()).toBe(config.auth.jwt);
      expect(getSessionSecurityConfig()).toBe(config.auth.session);
    });
  });
});
