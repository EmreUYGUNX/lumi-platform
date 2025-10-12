// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it, jest } from "@jest/globals";
import type { Request, Response } from "express";

import { REQUEST_ID_HEADER, createRequestIdMiddleware } from "../requestId.js";

const createRequest = (headers: Record<string, string>): Request =>
  ({
    headers,
    get: (name: string) => headers[name] ?? headers[name.toLowerCase()],
  }) as unknown as Request;

const createResponse = () =>
  ({
    locals: {},
    setHeader: jest.fn(),
  }) as unknown as Response;

describe("requestId middleware", () => {
  it("propagates a trusted incoming request identifier", () => {
    const middleware = createRequestIdMiddleware();
    const request = createRequest({ [REQUEST_ID_HEADER]: "req-123" });
    const response = createResponse();
    const next = jest.fn();

    middleware(request, response, next);

    expect(request.id).toBe("req-123");
    expect(response.locals.requestId).toBe("req-123");
    expect(response.setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, "req-123");
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed incoming identifiers and issues a new one", () => {
    const middleware = createRequestIdMiddleware();
    const maliciousHeader = "invalid id with spaces";
    const request = createRequest({ [REQUEST_ID_HEADER]: maliciousHeader });
    const response = createResponse();
    const next = jest.fn();

    middleware(request, response, next);

    expect(request.id).toBeDefined();
    expect(request.id).not.toBe(maliciousHeader);
    expect(response.setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, request.id);
  });

  it("ignores incoming identifiers when trust is disabled", () => {
    const middleware = createRequestIdMiddleware({ trustIncomingHeader: false });
    const request = createRequest({ [REQUEST_ID_HEADER]: "trusted-456" });
    const response = createResponse();
    const next = jest.fn();

    middleware(request, response, next);

    expect(request.id).toBeDefined();
    expect(request.id).not.toBe("trusted-456");
    expect(response.setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, request.id);
  });

  it("supports custom header names", () => {
    const middleware = createRequestIdMiddleware({ header: "X-Correlation-Id" });
    const request = createRequest({ "X-Correlation-Id": "corr-789" });
    const response = createResponse();
    const next = jest.fn();

    middleware(request, response, next);

    expect(request.id).toBe("corr-789");
    expect(response.locals.requestId).toBe("corr-789");
    expect(response.setHeader).toHaveBeenCalledWith("X-Correlation-Id", "corr-789");
  });
});
