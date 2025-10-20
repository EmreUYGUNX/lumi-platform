import type * as nodeCrypto from "node:crypto";
import { randomBytes } from "node:crypto";

import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import {
  generateHashedTokenSecret,
  generateTokenSecret,
  parseToken,
  serialiseToken,
  verifyTokenSecret,
} from "../token.js";

jest.mock("node:crypto", () => {
  const actual = jest.requireActual<typeof nodeCrypto>("node:crypto");
  return {
    ...actual,
    randomBytes: jest.fn(actual.randomBytes),
  };
});

const mockRandomBytes = jest.mocked(randomBytes);

describe("token crypto helpers", () => {
  beforeEach(() => {
    mockRandomBytes.mockClear();
  });

  it("generates URL-safe secrets with default length", () => {
    const secret = generateTokenSecret();

    expect(secret).toMatch(/^[\w-]+$/);
    expect(secret.length).toBe(64);
    expect(mockRandomBytes).toHaveBeenCalledWith(48);
  });

  it("supports custom secret lengths", () => {
    const secret = generateTokenSecret(16);

    expect(secret.length).toBeGreaterThanOrEqual(22);
    expect(secret).toMatch(/^[\w-]+$/);
    expect(mockRandomBytes).toHaveBeenCalledWith(16);
  });

  it("rejects invalid secret lengths", () => {
    expect(() => generateTokenSecret(0)).toThrow(RangeError);
    expect(() => generateTokenSecret(1.2)).toThrow(RangeError);
    expect(() => generateTokenSecret(-5)).toThrow(RangeError);
  });

  it("creates hashed secrets that verify successfully", async () => {
    const { secret, hash } = await generateHashedTokenSecret(12);

    expect(secret).toHaveLength(16);
    await expect(verifyTokenSecret(secret, hash)).resolves.toBe(true);
  });

  it("fails verification when secrets differ", async () => {
    const { hash } = await generateHashedTokenSecret(10);

    await expect(verifyTokenSecret("wrong-secret", hash)).resolves.toBe(false);
  });

  it("serialises and parses tokens correctly", () => {
    const token = serialiseToken("token-id", "secret-value");

    expect(token).toBe("token-id.secret-value");
    expect(parseToken(token)).toEqual({ id: "token-id", secret: "secret-value" });
  });

  it("trims whitespace when parsing tokens", () => {
    const token = "  identifier.secret  ";
    expect(parseToken(token)).toEqual({ id: "identifier", secret: "secret" });
  });

  it("rejects invalid serialisation inputs", () => {
    expect(() => serialiseToken("", "secret")).toThrow(TypeError);
    expect(() => serialiseToken("id", "")).toThrow(TypeError);
    expect(() => serialiseToken("id.with.dot", "secret")).toThrow(TypeError);
  });

  it("rejects malformed tokens on parse", () => {
    expect(() => parseToken("invalid")).toThrow(TypeError);
    expect(() => parseToken(".missingId")).toThrow(TypeError);
    expect(() => parseToken("missingSecret.")).toThrow(TypeError);
    expect(() => parseToken("")).toThrow(TypeError);
  });
});
