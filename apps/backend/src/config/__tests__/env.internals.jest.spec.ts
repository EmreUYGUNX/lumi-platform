import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { z } from "zod";

import { envInternals } from "../env.js";

const createCtx = () => {
  const issues: z.ZodIssue[] = [];
  const ctx: z.RefinementCtx = {
    addIssue(issue) {
      issues.push(issue as z.ZodIssue);
    },
    path: [],
  } as z.RefinementCtx;
  return { ctx, issues };
};

const setEnv = (key: string, value: string | undefined) => {
  (process.env as Record<string, string | undefined>)[key] = value;
};

describe("env internals", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalSkip = process.env.LUMI_TEST_SKIP_DEFAULTS;
  const originalJwtSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    delete process.env.TEST_FLAG;
  });

  afterEach(() => {
    setEnv("NODE_ENV", originalNodeEnv);
    setEnv("LUMI_TEST_SKIP_DEFAULTS", originalSkip);
    setEnv("JWT_SECRET", originalJwtSecret);
  });

  it("transforms boolean-like values", () => {
    expect(envInternals.booleanTransformer(true)).toBe(true);
    expect(envInternals.booleanTransformer("YES")).toBe(true);
    expect(envInternals.booleanTransformer("")).toBe(false);
    expect(envInternals.booleanTransformer(1)).toBe(true);
    expect(envInternals.booleanTransformer("0")).toBe(false);
  });

  it("splits CSV values with fallbacks", () => {
    expect(envInternals.csvTransformer("a, b , ,c", [])).toEqual(["a", "b", "c"]);
    expect(envInternals.csvTransformer(undefined, ["default"])).toEqual(["default"]);
  });

  it("optionally trims strings", () => {
    expect(envInternals.optionalString("  value  ")).toBe("value");
    expect(envInternals.optionalString("   ")).toBeUndefined();
  });

  it("parses responsive breakpoint lists and reports invalid values", () => {
    const { ctx, issues } = createCtx();
    const result = envInternals.parseResponsiveBreakpointList("320, 320,640", ctx);
    expect(result).toEqual([320, 640]);
    expect(issues).toHaveLength(0);

    const { ctx: emptyCtx, issues: emptyIssues } = createCtx();
    const emptyResult = envInternals.parseResponsiveBreakpointList("  ", emptyCtx);
    expect(emptyResult).toBe(z.NEVER);
    expect(emptyIssues).toHaveLength(1);
  });

  it("parses duration strings with magnitude validation", () => {
    const { ctx, issues } = createCtx();
    expect(envInternals.parseDurationToSeconds("15m", ctx, "TEST_WINDOW")).toBe(900);
    expect(issues).toHaveLength(0);

    const { ctx: invalidCtx, issues: invalidIssues } = createCtx();
    const invalid = envInternals.parseDurationToSeconds("abc", invalidCtx, "TEST_WINDOW");
    expect(invalid).toBe(z.NEVER);
    expect(invalidIssues[0]?.message).toMatch(/must end with/);
  });

  it("normalises redact fields and port values", () => {
    expect(envInternals.normaliseRedactFields([" Password ", "password", "Token", ""])).toEqual([
      "password",
      "token",
    ]);

    expect(envInternals.parseOptionalPort("4100")).toBe(4100);
    const optionalPortInput: unknown = undefined;
    expect(envInternals.parseOptionalPort(optionalPortInput)).toBeUndefined();
    expect(() => envInternals.parseOptionalPort("invalid")).toThrow();
  });

  it("applies test environment defaults when enabled", () => {
    setEnv("NODE_ENV", "test");
    setEnv("LUMI_TEST_SKIP_DEFAULTS", "0");
    delete (process.env as Record<string, string | undefined>).JWT_SECRET;

    envInternals.applyTestEnvironmentDefaults();
    expect(process.env.JWT_SECRET).toBe("test-secret-placeholder-32-chars!!");

    setEnv("LUMI_TEST_SKIP_DEFAULTS", "1");
    setEnv("JWT_SECRET", "");
    envInternals.applyTestEnvironmentDefaults();
    expect(process.env.JWT_SECRET).toBe("");
  });
});
