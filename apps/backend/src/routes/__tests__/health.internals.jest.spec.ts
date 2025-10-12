// eslint-disable-next-line import/no-extraneous-dependencies
import { afterEach, describe, expect, it, jest } from "@jest/globals";

import * as observability from "../../observability/index.js";
import { createTestConfig } from "../../testing/config.js";
import { createHealthRouter, testingHarness } from "../health.js";

describe("health route internals", () => {
  afterEach(() => {
    testingHarness.resetState();
    jest.restoreAllMocks();
  });

  it("parses targets using fallback port when absent", () => {
    const target = testingHarness.parseTarget("postgresql://example.com/service", 5432);
    expect(target).toEqual({
      host: "example.com",
      port: 5432,
      protocol: "postgresql",
    });
  });

  it("returns undefined for malformed target URIs", () => {
    expect(testingHarness.parseTarget("postgresql://localhost:notaport/db", 5432)).toBeUndefined();
    expect(testingHarness.parseTarget("not-a-url", 6379)).toBeUndefined();
    expect(testingHarness.parseTarget("redis://cache", Number.NaN)).toBeUndefined();
  });

  it("normalises non-error payloads when formatting errors", () => {
    expect(testingHarness.formatError("fatal")).toEqual({ message: "fatal" });
    expect(testingHarness.formatError({ reason: "boom" })).toEqual({
      message: JSON.stringify({ reason: "boom" }),
    });
  });

  it("creates timeout errors with descriptive names", () => {
    const error = testingHarness.createTimeoutError("redis", 500);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("TimeoutError");
    expect(error.message).toBe("redis health probe exceeded timeout of 500ms");
  });

  it("marks dependencies as degraded when latency exceeds thresholds", async () => {
    testingHarness.setConnectTcp(async () => {});
    jest
      .spyOn(performance, "now")
      .mockImplementationOnce(() => 0)
      .mockImplementationOnce(() => 600);

    const check = testingHarness.createDependencyCheck(testingHarness.dependencyConfig.database);
    const result = await check("postgresql://localhost:5432/example");

    expect(result.status).toBe("degraded");
    expect(result.severity).toBe("warn");
    expect(result.details).toMatchObject({
      latencyMs: 600,
      port: 5432,
    });
  });

  it("registers dependency health checks only once", () => {
    const registerSpy = jest.spyOn(observability, "registerHealthCheck");
    const config = createTestConfig();

    createHealthRouter(config);
    createHealthRouter(config);

    expect(registerSpy).toHaveBeenCalledTimes(2);
  });

  it("surfaces unreachable dependencies with sanitised error details", async () => {
    testingHarness.setConnectTcp(async () => {
      throw new Error("connection refused");
    });

    const check = testingHarness.createDependencyCheck(testingHarness.dependencyConfig.redis);
    const result = await check("redis://localhost:6379");

    expect(result.status).toBe("unhealthy");
    expect(result.details?.error).toEqual({
      name: "Error",
      message: "connection refused",
    });
  });
});
