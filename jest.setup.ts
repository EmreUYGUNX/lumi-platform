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

process.env.TZ = "UTC";
