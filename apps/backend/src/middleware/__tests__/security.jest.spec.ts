import type { NextFunction, Request, Response } from "express";

import { createTestConfig } from "../../testing/config.js";
import { createSecurityMiddleware } from "../security.js";

describe("createSecurityMiddleware", () => {
  it("sets the configured security headers when enabled", () => {
    const config = createTestConfig().security.headers;
    const middlewares = createSecurityMiddleware(config);
    const setHeaders = middlewares[1];
    if (!setHeaders) {
      throw new Error("Security header middleware initialisation failed");
    }
    const response = { setHeader: jest.fn() } as unknown as Response;
    const next = jest.fn() as NextFunction;

    setHeaders({} as Request, response, next);

    expect(response.setHeader).toHaveBeenCalledWith(
      "Content-Security-Policy",
      config.contentSecurityPolicy,
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("acts as a no-op when security headers are disabled", () => {
    const config = createTestConfig({
      security: {
        headers: {
          enabled: false,
        },
      },
    }).security.headers;

    const middlewares = createSecurityMiddleware(config);
    const setHeaders = middlewares[1];
    if (!setHeaders) {
      throw new Error("Security header middleware initialisation failed");
    }
    const response = { setHeader: jest.fn() } as unknown as Response;
    const next = jest.fn() as NextFunction;

    setHeaders({} as Request, response, next);

    expect(response.setHeader).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
