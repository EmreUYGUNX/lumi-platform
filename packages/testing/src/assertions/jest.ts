import { expect } from "@jest/globals";
import type { MatcherFunction } from "expect";
import type { Response } from "supertest";

const toBeHttpStatus: MatcherFunction<[expected?: number]> = function receivedStatusMatcher(
  received: unknown,
  expected = 200,
) {
  const status = typeof received === "number" ? received : (received as Response)?.status;
  if (status === expected) {
    return {
      pass: true,
      message: () => `expected status not to be ${expected}`,
    };
  }

  return {
    pass: false,
    message: () => `expected status ${status} to equal ${expected}`,
  };
};

const toBeNonEmptyArray: MatcherFunction<[]> = function nonEmptyArrayMatcher(received: unknown) {
  const isArray = Array.isArray(received);
  const pass = isArray && received.length > 0;
  return {
    pass,
    message: () => `expected value ${isArray ? "not " : ""}to be a non-empty array`,
  };
};

const toMatchErrorMessage: MatcherFunction<[string | RegExp]> = function errorMatcher(
  received: unknown,
  expected,
) {
  const error = received instanceof Error ? received : new Error(String(received));
  if (expected instanceof RegExp) {
    const pass = expected.test(error.message);
    return {
      pass,
      message: () => `expected error message "${error.message}" to match ${expected}`,
    };
  }

  const pass = error.message === expected;
  return {
    pass,
    message: () => `expected error message "${error.message}" to equal "${expected}"`,
  };
};

const customMatchers = {
  toBeHttpStatus,
  toBeNonEmptyArray,
  toMatchErrorMessage,
};

export type LumiMatcherContext = typeof customMatchers;

export function registerJestMatchers(): void {
  expect.extend(
    customMatchers as Record<string, (...args: readonly unknown[]) => jest.CustomMatcherResult>,
  );
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Jest augments the global namespace for matcher types
  namespace jest {
    interface Matchers<R> {
      toBeHttpStatus(expected?: number): R;
      toBeNonEmptyArray(): R;
      toMatchErrorMessage(expected: string | RegExp): R;
    }
  }
}
