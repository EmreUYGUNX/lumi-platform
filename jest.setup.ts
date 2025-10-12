import { TextDecoder, TextEncoder } from "node:util";

import "@testing-library/jest-dom";
import type { MatchImageSnapshotOptions } from "jest-image-snapshot";
import { toMatchImageSnapshot } from "jest-image-snapshot";

import { configureVisualRegression } from "@lumi/testing";
import { registerJestMatchers } from "@lumi/testing/jest";

registerJestMatchers();

const snapshotMatcher = toMatchImageSnapshot as unknown as (
  this: jest.MatcherContext,
  received: unknown,
  options?: MatchImageSnapshotOptions,
) => jest.CustomMatcherResult;

expect.extend({
  toMatchImageSnapshot(
    this: jest.MatcherContext,
    received: unknown,
    options: MatchImageSnapshotOptions = {},
  ) {
    const mergedOptions = configureVisualRegression(options);
    return snapshotMatcher.call(this, received, mergedOptions);
  },
});

if (globalThis.TextEncoder === undefined) {
  globalThis.TextEncoder = TextEncoder as typeof globalThis.TextEncoder;
}

if (globalThis.TextDecoder === undefined) {
  globalThis.TextDecoder = TextDecoder as typeof globalThis.TextDecoder;
}

const ensureEnv = (key: string, value: string) => {
  if (process.env[key] === undefined) {
    process.env[key] = value;
  }
};

ensureEnv("NODE_ENV", "test");
ensureEnv("APP_NAME", "Lumi Test Environment");
ensureEnv("APP_PORT", "4000");
ensureEnv("API_BASE_URL", "http://localhost:4100");
ensureEnv("FRONTEND_URL", "http://localhost:3000");
ensureEnv("DATABASE_URL", "postgresql://localhost:5432/lumi");
ensureEnv("REDIS_URL", "redis://localhost:6379/0");
ensureEnv("STORAGE_BUCKET", "lumi-test-bucket");
ensureEnv("JWT_SECRET", "abcdefghijklmnopqrstuvwxyzABCDEF");

process.env.TZ = "UTC";
