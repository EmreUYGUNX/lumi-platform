import type { MatchImageSnapshotOptions } from "jest-image-snapshot";

export const defaultImageSnapshotOptions: MatchImageSnapshotOptions = {
  failureThreshold: 0.01,
  failureThresholdType: "percent",
};

export function configureVisualRegression(
  options: MatchImageSnapshotOptions = {},
): MatchImageSnapshotOptions {
  return { ...defaultImageSnapshotOptions, ...options };
}
