import { z } from "zod";

import { productSummarySchema } from "@lumi/shared/dto";

const ratingBreakdownSchema = z
  .record(z.string(), z.number().int().nonnegative())
  .transform(
    (record) =>
      Object.fromEntries(
        Object.entries(record).map(([rating, count]) => [Number(rating), count]),
      ) as Record<number, number>,
  );

export const productReviewStatsSchema = z
  .object({
    totalReviews: z.number().int().nonnegative(),
    averageRating: z.number().min(0),
    ratingBreakdown: ratingBreakdownSchema,
  })
  .strict();

export const productDetailSchema = z
  .object({
    product: productSummarySchema,
    reviews: productReviewStatsSchema,
  })
  .strict();

export type ProductDetail = z.infer<typeof productDetailSchema>;
export type ProductReviewStats = z.infer<typeof productReviewStatsSchema>;
