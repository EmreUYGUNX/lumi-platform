import { describe, expect, it } from "@jest/globals";

import { createUserFactory } from "../factories/user-factory.js";

describe("user factory", () => {
  it("creates a deterministic user object", () => {
    const user = createUserFactory({ email: "user@example.com" });

    expect(user).toEqual(
      expect.objectContaining({
        email: "user@example.com",
        firstName: expect.any(String),
        lastName: expect.any(String),
      }),
    );
  });
});
