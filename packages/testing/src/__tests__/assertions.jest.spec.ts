import { describe, expect, it } from "@jest/globals";

import type {} from "../assertions/jest.js";

describe("custom matchers", () => {
  it("validates http status matcher", () => {
    // @ts-expect-error Custom matcher registered via jest.setup.ts
    expect({ status: 201 }).toBeHttpStatus(201);
    // @ts-expect-error Custom matcher registered via jest.setup.ts
    expect(204).toBeHttpStatus(204);
  });

  it("provides descriptive errors for unexpected http status codes", () => {
    expect(() => {
      // @ts-expect-error Custom matcher registered via jest.setup.ts
      expect({ status: 400 }).toBeHttpStatus(200);
    }).toThrow("expected status 400 to equal 200");
  });

  it("validates non empty array matcher", () => {
    // @ts-expect-error Custom matcher registered via jest.setup.ts
    expect([1, 2, 3]).toBeNonEmptyArray();
  });

  it("fails when the array is empty", () => {
    expect(() => {
      // @ts-expect-error Custom matcher registered via jest.setup.ts
      expect([]).toBeNonEmptyArray();
    }).toThrow("expected value not to be a non-empty array");
  });

  it("fails when the value is not an array", () => {
    expect(() => {
      // @ts-expect-error Custom matcher registered via jest.setup.ts
      expect("not-an-array").toBeNonEmptyArray();
    }).toThrow("expected value to be a non-empty array");
  });

  it("matches error messages", () => {
    expect(() => {
      throw new Error("Boom");
    }).toThrow();

    // @ts-expect-error Custom matcher registered via jest.setup.ts
    expect(new Error("Boom")).toMatchErrorMessage(/Boom/);
    expect(() => {
      // @ts-expect-error Custom matcher registered via jest.setup.ts
      expect(new Error("Boom")).toMatchErrorMessage(/Nope/);
    }).toThrow('expected error message "Boom" to match /Nope/');
  });

  it("validates exact error message matching", () => {
    // @ts-expect-error Custom matcher registered via jest.setup.ts
    expect(new Error("Mismatch")).toMatchErrorMessage("Mismatch");
    expect(() => {
      // @ts-expect-error Custom matcher registered via jest.setup.ts
      expect(new Error("Mismatch")).toMatchErrorMessage("nope");
    }).toThrow('expected error message "Mismatch" to equal "nope"');
  });

  it("coerces non-error inputs into Error instances", () => {
    // @ts-expect-error Custom matcher registered via jest.setup.ts
    expect("subsystem failure").toMatchErrorMessage(/failure/);
  });
});
