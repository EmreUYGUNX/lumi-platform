import { describe, expect, it } from "@jest/globals";

import { CLOUDINARY_BREAKPOINTS, getCloudinaryBreakpoints } from "../src/media/cloudinary.js";

const EXPECTED_BREAKPOINTS = [
  300, 320, 480, 600, 640, 768, 900, 1024, 1200, 1280, 1536, 1600, 1920,
];

describe("media cloudinary helpers", () => {
  it("exposes canonical frozen breakpoints", () => {
    expect(CLOUDINARY_BREAKPOINTS).toEqual(EXPECTED_BREAKPOINTS);
    expect(Object.isFrozen(CLOUDINARY_BREAKPOINTS)).toBe(true);
  });

  it("returns mutable defensive copies", () => {
    const read = getCloudinaryBreakpoints();
    expect(read).toEqual(EXPECTED_BREAKPOINTS);
    expect(Object.isFrozen(read)).toBe(false);

    const mutated = read as number[];
    mutated.push(4096);
    mutated[0] = 1;

    const next = getCloudinaryBreakpoints();
    expect(next).toEqual(EXPECTED_BREAKPOINTS);
    expect(next).not.toContain(4096);
    expect(next[0]).toBe(EXPECTED_BREAKPOINTS[0]);
  });

  it("always returns new instances", () => {
    const first = getCloudinaryBreakpoints();
    const second = getCloudinaryBreakpoints();

    expect(second).toEqual(first);
    expect(second).not.toBe(first);
  });
});
