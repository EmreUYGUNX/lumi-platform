import { describe, expect, it } from "@jest/globals";

import { isProduction, sharedConstants } from "../src/index.js";

describe("shared utilities", () => {
  it("exposes the canonical project name", () => {
    expect(sharedConstants.projectName).toBe("Lumi");
  });

  it("identifies production mode", () => {
    const originalEnv = process.env.NODE_ENV;
    Reflect.set(process.env, "NODE_ENV", "production");
    expect(isProduction()).toBe(true);
    Reflect.set(process.env, "NODE_ENV", originalEnv);
  });
});
