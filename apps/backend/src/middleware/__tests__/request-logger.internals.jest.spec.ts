import { describe, expect, it } from "@jest/globals";
import type { Request } from "express";

import { requestLoggerInternals } from "../request-logger.js";

const buildRequest = (overrides: Partial<Request> = {}): Request =>
  ({
    originalUrl: "/api/v1/admin/users/ckuser",
    path: "/api/v1/admin/users/ckuser",
    method: "POST",
    user: { id: "user_1" },
    ...overrides,
  }) as Request;

describe("requestLogger internals", () => {
  it("masks sensitive fields deeply", () => {
    const payload = {
      password: "secret",
      nested: {
        token: "tok",
        items: [{ refreshToken: "refresh" }],
      },
    };
    const masked = requestLoggerInternals.maskSensitive(payload) as Record<string, unknown>;
    expect(masked.password).toBe("[REDACTED]");
    expect((masked.nested as Record<string, unknown>).token).toBe("[REDACTED]");
  });

  it("resolves log levels based on status codes", () => {
    expect(requestLoggerInternals.resolveLogLevel(200)).toBe("info");
    expect(requestLoggerInternals.resolveLogLevel(404)).toBe("warn");
    expect(requestLoggerInternals.resolveLogLevel(500)).toBe("error");
  });

  it("detects admin routes and mutation methods", () => {
    expect(requestLoggerInternals.isAdminRoute(buildRequest())).toBe(true);
    expect(
      requestLoggerInternals.isAdminRoute(
        buildRequest({ originalUrl: "/health", path: "/health" }),
      ),
    ).toBe(false);
    expect(requestLoggerInternals.isMutationMethod("GET")).toBe(false);
    expect(requestLoggerInternals.isMutationMethod("PATCH")).toBe(true);
  });

  it("derives audit entities from request paths when explicit context missing", () => {
    const derived = requestLoggerInternals.resolveAuditEntity(buildRequest());
    expect(derived).toEqual({ entity: "users", entityId: "ckuser" });

    const explicit = requestLoggerInternals.resolveAuditEntity(buildRequest(), {
      entity: "orders",
      entityId: "ord_1",
    });
    expect(explicit).toEqual({ entity: "orders", entityId: "ord_1" });

    const root = requestLoggerInternals.resolveAuditEntity(
      buildRequest({ originalUrl: "/api/v1/admin", path: "/api/v1/admin" }),
    );
    expect(root).toEqual({ entity: "admin", entityId: "root" });
  });

  it("sanitises payloads and preserves non-sensitive values", () => {
    const payload = {
      email: "user@example.com",
      details: { total: 120n },
    };

    const sanitized = requestLoggerInternals.sanitiseForLog(payload) as Record<string, unknown>;
    expect(sanitized.email).toBe("user@example.com");
    expect((sanitized.details as Record<string, unknown>).total).toBe("120");
  });
});
