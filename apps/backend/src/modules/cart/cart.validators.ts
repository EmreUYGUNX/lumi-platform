import { z } from "zod";

import { cuidSchema, localeStringSchema, moneySchema } from "@lumi/shared/dto";

export const CART_ITEM_MIN_QUANTITY = 1;
export const CART_ITEM_MAX_QUANTITY = 10;

export const addCartItemSchema = z
  .object({
    productVariantId: cuidSchema,
    quantity: z
      .number()
      .int()
      .min(CART_ITEM_MIN_QUANTITY, "Quantity must be at least 1.")
      .max(CART_ITEM_MAX_QUANTITY, "Quantity limit exceeded."),
  })
  .strict();

export const updateCartItemSchema = z
  .object({
    quantity: z
      .number()
      .int()
      .min(0, "Quantity cannot be negative.")
      .max(CART_ITEM_MAX_QUANTITY, "Quantity limit exceeded."),
  })
  .strict();

export const mergeCartSchema = z
  .object({
    sessionId: z
      .string()
      .trim()
      .min(1, "Session identifier is required.")
      .max(120, "Session identifier is too long."),
    strategy: z.enum(["sum", "replace"]).default("sum"),
  })
  .strict();

export const validateCartQuerySchema = z
  .object({
    includeTotals: z
      .union([z.boolean(), z.string().transform((value) => value === "true")])
      .optional()
      .default(true),
  })
  .strict();

export const cartRecoveryEmailSchema = z
  .object({
    to: z.string().email(),
    firstName: localeStringSchema.max(180).nullable().optional(),
    cartId: cuidSchema,
    resumeUrl: z.string().url(),
    total: moneySchema,
    itemCount: z.number().int().nonnegative(),
  })
  .strict();

export type AddCartItemInput = z.infer<typeof addCartItemSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
export type MergeCartInput = z.infer<typeof mergeCartSchema>;
export type ValidateCartQueryInput = z.infer<typeof validateCartQuerySchema>;
export type CartRecoveryEmailInput = z.infer<typeof cartRecoveryEmailSchema>;
