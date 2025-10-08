import { describe, expect, it } from "@jest/globals";

import { configureVisualRegression, defaultImageSnapshotOptions } from "../snapshots/image.js";

describe("visual regression helpers", () => {
  it("merges custom snapshot options", () => {
    const result = configureVisualRegression({ customSnapshotsDir: "./__snapshots__" });
    expect(result).toEqual(
      expect.objectContaining({
        failureThreshold: defaultImageSnapshotOptions.failureThreshold,
        customSnapshotsDir: "./__snapshots__",
      }),
    );
  });
});
