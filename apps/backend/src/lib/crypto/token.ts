import { randomBytes } from "node:crypto";

import { hashPassword, verifyPassword } from "./password.js";

const TOKEN_PARTS_SEPARATOR = ".";
const DEFAULT_TOKEN_BYTE_LENGTH = 48;

export interface GeneratedTokenSecret {
  secret: string;
  hash: string;
}

/**
 * Generates a cryptographically secure token secret encoded using the URL-safe
 * Base64 alphabet. Defaults to 48 random bytes (~64 characters when encoded).
 */
export const generateTokenSecret = (byteLength: number = DEFAULT_TOKEN_BYTE_LENGTH): string => {
  if (!Number.isInteger(byteLength) || byteLength <= 0) {
    throw new RangeError("Token byte length must be a positive integer.");
  }

  return randomBytes(byteLength).toString("base64url");
};

export const generateHashedTokenSecret = async (
  byteLength: number = DEFAULT_TOKEN_BYTE_LENGTH,
): Promise<GeneratedTokenSecret> => {
  const secret = generateTokenSecret(byteLength);
  const hash = await hashPassword(secret);

  return { secret, hash };
};

export interface SerialisedToken {
  id: string;
  secret: string;
}

export const serialiseToken = (id: string, secret: string): string => {
  if (!id || !secret) {
    throw new TypeError("Token id and secret must be non-empty strings.");
  }

  if (id.includes(TOKEN_PARTS_SEPARATOR)) {
    throw new TypeError("Token id cannot contain separator characters.");
  }

  return `${id}${TOKEN_PARTS_SEPARATOR}${secret}`;
};

export const parseToken = (token: string): SerialisedToken => {
  if (typeof token !== "string" || token.trim().length === 0) {
    throw new TypeError("Token must be a non-empty string.");
  }

  const trimmed = token.trim();
  const separatorIndex = trimmed.indexOf(TOKEN_PARTS_SEPARATOR);

  if (separatorIndex <= 0 || separatorIndex === trimmed.length - 1) {
    throw new TypeError("Token format is invalid.");
  }

  const id = trimmed.slice(0, separatorIndex);
  const secret = trimmed.slice(separatorIndex + 1);

  if (secret.length === 0) {
    throw new TypeError("Token secret is missing.");
  }

  return { id, secret };
};

export const verifyTokenSecret = async (secret: string, hash: string): Promise<boolean> => {
  return verifyPassword(secret, hash);
};
