import { describe, expect, it } from "@jest/globals";

import { buildCorsOptions } from "../cors.js";
import { createSecurityConfig } from "./fixtures.js";

describe("buildCorsOptions", () => {
  it("returns origin arrays for non-wildcard configuration", () => {
    const config = createSecurityConfig();
    const options = buildCorsOptions(config.cors);
    expect(options.origin).toEqual(config.cors.allowedOrigins);
    expect(options.maxAge).toBe(config.cors.maxAgeSeconds);
    expect(options.credentials).toBe(true);
    expect(options.unsafeWildcardDetected).toBe(false);
  });

  it("flags wildcard origin configuration and returns an empty allow list", () => {
    const config = createSecurityConfig();
    const options = buildCorsOptions({ ...config.cors, allowedOrigins: ["*"] });
    expect(options.origin).toEqual([]);
    expect(options.unsafeWildcardDetected).toBe(true);
  });
});
