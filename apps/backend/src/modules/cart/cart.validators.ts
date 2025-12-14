import { z } from "zod";

import { cuidSchema, localeStringSchema, moneySchema } from "@lumi/shared/dto";

import { previewLayersSchema } from "../preview/preview.validators.js";

export const CART_ITEM_MIN_QUANTITY = 1;
export const CART_ITEM_MAX_QUANTITY = 10;

const MAX_CUSTOMIZATION_DATA_LENGTH = 2_000_000;

const customizationDesignDataRecordSchema = z.record(z.unknown());

const customizationDesignDataSchema = z.union([
  customizationDesignDataRecordSchema,
  z
    .string()
    .trim()
    .min(2)
    .max(MAX_CUSTOMIZATION_DATA_LENGTH)
    .transform((value, ctx) => {
      try {
        const parsed = JSON.parse(value) as unknown;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "designData must be a JSON object.",
          });
          return z.NEVER;
        }
        return parsed as Record<string, unknown>;
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "designData must be valid JSON.",
          fatal: true,
        });
        return z.NEVER;
      }
    })
    .pipe(customizationDesignDataRecordSchema),
]);

export const cartItemCustomizationSchema = z
  .object({
    designArea: z.string().trim().min(1).max(64),
    designData: customizationDesignDataSchema,
    layers: previewLayersSchema,
    previewUrl: z.string().url().optional(),
    thumbnailUrl: z.string().url().optional(),
  })
  .strict();

export const addCartItemSchema = z
  .object({
    productVariantId: cuidSchema,
    quantity: z
      .number()
      .int()
      .min(CART_ITEM_MIN_QUANTITY, "Quantity must be at least 1.")
      .max(CART_ITEM_MAX_QUANTITY, "Quantity limit exceeded."),
    customization: cartItemCustomizationSchema.optional(),
  })
  .strict();

export const updateCartItemSchema = z
  .object({
    quantity: z
      .number()
      .int()
      .min(0, "Quantity cannot be negative.")
      .max(CART_ITEM_MAX_QUANTITY, "Quantity limit exceeded."),
    customization: z.union([cartItemCustomizationSchema, z.null()]).optional(),
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
    reserveInventory: z
      .union([z.boolean(), z.string().transform((value) => value === "true")])
      .optional()
      .default(false),
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
