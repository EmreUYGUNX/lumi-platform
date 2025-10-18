import type { ResolvedEnvironment } from "@lumi/types";

import { loadEnvironment, resetEnvironmentCache } from "./env.js";

type EnvOverrides = Record<string, string | undefined>;

const TEST_ENVIRONMENT_SKIP_FLAG = "LUMI_TEST_SKIP_DEFAULTS";

/* eslint-disable security/detect-object-injection */
const setTemporaryDefault = (key: keyof NodeJS.ProcessEnv, value: string) => {
  if (!process.env[key] || process.env[key] === "") {
    process.env[key] = value;
  }
};
/* eslint-enable security/detect-object-injection */

const applyTemporaryDefaults = () => {
  setTemporaryDefault("NODE_ENV", "test");
  setTemporaryDefault("APP_NAME", "Lumi Backend Tests");
  setTemporaryDefault("APP_PORT", "4100");
  setTemporaryDefault("API_BASE_URL", "http://localhost:4100");
  setTemporaryDefault("FRONTEND_URL", "http://localhost:3100");
  setTemporaryDefault("DATABASE_URL", "postgresql://localhost:5432/lumi");
  setTemporaryDefault("REDIS_URL", "redis://localhost:6379/0");
  setTemporaryDefault("STORAGE_BUCKET", "lumi-test-bucket");
  setTemporaryDefault("LOG_LEVEL", "info");
  setTemporaryDefault("JWT_SECRET", "test-secret-placeholder-32-chars!!");
  setTemporaryDefault("JWT_ACCESS_SECRET", "test-access-secret-placeholder-32-chars!!");
  setTemporaryDefault("JWT_REFRESH_SECRET", "test-refresh-secret-placeholder-32-chars!!");
  setTemporaryDefault("JWT_ACCESS_TTL", "900");
  setTemporaryDefault("JWT_REFRESH_TTL", `${14 * 24 * 60 * 60}`);
  setTemporaryDefault("COOKIE_DOMAIN", "localhost");
  setTemporaryDefault("COOKIE_SECRET", "test-cookie-secret-placeholder-32-chars!!");
  setTemporaryDefault("EMAIL_VERIFICATION_TTL", `${24 * 60 * 60}`);
  setTemporaryDefault("PASSWORD_RESET_TTL", `${60 * 60}`);
  setTemporaryDefault(
    "SESSION_FINGERPRINT_SECRET",
    "test-fingerprint-secret-placeholder-32-chars!!",
  );
  setTemporaryDefault("LOCKOUT_DURATION", "900");
  setTemporaryDefault("MAX_LOGIN_ATTEMPTS", "5");
};

const restoreProcessEnv = (snapshot: NodeJS.ProcessEnv) => {
  Object.keys(process.env).forEach((key) => {
    if (!(key in snapshot)) {
      // eslint-disable-next-line security/detect-object-injection
      delete process.env[key];
    }
  });

  // eslint-disable-next-line security/detect-object-injection
  Object.assign(process.env, snapshot);
};

export const withTemporaryEnvironment = async <TResult>(
  overrides: EnvOverrides,
  callback: (env: ResolvedEnvironment) => Promise<TResult> | TResult,
): Promise<TResult> => {
  const snapshot = { ...process.env };

  try {
    // eslint-disable-next-line security/detect-object-injection
    process.env[TEST_ENVIRONMENT_SKIP_FLAG] = "1";
    applyTemporaryDefaults();

    Object.entries(overrides).forEach(([key, value]) => {
      if (value === undefined) {
        // eslint-disable-next-line security/detect-object-injection
        delete process.env[key];
      } else {
        // eslint-disable-next-line security/detect-object-injection
        process.env[key] = value;
      }
    });

    resetEnvironmentCache();
    const env = loadEnvironment({ reload: true, reason: "test" });
    return await callback(env);
  } finally {
    // eslint-disable-next-line security/detect-object-injection
    delete process.env[TEST_ENVIRONMENT_SKIP_FLAG];
    restoreProcessEnv(snapshot);
    resetEnvironmentCache();
  }
};
