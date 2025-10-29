import { describe, expect, it } from "@jest/globals";

import { ApiError, isClientErrorStatus } from "../api-error.js";

describe("ApiError", () => {
  it("derives standard codes from HTTP status when none provided", () => {
    expect(new ApiError("bad input", { status: 400 }).code).toBe("BAD_REQUEST");
    expect(new ApiError("unauthenticated", { status: 401 }).code).toBe("UNAUTHORIZED");
    expect(new ApiError("forbidden", { status: 403 }).code).toBe("FORBIDDEN");
    expect(new ApiError("missing", { status: 404 }).code).toBe("NOT_FOUND");
    expect(new ApiError("too many requests", { status: 429 }).code).toBe("RATE_LIMITED");
    expect(new ApiError("service down", { status: 503 }).code).toBe("SERVICE_UNAVAILABLE");
  });

  it("uppercases explicit error identifiers and respects custom log levels", () => {
    const error = new ApiError("custom", {
      status: 422,
      code: "domain_conflict",
      logLevel: "info",
    });

    expect(error.code).toBe("DOMAIN_CONFLICT");
    expect(error.logLevel).toBe("info");
  });

  it("captures the originating cause when provided", () => {
    const cause = new Error("root failure");
    const error = new ApiError("wrapped", { cause });
    expect(error.cause).toBe(cause);
  });

  it("defaults to error-level logging for server faults and warn for client faults", () => {
    expect(new ApiError("server", { status: 500 }).logLevel).toBe("error");
    expect(new ApiError("client", { status: 400 }).logLevel).toBe("warn");
  });

  it("creates ApiError instances from unknown values", () => {
    const base = new ApiError("existing", { status: 410 });
    expect(ApiError.fromUnknown(base)).toBe(base);

    const fromError = ApiError.fromUnknown(new Error("boom"), { status: 502, code: "proxy" });
    expect(fromError.status).toBe(502);
    expect(fromError.code).toBe("PROXY");
    expect(fromError.cause).toBeInstanceOf(Error);

    const fromPrimitive = ApiError.fromUnknown("unexpected");
    expect(fromPrimitive.status).toBe(500);
    expect(fromPrimitive.code).toBe("INTERNAL_SERVER_ERROR");
  });

  it("identifies client-side status codes", () => {
    expect(isClientErrorStatus(200)).toBe(false);
    expect(isClientErrorStatus(399)).toBe(false);
    expect(isClientErrorStatus(400)).toBe(true);
    expect(isClientErrorStatus(499)).toBe(true);
    expect(isClientErrorStatus(500)).toBe(false);
  });
});
