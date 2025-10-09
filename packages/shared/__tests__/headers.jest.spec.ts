import { describe, expect, it } from "@jest/globals";

import type { SecurityHeadersConfig } from "@lumi/types";

import { buildSecurityHeaders, buildSecurityHeadersRecord } from "../src/index.js";

const baseHeaders: SecurityHeadersConfig = {
  enabled: true,
  contentSecurityPolicy: "default-src 'self';",
  referrerPolicy: "strict-origin-when-cross-origin",
  frameGuard: "DENY",
  permissionsPolicy: "camera=(), microphone=()",
  strictTransportSecurity: {
    maxAgeSeconds: 63_072_000,
    includeSubDomains: true,
    preload: true,
  },
  expectCt: {
    enforce: false,
    maxAgeSeconds: 0,
    reportUri: undefined,
  },
  crossOriginEmbedderPolicy: "require-corp",
  crossOriginOpenerPolicy: "same-origin",
  crossOriginResourcePolicy: "same-site",
  xContentTypeOptions: "nosniff",
};

describe("Security headers", () => {
  it("builds the default header list", () => {
    const headers = buildSecurityHeaders(baseHeaders);
    expect(headers).toContainEqual(["Content-Security-Policy", "default-src 'self';"]);
    expect(headers).toContainEqual([
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    ]);
    expect(headers).not.toContainEqual(expect.arrayContaining(["Expect-CT"]));
  });

  it("includes Expect-CT when configured", () => {
    const headers = buildSecurityHeaders({
      ...baseHeaders,
      expectCt: {
        enforce: true,
        maxAgeSeconds: 86_400,
        reportUri: "https://ct.example.com/report",
      },
    });

    expect(headers).toContainEqual([
      "Expect-CT",
      "max-age=86400, enforce, report-uri=https://ct.example.com/report",
    ]);
  });

  it("returns an object map when requested", () => {
    const record = buildSecurityHeadersRecord(baseHeaders);
    expect(record["X-Content-Type-Options"]).toBe("nosniff");
  });

  it("returns empty output when disabled", () => {
    const headers = buildSecurityHeaders({ ...baseHeaders, enabled: false });
    expect(headers).toEqual([]);
  });
});
