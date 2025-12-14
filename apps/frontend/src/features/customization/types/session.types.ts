import { z } from "zod";

import { cuidSchema, isoDateTimeSchema, paginationMetaSchema, urlSchema } from "@lumi/shared/dto";

export const designSessionShareSchema = z
  .object({
    sessionId: cuidSchema,
    shareToken: z.string().min(16),
    shareUrl: z.string().min(1),
    expiresAt: isoDateTimeSchema,
  })
  .strip();

export type DesignSessionShareResult = z.infer<typeof designSessionShareSchema>;

export const designSessionViewSchema = z
  .object({
    id: cuidSchema,
    userId: cuidSchema.nullable().optional(),
    productId: cuidSchema,
    designArea: z.string().min(1),
    sessionData: z.unknown(),
    previewUrl: urlSchema.nullable().optional(),
    thumbnailUrl: urlSchema.nullable().optional(),
    shareToken: z.string().nullable().optional(),
    isPublic: z.boolean(),
    viewCount: z.number().int(),
    lastEditedAt: isoDateTimeSchema,
    expiresAt: isoDateTimeSchema,
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strip();

export type DesignSessionView = z.infer<typeof designSessionViewSchema>;

export const designSessionSummarySchema = z
  .object({
    id: cuidSchema,
    productId: cuidSchema,
    designArea: z.string().min(1),
    previewUrl: urlSchema.nullable().optional(),
    thumbnailUrl: urlSchema.nullable().optional(),
    isPublic: z.boolean(),
    shareToken: z.string().nullable().optional(),
    lastEditedAt: isoDateTimeSchema,
    expiresAt: isoDateTimeSchema,
  })
  .strip();

export type DesignSessionSummaryView = z.infer<typeof designSessionSummarySchema>;

export const sessionListMetaSchema = z
  .object({
    pagination: paginationMetaSchema,
  })
  .strip();

export type SessionListMeta = z.infer<typeof sessionListMetaSchema>;

export interface SessionListQuery {
  page?: number;
  perPage?: number;
  productId?: string;
  order?: "asc" | "desc";
}

export interface SavedDesignMeta {
  name: string;
  tags: string[];
}

const savedLayerPositionSchema = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
    width: z.number().finite(),
    height: z.number().finite(),
    rotation: z.number().finite(),
  })
  .strip();

const savedLayerBaseSchema = z
  .object({
    layerId: z.string().min(1),
    layerType: z.enum(["image", "text", "shape", "clipart", "group"]),
    layerName: z.string().min(1),
    isLocked: z.boolean(),
    isHidden: z.boolean(),
    zIndex: z.number().int(),
    position: savedLayerPositionSchema,
    opacity: z.number().int().optional(),
    customData: z.record(z.unknown()).optional(),
    fabricObject: z.record(z.unknown()),
  })
  .strip();

const savedTextLayerSchema = savedLayerBaseSchema.extend({
  layerType: z.literal("text"),
  text: z.string(),
  fontFamily: z.string().min(1),
  fontSize: z.number().finite(),
  fontWeight: z.union([z.string(), z.number()]).optional(),
  letterSpacing: z.number().finite().optional(),
  color: z.string().optional(),
});

const savedImageLayerSchema = savedLayerBaseSchema.extend({
  layerType: z.literal("image"),
  src: z.string(),
  designId: z.string().optional(),
  publicId: z.string().optional(),
});

const savedClipartLayerSchema = savedLayerBaseSchema.extend({
  layerType: z.literal("clipart"),
  src: z.string(),
  clipartId: z.string().min(1),
});

const savedShapeLayerSchema = savedLayerBaseSchema.extend({
  layerType: z.literal("shape"),
  shape: z.enum(["rect", "circle", "polygon"]),
  fill: z.string().optional(),
  stroke: z.string().optional(),
  strokeWidth: z.number().finite().optional(),
});

const savedGroupLayerSchema = savedLayerBaseSchema.extend({
  layerType: z.literal("group"),
  childLayerIds: z.array(z.string().min(1)),
});

export const savedEditorLayerSchema = z.union([
  savedTextLayerSchema,
  savedImageLayerSchema,
  savedClipartLayerSchema,
  savedShapeLayerSchema,
  savedGroupLayerSchema,
]);

export const savedEditorLayersSchema = z.array(savedEditorLayerSchema).min(1).max(200);

export const savedDesignSessionDataSchema = z
  .object({
    lumiEditor: z
      .object({
        version: z.number().int().min(1).optional(),
        name: z.string().trim().min(1).max(120).optional(),
        tags: z.array(z.string().trim().min(1).max(40)).max(40).optional(),
        editorLayers: savedEditorLayersSchema.optional(),
      })
      .strip()
      .optional(),
  })
  .passthrough();
