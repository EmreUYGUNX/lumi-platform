import { z } from "zod";

import { cuidSchema } from "@lumi/shared/dto";

const resolutionSchema = z.enum(["draft", "web", "production"]);

const positionSchema = z
  .object({
    x: z.coerce.number().finite().min(0),
    y: z.coerce.number().finite().min(0),
    width: z.coerce.number().finite().positive(),
    height: z.coerce.number().finite().positive(),
    rotation: z.coerce.number().finite().min(-360).max(360).default(0),
  })
  .strict();

const effectsSchema = z
  .object({
    shadow: z
      .object({
        azimuth: z.coerce.number().int().min(0).max(360).optional(),
        elevation: z.coerce.number().int().min(-100).max(100).optional(),
      })
      .strict()
      .optional(),
    outline: z
      .object({
        width: z.coerce.number().int().min(1).max(100),
        color: z
          .string()
          .trim()
          .regex(/^#?[\dA-Fa-f]{6}$/)
          .optional(),
      })
      .strict()
      .optional(),
    blur: z.coerce.number().int().min(0).max(2000).optional(),
    brightness: z.coerce.number().int().min(-100).max(100).optional(),
    contrast: z.coerce.number().int().min(-100).max(100).optional(),
  })
  .strict();

const layerBaseSchema = z
  .object({
    layerId: z.string().trim().min(1).max(64),
    zIndex: z.coerce.number().int().min(0).max(1000).default(0),
    position: positionSchema,
    opacity: z.coerce.number().int().min(0).max(100).optional(),
    effects: effectsSchema.optional(),
  })
  .strict();

const imageLayerSchema = layerBaseSchema
  .extend({
    type: z.literal("image"),
    designId: cuidSchema.optional(),
    publicId: z.string().trim().min(1).max(256).optional(),
  })
  .superRefine((layer, ctx) => {
    if (!layer.designId && !layer.publicId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["designId"],
        message: "Either designId or publicId must be provided for image layers.",
      });
    }
  });

const textLayerSchema = layerBaseSchema.extend({
  type: z.literal("text"),
  text: z.string().trim().min(1).max(300),
  font: z.string().trim().min(1).max(128),
  fontSize: z.coerce.number().finite().min(1).max(512),
  fontWeight: z.union([z.string().trim().min(1).max(32), z.coerce.number().int()]).optional(),
  letterSpacing: z.coerce.number().finite().min(-100).max(100).optional(),
  color: z.string().trim().min(1).max(32).optional(),
});

export const previewLayerSchema = z.union([imageLayerSchema, textLayerSchema]);

export const previewLayersSchema = z.array(previewLayerSchema).min(1).max(200);

export const previewGenerateBodySchema = z
  .object({
    productId: cuidSchema,
    designArea: z.string().trim().min(1).max(64),
    resolution: resolutionSchema.default("web"),
    layers: previewLayersSchema,
  })
  .strict();

export const previewBatchBodySchema = z
  .object({
    previews: z.array(previewGenerateBodySchema).min(1).max(10),
  })
  .strict();

export const previewIdParamSchema = z
  .string()
  .trim()
  .min(1)
  .max(256)
  .transform((value, ctx) => {
    const [productId, designHash, ...rest] = value.split(":");

    if (rest.length > 0 || !productId || !designHash) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Preview id must be in the format {productId}:{designHash}.",
      });
      return z.NEVER;
    }

    const parsedProductId = cuidSchema.safeParse(productId);
    if (!parsedProductId.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Preview id contains an invalid productId.",
      });
      return z.NEVER;
    }

    if (!/^[\da-f]{64}$/i.test(designHash)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Preview id contains an invalid design hash.",
      });
      return z.NEVER;
    }

    return { previewId: value, productId, designHash };
  });

export type PreviewGenerateBody = z.infer<typeof previewGenerateBodySchema>;
export type PreviewBatchBody = z.infer<typeof previewBatchBodySchema>;
export type PreviewLayer = z.infer<typeof previewLayerSchema>;
export type PreviewLayerEffects = z.infer<typeof effectsSchema>;
export type PreviewResolution = z.infer<typeof resolutionSchema>;
