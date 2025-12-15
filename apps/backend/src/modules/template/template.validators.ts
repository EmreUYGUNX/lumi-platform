import { z } from "zod";

import { normaliseTags, tagSchema } from "@/modules/media/media.validators.js";
import { currencyCodeSchema, urlSchema } from "@lumi/shared/dto";

export { cuidSchema as templateIdParamSchema } from "@lumi/shared/dto";

const MAX_TAGS = 40;
const MAX_PAGE_SIZE = 100;

const booleanFromStringSchema = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalised = value.trim().toLowerCase();
    if (normalised === "true" || normalised === "1") return true;
    if (normalised === "false" || normalised === "0") return false;
  }

  return value;
}, z.boolean());

export const templateListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional(),
    perPage: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
    category: z.string().trim().min(1).max(80).optional(),
    tag: tagSchema.optional(),
    tags: z.preprocess(normaliseTags, z.array(tagSchema).max(MAX_TAGS)).optional(),
    isPaid: booleanFromStringSchema.optional(),
    featured: booleanFromStringSchema.optional(),
    published: booleanFromStringSchema.optional(),
    sort: z.enum(["popularity", "newest"]).optional(),
    order: z.enum(["asc", "desc"]).optional(),
  })
  .strict();

export type TemplateListQuery = z.infer<typeof templateListQuerySchema>;

const canvasDataSchema = z
  .unknown()
  .refine(
    (value) => typeof value === "object" && value !== null && !Array.isArray(value),
    "Canvas data must be an object.",
  );

const moneyAmountSchema = z.coerce.number().finite().min(0).max(1_000_000);

export const templateCreateBodySchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(800).optional(),
    category: z.string().trim().min(2).max(80).optional(),
    tags: z
      .preprocess(normaliseTags, z.array(tagSchema).max(MAX_TAGS))
      .default([])
      .transform((tags) => [...new Set(tags)]),
    isPaid: booleanFromStringSchema.optional().default(false),
    priceAmount: moneyAmountSchema.optional().default(0),
    currency: currencyCodeSchema.optional().default("TRY"),
    thumbnailUrl: urlSchema.optional(),
    previewUrl: urlSchema.optional(),
    canvasData: canvasDataSchema,
    isPublished: booleanFromStringSchema.optional().default(false),
    isFeatured: booleanFromStringSchema.optional().default(false),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.isPaid && value.priceAmount <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["priceAmount"],
        message: "Paid templates must have a positive price.",
      });
    }

    if (!value.isPaid && value.priceAmount !== 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["priceAmount"],
        message: "Free templates must have a price of 0.",
      });
    }
  });

export type TemplateCreateBody = z.infer<typeof templateCreateBodySchema>;

export const templateUpdateBodySchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().max(800).optional(),
    category: z.string().trim().min(2).max(80).optional(),
    tags: z
      .preprocess(normaliseTags, z.array(tagSchema).max(MAX_TAGS))
      .optional()
      .transform((tags) => (tags ? [...new Set(tags)] : undefined)),
    isPaid: booleanFromStringSchema.optional(),
    priceAmount: moneyAmountSchema.optional(),
    currency: currencyCodeSchema.optional(),
    thumbnailUrl: urlSchema.optional(),
    previewUrl: urlSchema.optional(),
    canvasData: canvasDataSchema.optional(),
    isPublished: booleanFromStringSchema.optional(),
    isFeatured: booleanFromStringSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.isPaid === true && typeof value.priceAmount === "number" && value.priceAmount <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["priceAmount"],
        message: "Paid templates must have a positive price.",
      });
    }

    if (
      value.isPaid === false &&
      typeof value.priceAmount === "number" &&
      value.priceAmount !== 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["priceAmount"],
        message: "Free templates must have a price of 0.",
      });
    }
  });

export type TemplateUpdateBody = z.infer<typeof templateUpdateBodySchema>;
