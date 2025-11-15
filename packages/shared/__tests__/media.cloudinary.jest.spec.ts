import { describe, expect, it } from "@jest/globals";

import { CLOUDINARY_BREAKPOINTS, getCloudinaryBreakpoints } from "../src/media/cloudinary.js";

describe("media cloudinary helpers", () => {
  it("exposes immutable breakpoint list", () => {
    const firstRead = getCloudinaryBreakpoints();
    expect(firstRead).toEqual(CLOUDINARY_BREAKPOINTS);
    expect(Object.isFrozen(firstRead)).toBe(true);
  });

  it("returns a defensive copy when read", () => {
    const first = getCloudinaryBreakpoints();
    // @ts-expect-error -- runtime mutation should not affect the source array.
    expect(() => {
      first.push(9999);
    }).toThrow();
    const second = getCloudinaryBreakpoints();
    expect(second).toEqual(CLOUDINARY_BREAKPOINTS);
    expect(second).not.toBe(first);
  });
});
