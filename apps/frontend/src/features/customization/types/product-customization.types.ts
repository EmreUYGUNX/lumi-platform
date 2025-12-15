import { z } from "zod";

const designAreaBaseSchema = z
  .object({
    name: z.string().trim().min(1).max(64),
    x: z.number().finite().min(0),
    y: z.number().finite().min(0),
    width: z.number().finite().positive(),
    height: z.number().finite().positive(),
    rotation: z.number().finite().min(-360).max(360),
    minDesignSize: z.number().finite().positive(),
    maxDesignSize: z.number().finite().positive(),
    aspectRatio: z.number().finite().positive().optional(),
    allowResize: z.boolean(),
    allowRotation: z.boolean(),
  })
  .strip();

export const designAreaSchema = designAreaBaseSchema.superRefine((area, ctx) => {
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

const productCustomizationConfigBaseSchema = z
  .object({
    enabled: z.boolean(),
    designAreas: z.array(designAreaSchema).min(1).default([]),
    maxLayers: z.number().int().min(1).max(100),
    allowImages: z.boolean(),
    allowText: z.boolean(),
    allowShapes: z.boolean(),
    allowDrawing: z.boolean(),
    minImageSize: z.number().int().min(1).optional(),
    maxImageSize: z.number().int().min(1).optional(),
    allowedFonts: z.array(z.string().trim().min(1).max(128)).default([]),
    restrictedWords: z.array(z.string().trim().min(1).max(64)).max(200).default([]),
    basePriceModifier: z.number().finite().min(0),
    pricePerLayer: z.number().finite().min(0),
  })
  .strip();

export const productCustomizationConfigSchema = productCustomizationConfigBaseSchema.superRefine(
  (config, ctx) => {
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
  },
);

export type DesignAreaDTO = z.infer<typeof designAreaSchema>;
export type ProductCustomizationConfig = z.infer<typeof productCustomizationConfigSchema>;
