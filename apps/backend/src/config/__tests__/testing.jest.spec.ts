// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, describe, expect, it } from "@jest/globals";

import { resetEnvironmentCache } from "../env.js";
import { withTemporaryEnvironment } from "../testing.js";

const BASE_ENV = {
  NODE_ENV: "test",
  APP_NAME: "Testing Helpers",
  APP_PORT: "4600",
  API_BASE_URL: "http://localhost:4600",
  FRONTEND_URL: "http://localhost:3600",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/test",
  REDIS_URL: "redis://localhost:6379",
  STORAGE_BUCKET: "bucket-test",
  LOG_LEVEL: "warn",
  JWT_SECRET: "1234567890123456",
  SENTRY_DSN: "",
  FEATURE_FLAGS: "{}",
  CONFIG_HOT_RELOAD: "false",
  CONFIG_ENCRYPTION_KEY: "",
  CI: "true",
} as const;

const snapshotEnv = () => ({ ...process.env });

afterEach(() => {
  resetEnvironmentCache();
});

describe("withTemporaryEnvironment", () => {
  it("merges overrides and restores the original process environment", async () => {
    const original = snapshotEnv();

    await withTemporaryEnvironment(
      { ...BASE_ENV, TEMP_VARIABLE: "enabled", REMOVE_ME: undefined },
      (env) => {
        expect(env.appPort).toBe(4600);
        expect(process.env.TEMP_VARIABLE).toBe("enabled");
        expect(process.env.REMOVE_ME).toBeUndefined();
      },
    );

    expect(process.env.TEMP_VARIABLE).toBe(original.TEMP_VARIABLE);
    expect(process.env.REMOVE_ME).toBe(original.REMOVE_ME);
  });
});
