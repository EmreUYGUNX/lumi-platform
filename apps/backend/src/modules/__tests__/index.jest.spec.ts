import { describe, expect, it } from "@jest/globals";

import * as modules from "../index.js";

describe("modules aggregate export", () => {
  it("exposes repository and service bindings", () => {
    expect(modules).toBeDefined();
    expect(Object.keys(modules).length).toBeGreaterThan(0);
  });
});
