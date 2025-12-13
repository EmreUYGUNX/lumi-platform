import { z } from "zod";

import { normaliseTags, tagSchema } from "@/modules/media/media.validators.js";

export { cuidSchema as designIdParamSchema } from "@lumi/shared/dto";

const MAX_TAGS = 25;

const metadataRecordSchema = z.record(
  z
    .union([z.string(), z.number(), z.boolean(), z.null()])
    .transform((value) =>
      value === null ? "" : typeof value === "string" ? value : String(value),
    ),
);

const metadataSchema = z
  .union([
    metadataRecordSchema,
    z
      .string()
      .trim()
      .min(2)
      .transform((value, ctx) => {
        try {
          const parsed = JSON.parse(value);
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Metadata must be an object.",
            });
            return z.NEVER;
          }

          return parsed as Record<string, unknown>;
        } catch {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Metadata must be valid JSON.",
            fatal: true,
          });
          return z.NEVER;
        }
      })
      .pipe(metadataRecordSchema),
  ])
  .optional();

export const designUploadBodySchema = z
  .object({
    tags: z
      .preprocess(normaliseTags, z.array(tagSchema).max(MAX_TAGS))
      .default([])
      .transform((tags) => [...new Set(tags)]),
    uploadedFrom: z.string().trim().max(50).optional(),
    backgroundColor: z.string().trim().max(30).optional(),
    metadata: metadataSchema,
  })
  .strict();

export type DesignUploadBody = z.infer<typeof designUploadBodySchema>;

export const designListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional(),
    perPage: z.coerce.number().int().min(1).max(200).optional(),
    tag: tagSchema.optional(),
    tags: z.preprocess(normaliseTags, z.array(tagSchema).max(MAX_TAGS)).optional(),
    sort: z.enum(["createdAt", "usageCount"]).optional(),
    order: z.enum(["asc", "desc"]).optional(),
  })
  .strict();

export type DesignListQuery = z.infer<typeof designListQuerySchema>;

export const designUpdateBodySchema = z
  .object({
    tags: z
      .preprocess(normaliseTags, z.array(tagSchema).max(MAX_TAGS))
      .optional()
      .transform((tags) => (tags ? [...new Set(tags)] : undefined)),
    isPublic: z.coerce.boolean().optional(),
    metadata: metadataSchema,
  })
  .strict();

export type DesignUpdateBody = z.infer<typeof designUpdateBodySchema>;
