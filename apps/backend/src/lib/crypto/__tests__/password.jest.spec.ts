import { describe, expect, it } from "@jest/globals";
import bcrypt from "bcryptjs";

import {
  BCRYPT_SALT_ROUNDS,
  DEFAULT_PASSWORD_POLICY,
  type PasswordValidationErrorCode,
  hashPassword,
  timingSafeStringCompare,
  validatePasswordStrength,
  verifyPassword,
} from "../password.js";

const INVALID_PASSWORD_CASES: readonly [
  label: string,
  candidate: string,
  expectedCode: PasswordValidationErrorCode,
][] = [
  ["uppercase", "password123!", "uppercase"],
  ["lowercase", "PASSWORD123!", "lowercase"],
  ["number", "Password!!!!", "number"],
  ["special", "Password1234", "special"],
  ["minimum length", "Aa1!Aa1!Aa1", "min_length"],
];

describe("password utilities", () => {
  const STRONG_PASSWORD = "Str0ng!Passw0rd";

  it("hashes passwords using bcrypt with the configured cost factor", async () => {
    const hash = await hashPassword(STRONG_PASSWORD);

    expect(hash).toMatch(/^\$2[aby]\$\d{2}\$.{53}$/);
    expect(bcrypt.getRounds(hash)).toBe(BCRYPT_SALT_ROUNDS);
  });

  it("successfully verifies the correct password", async () => {
    const hash = await hashPassword(STRONG_PASSWORD);

    await expect(verifyPassword(STRONG_PASSWORD, hash)).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword(STRONG_PASSWORD);

    await expect(verifyPassword("Wr0ng!Password", hash)).resolves.toBe(false);
  });

  it("accepts passwords that meet the default policy", () => {
    const result = validatePasswordStrength(STRONG_PASSWORD, DEFAULT_PASSWORD_POLICY);

    expect(result.isValid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it.each(INVALID_PASSWORD_CASES)(
    "detects missing %s requirement",
    (_label, candidate, expectedCode) => {
      const result = validatePasswordStrength(candidate, DEFAULT_PASSWORD_POLICY);

      expect(result.isValid).toBe(false);
      expect(result.issues.map((issue) => issue.code)).toContain(expectedCode);
    },
  );

  it("performs timing-safe string comparisons regardless of length differences", () => {
    expect(timingSafeStringCompare("token-123", "token-123")).toBe(true);
    expect(timingSafeStringCompare("token-123", "token-1234")).toBe(false);
    expect(timingSafeStringCompare("token-123", "token-xyz")).toBe(false);
  });
});
