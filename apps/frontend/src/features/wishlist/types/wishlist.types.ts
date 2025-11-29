import { z } from "zod";

import { cuidSchema, isoDateTimeSchema, productSummarySchema } from "@lumi/shared/dto";

export const wishlistItemSchema = z
  .object({
    id: cuidSchema,
    productId: cuidSchema,
    product: productSummarySchema,
    addedAt: isoDateTimeSchema,
    notes: z.string().trim().max(280).optional(),
    preferredVariantId: cuidSchema.optional(),
  })
  .strict();

export const wishlistSchema = z
  .object({
    id: cuidSchema,
    userId: cuidSchema,
    items: z.array(wishlistItemSchema),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict();

export const addToWishlistInputSchema = z
  .object({
    productId: cuidSchema,
  })
  .strict();

export const removeFromWishlistInputSchema = z
  .object({
    itemId: cuidSchema,
  })
  .strict();

export type WishlistItem = z.infer<typeof wishlistItemSchema>;
export type Wishlist = z.infer<typeof wishlistSchema>;
export type AddToWishlistInput = z.infer<typeof addToWishlistInputSchema>;
export type RemoveFromWishlistInput = z.infer<typeof removeFromWishlistInputSchema>;
