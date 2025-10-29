import { describe, expect, it } from "@jest/globals";

import type { CorsConfig } from "@lumi/types";

import { isOriginAllowed, normalizeCorsConfig } from "../src/index.js";

const baseConfig: CorsConfig = {
  enabled: true,
  allowedOrigins: ["http://localhost:3000", "http://localhost:3000", "https://app.lumi.com"],
  allowedMethods: ["get", "POST", "post"],
  allowedHeaders: ["Content-Type", "authorization", "CONTENT-TYPE"],
  exposedHeaders: ["X-Request-Id", "x-request-id"],
  allowCredentials: true,
  maxAgeSeconds: 600,
};

describe("CORS helpers", () => {
  it("normalises and deduplicates CORS inputs", () => {
    const normalised = normalizeCorsConfig(baseConfig);
    expect(normalised.allowedOrigins).toEqual(["http://localhost:3000", "https://app.lumi.com"]);
    expect(normalised.allowedMethods).toEqual(["GET", "POST"]);
    expect(normalised.allowedHeaders).toEqual(["content-type", "authorization"]);
    expect(normalised.exposedHeaders).toEqual(["x-request-id"]);
  });

  it("rejects wildcard origins when configured", () => {
    const config: CorsConfig = {
      ...baseConfig,
      allowedOrigins: ["*"],
    };

    const normalised = normalizeCorsConfig(config);
    expect(normalised.allowedOrigins).toEqual([]);
    expect(isOriginAllowed("https://example.com", config)).toBe(false);
  });

  it("rejects unknown origins when restrictions apply", () => {
    expect(isOriginAllowed("https://unknown.com", baseConfig)).toBe(false);
    expect(isOriginAllowed(undefined, baseConfig)).toBe(true);
  });
});
