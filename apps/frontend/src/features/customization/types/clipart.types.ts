import { z } from "zod";

import {
  cuidSchema,
  isoDateTimeSchema,
  moneySchema,
  paginationMetaSchema,
  urlSchema,
} from "@lumi/shared/dto";

export const clipartPaginationMetaSchema = z
  .object({
    pagination: paginationMetaSchema,
  })
  .strip();

export type ClipartPaginationMeta = z.infer<typeof clipartPaginationMetaSchema>;

export const clipartAssetSchema = z
  .object({
    id: cuidSchema,
    name: z.string().min(1),
    description: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
    tags: z.array(z.string().trim().min(1)).default([]),
    isPaid: z.boolean(),
    price: moneySchema,
    svg: z.string().min(1),
    thumbnailUrl: urlSchema.nullable().optional(),
    usageCount: z.number().int(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strip();

export type ClipartAssetView = z.infer<typeof clipartAssetSchema>;

export const clipartUploadResultSchema = z
  .object({
    uploads: z.array(clipartAssetSchema),
    failures: z.array(
      z
        .object({
          filename: z.string(),
          message: z.string(),
        })
        .strip(),
    ),
  })
  .strip();

export type ClipartUploadResult = z.infer<typeof clipartUploadResultSchema>;
