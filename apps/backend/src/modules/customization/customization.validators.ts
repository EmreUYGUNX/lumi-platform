import { z } from "zod";

import { cuidSchema } from "@lumi/shared/dto";

export const designAreaSchema = z
  .object({
    name: z.string().trim().min(1).max(64),
    x: z.coerce.number().finite().min(0),
    y: z.coerce.number().finite().min(0),
    width: z.coerce.number().finite().positive(),
    height: z.coerce.number().finite().positive(),
    rotation: z.coerce.number().finite().min(-360).max(360).default(0),
    minDesignSize: z.coerce.number().finite().positive(),
    maxDesignSize: z.coerce.number().finite().positive(),
    aspectRatio: z.coerce.number().finite().positive().optional(),
    allowResize: z.coerce.boolean().default(true),
    allowRotation: z.coerce.boolean().default(true),
  })
  .strict()
  .superRefine((area, ctx) => {
    if (area.maxDesignSize < area.minDesignSize) {
      ctx.addIssue({
        code: "custom",
        path: ["maxDesignSize"],
        message: "maxDesignSize must be greater than or equal to minDesignSize.",
      });
    }

    if (area.minDesignSize > area.width || area.minDesignSize > area.height) {
      ctx.addIssue({
        code: "custom",
        path: ["minDesignSize"],
        message: "minDesignSize cannot exceed the design area width or height.",
      });
    }
  });

export const designAreasSchema = z.array(designAreaSchema).min(1);

const productCustomizationConfigBaseSchema = z
  .object({
    enabled: z.coerce.boolean().optional(),
    designAreas: designAreasSchema,
    maxLayers: z.coerce.number().int().min(1).max(100).default(10),
    allowImages: z.coerce.boolean().default(true),
    allowText: z.coerce.boolean().default(true),
    allowShapes: z.coerce.boolean().default(false),
    allowDrawing: z.coerce.boolean().default(false),
    minImageSize: z.coerce.number().int().min(1).optional(),
    maxImageSize: z.coerce.number().int().min(1).optional(),
    allowedFonts: z.array(z.string().trim().min(1).max(128)).default([]),
    restrictedWords: z.array(z.string().trim().min(1).max(64)).max(200).default([]),
    basePriceModifier: z.coerce.number().min(0).default(0),
    pricePerLayer: z.coerce.number().min(0).default(0),
  })
  .strict();

const applyImageSizeRefinements = <TSchema extends z.ZodTypeAny>(schema: TSchema) =>
  schema.superRefine((config: z.infer<typeof productCustomizationConfigBaseSchema>, ctx) => {
    if (
      config.minImageSize !== undefined &&
      config.maxImageSize !== undefined &&
      config.maxImageSize < config.minImageSize
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["maxImageSize"],
        message: "maxImageSize must be greater than or equal to minImageSize.",
      });
    }
  });

export const productCustomizationConfigSchema = applyImageSizeRefinements(
  productCustomizationConfigBaseSchema,
);

export const customizationConstraintsSchema = productCustomizationConfigBaseSchema.pick({
  maxLayers: true,
  allowImages: true,
  allowText: true,
  allowShapes: true,
  allowDrawing: true,
  minImageSize: true,
  maxImageSize: true,
  allowedFonts: true,
  restrictedWords: true,
});

export const productCustomizationUpdateSchema = applyImageSizeRefinements(
  productCustomizationConfigBaseSchema.partial().strict(),
);

export const productCustomizationParamsSchema = z.object({
  id: cuidSchema,
});

export type DesignAreaInput = z.infer<typeof designAreaSchema>;
export type ProductCustomizationConfigInput = z.infer<typeof productCustomizationConfigSchema>;
export type ProductCustomizationUpdateInput = z.infer<typeof productCustomizationUpdateSchema>;
