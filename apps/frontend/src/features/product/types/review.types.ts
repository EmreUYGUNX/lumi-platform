import { z } from "zod";

const reviewMediaSchema = z
  .object({
    id: z.string(),
    url: z.string().url(),
    alt: z.string().nullable().optional(),
  })
  .strict();

export const productReviewSchema = z
  .object({
    id: z.string(),
    productId: z.string(),
    userName: z.string(),
    avatarUrl: z.string().url().optional(),
    rating: z.number().int().min(1).max(5),
    title: z.string(),
    content: z.string().nullable().optional(),
    createdAt: z.string(),
    verified: z.boolean(),
    helpfulCount: z.number().int().nonnegative(),
    notHelpfulCount: z.number().int().nonnegative(),
    media: z.array(reviewMediaSchema).default([]),
  })
  .strict();

export type ProductReview = z.infer<typeof productReviewSchema>;

export interface SubmitReviewInput {
  rating: number;
  title: string;
  content?: string;
  media?: { url: string; alt?: string }[];
}

export interface ReviewVoteInput {
  reviewId: string;
  vote: "up" | "down";
}
