// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from "@jest/globals";

import {
  BCRYPT_SALT_ROUNDS,
  hashPassword,
  timingSafeStringCompare,
  validatePasswordStrength,
  verifyPassword,
} from "../../crypto/password.js";

describe("hashPassword", () => {
  it("hashes using bcrypt with the configured cost factor", async () => {
    const password = "ComplexPass123!";

    const hash = await hashPassword(password);

    expect(hash).toMatch(/^\$2[aby]\$/);

    const segments = hash.split("$");

    expect(segments[2]).toBeDefined();

    const costFactor = Number.parseInt(segments[2] ?? "", 10);
    expect(Number.isNaN(costFactor)).toBe(false);
    expect(costFactor).toBeGreaterThanOrEqual(BCRYPT_SALT_ROUNDS);
    expect(hash).not.toBe(password);
  });
});

describe("verifyPassword", () => {
  it("returns true for matching passwords", async () => {
    const password = "AnotherSecure#123";
    const hash = await hashPassword(password);

    await expect(verifyPassword(password, hash)).resolves.toBe(true);
  });

  it("returns false for non-matching passwords", async () => {
    const password = "CorrectHorseBatteryStaple!";
    const hash = await hashPassword(password);

    await expect(verifyPassword("WrongPassword$123", hash)).resolves.toBe(false);
  });
});

describe("timingSafeStringCompare", () => {
  it("matches identical strings", () => {
    expect(timingSafeStringCompare("abc123", "abc123")).toBe(true);
  });

  it("returns false for different inputs without leaking length information", () => {
    expect(timingSafeStringCompare("secret-value", "secret-value-mismatch")).toBe(false);
    expect(timingSafeStringCompare("Short", "longer-value")).toBe(false);
  });
});

describe("validatePasswordStrength", () => {
  it("passes for strong passwords", () => {
    const result = validatePasswordStrength("ValidPass123!");

    expect(result.isValid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("identifies all missing requirements", () => {
    const result = validatePasswordStrength("weakpass");

    expect(result.isValid).toBe(false);

    const codes = result.issues.map((issue) => issue.code);
    expect(codes).toEqual(expect.arrayContaining(["uppercase", "number", "special", "min_length"]));
  });

  it("flags missing uppercase characters", () => {
    const result = validatePasswordStrength("lowercasepass123!");

    expect(result.isValid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain("uppercase");
  });

  it("flags missing lowercase characters", () => {
    const result = validatePasswordStrength("UPPERCASE123!");

    expect(result.isValid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain("lowercase");
  });

  it("flags missing numeric characters", () => {
    const result = validatePasswordStrength("StrongPass!!");

    expect(result.isValid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain("number");
  });

  it("flags missing special characters", () => {
    const result = validatePasswordStrength("StrongPass1234");

    expect(result.isValid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain("special");
  });

  it("flags insufficient length", () => {
    const result = validatePasswordStrength("Aa1!");

    expect(result.isValid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain("min_length");
  });
});
