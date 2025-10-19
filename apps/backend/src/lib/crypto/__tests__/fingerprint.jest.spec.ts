import { describe, expect, it } from "@jest/globals";

import { createDeviceFingerprint, createFingerprintPayload } from "../fingerprint.js";

const SECRET = "test-secret";

describe("fingerprint utilities", () => {
  it("normalises missing components to a deterministic payload", () => {
    const payload = createFingerprintPayload({
      ipAddress: undefined,
      userAgent: undefined,
      accept: "",
    });

    expect(payload).toBe("unknown|unknown|unknown");
  });

  it("produces stable hashes for identical inputs", () => {
    const first = createDeviceFingerprint({
      secret: SECRET,
      ipAddress: "203.0.113.10",
      userAgent: "Mozilla/5.0",
      accept: "text/html",
    });

    const second = createDeviceFingerprint({
      secret: SECRET,
      ipAddress: "203.0.113.10",
      userAgent: "Mozilla/5.0",
      accept: "text/html",
    });

    expect(first).toBe(second);
    expect(first).toMatch(/^[A-Za-z0-9_-]+$/u);
  });
});
