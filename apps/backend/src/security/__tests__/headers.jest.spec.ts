import { describe, expect, it } from "@jest/globals";

import { resolveSecurityHeaderMap, resolveSecurityHeaders } from "../headers.js";
import { createSecurityConfig } from "./fixtures.js";

describe("security header resolution", () => {
  it("produces header tuples", () => {
    const config = createSecurityConfig();
    const entries = resolveSecurityHeaders(config.headers);
    expect(entries).toContainEqual(["X-Content-Type-Options", "nosniff"]);
  });

  it("generates a record map", () => {
    const config = createSecurityConfig();
    const record = resolveSecurityHeaderMap(config.headers);
    expect(record["Content-Security-Policy"]).toBe("default-src 'self';");
  });
});
