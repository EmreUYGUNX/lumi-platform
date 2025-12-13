import { z } from "zod";

import { cuidSchema, isoDateTimeSchema, paginationMetaSchema, urlSchema } from "@lumi/shared/dto";

export const customerDesignViewSchema = z
  .object({
    id: cuidSchema,
    publicId: z.string().min(1),
    url: urlSchema,
    secureUrl: urlSchema,
    thumbnailUrl: urlSchema,
    format: z.string().min(1),
    width: z.number().int().nullable().optional(),
    height: z.number().int().nullable().optional(),
    bytes: z.number().int(),
    tags: z.array(z.string()),
    userId: cuidSchema,
    isPublic: z.boolean(),
    usageCount: z.number().int(),
    viewCount: z.number().int(),
    metadata: z.record(z.unknown()).optional(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strip();

export type CustomerDesignView = z.infer<typeof customerDesignViewSchema>;

export interface DesignUploadPayload {
  tags?: string[];
  uploadedFrom?: string;
  backgroundColor?: string;
  metadata?: Record<string, string>;
}

export const designListMetaSchema = z
  .object({
    pagination: paginationMetaSchema,
  })
  .strip();

export type DesignListMeta = z.infer<typeof designListMetaSchema>;

export interface DesignListQuery {
  page?: number;
  perPage?: number;
  tag?: string;
  tags?: string[];
  sort?: "createdAt" | "usageCount";
  order?: "asc" | "desc";
}
