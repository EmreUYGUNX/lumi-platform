import { describe, expect, it, jest } from "@jest/globals";
import type { NextFunction, Request, Response } from "express";

import { testingHarness } from "../index.js";

const createResponseMock = () => {
  const res = {} as Response;
  const headers: Record<string, string> = {};
  res.setHeader = jest.fn((key: string, value: string) => {
    headers[key] = value;
    return res;
  }) as unknown as Response["setHeader"];
  res.on = jest.fn((event: string, handler: () => void) => {
    if (event === "finish") {
      handler();
    }
    return res;
  }) as unknown as Response["on"];
  res.statusCode = 200;
  return { res, headers };
};

describe("API routing helpers", () => {
  it("combines version and path segments", () => {
    expect(testingHarness.combineWithVersion("v1", "/health")).toBe("/v1/health");
  });

  it("registers versioned routes when registrar is provided", () => {
    const register = jest.fn();
    const registrar = testingHarness.createVersionRegistrar("v1", register);

    registrar?.("GET", "/health");
    expect(register).toHaveBeenCalledWith("GET", "/v1/health");

    const inactiveRegistrar = testingHarness.createVersionRegistrar("v1");
    expect(inactiveRegistrar).toBeDefined();
    expect(() => inactiveRegistrar?.("POST", "/ignored")).not.toThrow();
  });

  it("bypasses deprecation headers for already versioned paths", () => {
    const middleware = testingHarness.createDeprecationMiddleware("v0", {});
    const req = { path: "/v1/health", method: "GET", originalUrl: "/v1/health" } as Request;
    const { res, headers } = createResponseMock();
    const next = jest.fn() as unknown as NextFunction;

    middleware(req, res, next);

    expect(headers).toEqual({});
    expect(next).toHaveBeenCalled();
  });

  it("applies deprecation headers with optional metadata for legacy paths", () => {
    const middleware = testingHarness.createDeprecationMiddleware("v0", {
      sunsetDate: "2025-12-31T00:00:00.000Z",
      documentationUrl: "https://docs.lumi.dev/api",
    });
    const req = { path: "/legacy/route", method: "GET", originalUrl: "/legacy/route" } as Request;
    const { res, headers } = createResponseMock();
    const next = jest.fn() as unknown as NextFunction;

    middleware(req, res, next);

    expect(headers).toMatchObject({
      Deprecation: "true",
      Sunset: new Date("2025-12-31T00:00:00.000Z").toUTCString(),
      Link: '<https://docs.lumi.dev/api>; rel="alternate"; type="text/html"',
    });
    expect(next).toHaveBeenCalled();
  });
});
