// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
const REQUIRED_ENV = {
  APP_NAME: "Lumi",
  API_BASE_URL: "http://localhost:4000",
  FRONTEND_URL: "http://localhost:3000",
  DATABASE_URL: "postgresql://tester:secret@localhost:5432/test",
  REDIS_URL: "redis://localhost:6379",
  STORAGE_BUCKET: "lumi-test",
  JWT_SECRET: "unit-test-secret",
};

let originalEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  originalEnv = { ...process.env };
  process.env = { ...process.env, ...REQUIRED_ENV };
  jest.resetModules();
});

afterEach(() => {
  process.env = originalEnv;
});

describe("backend configuration", () => {
  it("loads the default application configuration", async () => {
    const { getConfig } = await import("../src/config/index.js");
    const config = getConfig();

    expect(config.app.name).toBe(REQUIRED_ENV.APP_NAME);
    expect(config.app.environment).toBe("test");
    expect(config.app.port).toBe(4000);
    // @ts-expect-error custom matcher registered in Jest setup
    expect({ status: 200 }).toBeHttpStatus();
  });

  it("notifies listeners when configuration changes", async () => {
    const { onConfigChange, reloadConfiguration } = await import("../src/config/index.js");

    process.env.LOG_LEVEL = "debug";
    reloadConfiguration("prime");

    const listener = jest.fn();
    const unsubscribe = onConfigChange(listener);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ reason: "initial" }));

    process.env.LOG_LEVEL = "error";
    reloadConfiguration("unit");

    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({
        reason: "unit",
        changedKeys: expect.arrayContaining(["app.logLevel"]),
      }),
    );

    unsubscribe();
  });
});
