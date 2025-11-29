import { describe, expect, it } from "vitest";

import { productReviewStatsSchema } from "../product-detail.types";

describe("productReviewStatsSchema", () => {
  it("normalizes rating breakdown keys to numbers", () => {
    const parsed = productReviewStatsSchema.parse({
      totalReviews: 3,
      averageRating: 4.5,
      ratingBreakdown: { "5": 2, "4": 1 },
    });

    expect(parsed.ratingBreakdown[5]).toBe(2);
    expect(parsed.ratingBreakdown[4]).toBe(1);
    expect(parsed.ratingBreakdown[3]).toBeUndefined();
  });
});
