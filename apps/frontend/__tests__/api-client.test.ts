import { describe, expect, it } from "vitest";

import { isErrorResponse, isSuccessResponse } from "@/lib/api-client";

describe("api-client helpers", () => {
  it("identifies Q2 success responses", () => {
    const payload = { success: true, data: { hello: "world" } };
    expect(isSuccessResponse<{ hello: string }>(payload)).toBe(true);
    expect(isErrorResponse(payload)).toBe(false);
  });

  it("identifies Q2 error responses", () => {
    const payload = {
      success: false,
      error: {
        code: "UNAUTHENTICATED",
        message: "Login required",
        details: { field: "auth" },
      },
    };
    expect(isErrorResponse(payload)).toBe(true);
    expect(isSuccessResponse(payload)).toBe(false);
  });
});
