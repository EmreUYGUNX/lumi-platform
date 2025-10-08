import { describe, expect, it } from "@jest/globals";

import * as testingExports from "../index.js";

describe("@lumi/testing entry point", () => {
  it("exposes the core testing helpers", () => {
    expect(typeof testingExports.createApiClient).toBe("function");
    expect(typeof testingExports.createUserFactory).toBe("function");
    expect(typeof testingExports.configureVisualRegression).toBe("function");
    expect(typeof testingExports.withFixtures).toBe("function");
  });
});
