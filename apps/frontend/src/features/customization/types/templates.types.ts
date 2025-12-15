import { z } from "zod";

import {
  cuidSchema,
  isoDateTimeSchema,
  moneySchema,
  paginationMetaSchema,
  urlSchema,
} from "@lumi/shared/dto";

export const templatePaginationMetaSchema = z
  .object({
    pagination: paginationMetaSchema,
  })
  .strip();

export type TemplatePaginationMeta = z.infer<typeof templatePaginationMetaSchema>;

export const designTemplateSummarySchema = z
  .object({
    id: cuidSchema,
    name: z.string().min(1),
    description: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
    tags: z.array(z.string().trim().min(1)).default([]),
    isPaid: z.boolean(),
    price: moneySchema,
    thumbnailUrl: urlSchema.nullable().optional(),
    previewUrl: urlSchema.nullable().optional(),
    isPublished: z.boolean(),
    isFeatured: z.boolean(),
    usageCount: z.number().int(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strip();

export type DesignTemplateSummaryView = z.infer<typeof designTemplateSummarySchema>;

export const designTemplateViewSchema = designTemplateSummarySchema
  .extend({
    canvasData: z.unknown(),
  })
  .strip();

export type DesignTemplateView = z.infer<typeof designTemplateViewSchema>;
