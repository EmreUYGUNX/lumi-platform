import { describe, expect, it } from "@jest/globals";

import { createSignedUrl, verifySignedUrl } from "../signed-url.js";

describe("createSignedUrl", () => {
  it("generates signed URLs with nonce and expiry", () => {
    const now = new Date("2025-01-01T00:00:00.000Z");
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);
    const result = createSignedUrl({
      baseUrl: "https://app.example.com",
      path: "/verify-email",
      params: { token: "token-123" },
      expiresAt,
      secret: "signed-secret-placeholder-value-32!!",
    });

    const url = new URL(result.url);

    expect(url.searchParams.get("token")).toBe("token-123");
    expect(url.searchParams.get("signature")).toBeTruthy();
    expect(url.searchParams.get("nonce")).toBeTruthy();
    expect(url.searchParams.get("expires")).toBe(expiresAt.toISOString());

    const verification = verifySignedUrl({
      url,
      secret: "signed-secret-placeholder-value-32!!",
      now,
    });
    expect(verification.valid).toBe(true);
  });

  it("rejects expired URLs", () => {
    const expiresAt = new Date("2025-01-01T00:00:00.000Z");
    const { url } = createSignedUrl({
      baseUrl: "https://app.example.com",
      path: "/reset-password",
      params: { token: "token-456" },
      expiresAt,
      secret: "signed-secret-placeholder-value-32!!",
    });

    const verification = verifySignedUrl({
      url,
      secret: "signed-secret-placeholder-value-32!!",
      now: new Date("2025-01-01T00:10:00.000Z"),
    });

    expect(verification.valid).toBe(false);
    expect(verification.reason).toBe("expired");
  });

  it("detects tampering", () => {
    const { url } = createSignedUrl({
      baseUrl: "https://app.example.com",
      path: "/reset-password",
      params: { token: "token-789" },
      secret: "signed-secret-placeholder-value-32!!",
    });

    const manipulated = new URL(url);
    manipulated.searchParams.set("token", "token-999");

    const verification = verifySignedUrl({
      url: manipulated,
      secret: "signed-secret-placeholder-value-32!!",
      now: new Date(),
    });

    expect(verification.valid).toBe(false);
    expect(verification.reason).toBe("invalid_signature");
  });
});
