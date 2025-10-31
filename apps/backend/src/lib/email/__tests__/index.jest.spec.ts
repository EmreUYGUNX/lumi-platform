import { describe, expect, it } from "@jest/globals";

import * as emailExports from "../index.js";

describe("email module exports", () => {
  it("exposes the expected helper functions", () => {
    expect(emailExports).toHaveProperty("createSignedUrl");
    expect(emailExports).toHaveProperty("verifySignedUrl");
    expect(emailExports).toHaveProperty("getEmailTemplate");
  });
});
