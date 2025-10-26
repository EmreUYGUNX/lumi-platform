import { timingSafeEqual } from "node:crypto";

import bcrypt from "bcryptjs";

const DEFAULT_BCRYPT_SALT_ROUNDS = 12;
const TEST_BCRYPT_SALT_ROUNDS = 6;

const parseSaltRounds = (value: string | undefined): number | undefined => {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

export const BCRYPT_SALT_ROUNDS =
  parseSaltRounds(process.env.BCRYPT_SALT_ROUNDS) ??
  (process.env.NODE_ENV === "test" ? TEST_BCRYPT_SALT_ROUNDS : DEFAULT_BCRYPT_SALT_ROUNDS);

export type PasswordValidationErrorCode =
  | "min_length"
  | "uppercase"
  | "lowercase"
  | "number"
  | "special";

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSpecial: boolean;
}

export interface PasswordValidationIssue {
  code: PasswordValidationErrorCode;
  message: string;
}

export interface PasswordValidationResult {
  isValid: boolean;
  issues: PasswordValidationIssue[];
}

export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: true,
};

const UPPERCASE_REGEX = /[A-Z]/;
const LOWERCASE_REGEX = /[a-z]/;
const NUMBER_REGEX = /\d/;
const SPECIAL_CHAR_REGEX = /[^\dA-Za-z]/;

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
};

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const timingSafeStringCompare = (a: string, b: string): boolean => {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);

  const length = Math.max(bufferA.length, bufferB.length);

  const paddedA = Buffer.alloc(length);
  const paddedB = Buffer.alloc(length);

  bufferA.copy(paddedA);
  bufferB.copy(paddedB);

  const match = timingSafeEqual(paddedA, paddedB);

  return match && bufferA.length === bufferB.length;
};

export const validatePasswordStrength = (
  password: string,
  policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY,
): PasswordValidationResult => {
  const issues: PasswordValidationIssue[] = [];

  if (policy.requireUppercase && !UPPERCASE_REGEX.test(password)) {
    issues.push({
      code: "uppercase",
      message: "Password must contain at least one uppercase letter.",
    });
  }

  if (policy.requireLowercase && !LOWERCASE_REGEX.test(password)) {
    issues.push({
      code: "lowercase",
      message: "Password must contain at least one lowercase letter.",
    });
  }

  if (policy.requireNumber && !NUMBER_REGEX.test(password)) {
    issues.push({
      code: "number",
      message: "Password must contain at least one number.",
    });
  }

  if (policy.requireSpecial && !SPECIAL_CHAR_REGEX.test(password)) {
    issues.push({
      code: "special",
      message: "Password must contain at least one special character.",
    });
  }

  if (password.length < policy.minLength) {
    issues.push({
      code: "min_length",
      message: `Password must be at least ${policy.minLength} characters long.`,
    });
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
};
