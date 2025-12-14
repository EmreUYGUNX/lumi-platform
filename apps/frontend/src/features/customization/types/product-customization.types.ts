import { z } from "zod";

export const designAreaSchema = z
  .object({
    name: z.string().trim().min(1).max(64),
    x: z.number().finite(),
    y: z.number().finite(),
    width: z.number().finite(),
    height: z.number().finite(),
    rotation: z.number().finite(),
    minDesignSize: z.number().finite(),
    maxDesignSize: z.number().finite(),
    aspectRatio: z.number().finite().optional(),
    allowResize: z.boolean(),
    allowRotation: z.boolean(),
  })
  .strip();

export const productCustomizationConfigSchema = z
  .object({
    enabled: z.boolean(),
    designAreas: z.array(designAreaSchema).default([]),
    maxLayers: z.number().int().nonnegative(),
    allowImages: z.boolean(),
    allowText: z.boolean(),
    allowShapes: z.boolean(),
    allowDrawing: z.boolean(),
    minImageSize: z.number().int().positive().optional(),
    maxImageSize: z.number().int().positive().optional(),
    allowedFonts: z.array(z.string().trim().min(1)).default([]),
    basePriceModifier: z.number().finite(),
    pricePerLayer: z.number().finite(),
  })
  .strip();

export type DesignAreaDTO = z.infer<typeof designAreaSchema>;
export type ProductCustomizationConfig = z.infer<typeof productCustomizationConfigSchema>;
