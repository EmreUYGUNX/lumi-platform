import { describe, expect, it } from "@jest/globals";
import { z } from "zod";

import type { ValidationConfig } from "@lumi/types";

import { createValidator, sanitizeValue, validatePayload } from "../src/index.js";

const baseConfig: ValidationConfig = {
  strict: false,
  sanitize: true,
  stripUnknown: true,
  maxBodySizeKb: 512,
};

describe("Validation helpers", () => {
  it("sanitises strings and nested objects", () => {
    const dirty = {
      name: "  Lumi\u0000 ",
      nested: [" value\u0001"],
    };

    const cleaned = sanitizeValue(dirty);
    expect(cleaned).toEqual({ name: "Lumi", nested: ["value"] });
  });

  it("rejects payloads that exceed the configured size", () => {
    const config: ValidationConfig = { ...baseConfig, maxBodySizeKb: 1 };
    const schema = z.object({ note: z.string() });
    const payload = { note: "x".repeat(3 * 1024) };

    const result = validatePayload(schema, payload, config);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.status).toBe(413);
    }
  });

  it("validates and sanitises payloads using configured options", () => {
    const schema = z
      .object({
        name: z.string(),
        email: z.string().email(),
      })
      .strip();

    const result = validatePayload(
      schema,
      { name: " Lumi ", email: "user@example.com", extra: true },
      baseConfig,
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ name: "Lumi", email: "user@example.com" });
      expect(result.sanitized).toBe(true);
    }
  });

  it("rejects unknown keys when strict mode is enabled", () => {
    const schema = z.object({ name: z.string() });
    const result = validatePayload(
      schema,
      { name: "Lumi", extra: true },
      { ...baseConfig, strict: true },
    );

    expect(result.success).toBe(false);
  });

  it("creates reusable validator functions", () => {
    const schema = z.object({ token: z.string().min(8) });
    const validator = createValidator(schema, baseConfig);

    const failure = validator({ token: "short" });
    expect(failure.success).toBe(false);

    const success = validator({ token: "abcdefgh" });
    expect(success.success).toBe(true);
  });
});
