import { z } from "zod";

import {
  cartItemSchema,
  cartSummarySchema,
  cuidSchema,
  currencyCodeSchema,
  inventoryPolicySchema,
  isoDateTimeSchema,
  localeStringSchema,
  moneySchema,
  productStatusSchema,
  productVariantSchema,
  slugSchema,
} from "@lumi/shared/dto";

const CART_ITEM_MIN_QUANTITY = 1;
const CART_ITEM_MAX_QUANTITY = 10;

export const cartProductBriefSchema = z
  .object({
    id: cuidSchema,
    title: localeStringSchema.max(240),
    slug: slugSchema,
    status: productStatusSchema,
    inventoryPolicy: inventoryPolicySchema,
    price: moneySchema,
    compareAtPrice: moneySchema.optional(),
    currency: currencyCodeSchema,
  })
  .strict();

export const cartItemWithProductSchema = cartItemSchema
  .omit({ productVariant: true })
  .extend({
    product: cartProductBriefSchema,
    variant: productVariantSchema,
    availableStock: z.number().int().nonnegative(),
  })
  .strict();

export const cartSummaryWithProductsSchema = cartSummarySchema
  .omit({ items: true })
  .extend({
    items: z.array(cartItemWithProductSchema),
  })
  .strict();

const cartStockIssueBaseSchema = z.object({
  itemId: cuidSchema,
  variantId: cuidSchema,
  productId: cuidSchema,
  message: localeStringSchema.max(280),
});

const cartStockIssueAvailabilitySchema = cartStockIssueBaseSchema.extend({
  type: z.enum(["variant_unavailable", "product_unavailable"]),
});

const cartStockIssueQuantitySchema = cartStockIssueBaseSchema.extend({
  type: z.enum(["out_of_stock", "low_stock"]),
  requestedQuantity: z.number().int().nonnegative(),
  availableQuantity: z.number().int().nonnegative(),
});

const cartStockIssuePriceSchema = cartStockIssueBaseSchema.extend({
  type: z.literal("price_mismatch"),
  expectedUnitPrice: moneySchema,
  actualUnitPrice: moneySchema,
});

export const cartStockIssueSchema = z.union([
  cartStockIssueAvailabilitySchema,
  cartStockIssueQuantitySchema,
  cartStockIssuePriceSchema,
]);

export const cartStockStatusSchema = z
  .object({
    status: z.enum(["ok", "warning", "error"]),
    issues: z.array(cartStockIssueSchema),
    checkedAt: isoDateTimeSchema,
  })
  .strict();

export const cartDeliveryEstimateSchema = z
  .object({
    status: z.enum(["standard", "delayed", "backorder", "unknown"]),
    minHours: z.number().int().nonnegative().optional(),
    maxHours: z.number().int().nonnegative().optional(),
    estimatedDeliveryDate: isoDateTimeSchema.optional(),
    message: localeStringSchema.max(280),
  })
  .strict();

export const cartSummaryViewSchema = z
  .object({
    cart: cartSummaryWithProductsSchema,
    stock: cartStockStatusSchema,
    delivery: cartDeliveryEstimateSchema,
  })
  .strict();

const previewLayerPositionSchema = z
  .object({
    x: z.number().finite().min(0),
    y: z.number().finite().min(0),
    width: z.number().finite().positive(),
    height: z.number().finite().positive(),
    rotation: z.number().finite().min(-360).max(360).optional(),
  })
  .strict();

const previewLayerEffectsSchema = z
  .object({
    shadow: z
      .object({
        azimuth: z.number().int().min(0).max(360).optional(),
        elevation: z.number().int().min(-100).max(100).optional(),
      })
      .strict()
      .optional(),
    outline: z
      .object({
        width: z.number().int().min(1).max(100),
        color: z
          .string()
          .trim()
          .regex(/^#?[\dA-Fa-f]{6}$/)
          .optional(),
      })
      .strict()
      .optional(),
    blur: z.number().int().min(0).max(2000).optional(),
    brightness: z.number().int().min(-100).max(100).optional(),
    contrast: z.number().int().min(-100).max(100).optional(),
  })
  .strict();

const previewLayerBaseSchema = z
  .object({
    layerId: z.string().trim().min(1).max(64),
    zIndex: z.number().int().min(0).max(1000),
    position: previewLayerPositionSchema,
    opacity: z.number().int().min(0).max(100).optional(),
    effects: previewLayerEffectsSchema.optional(),
  })
  .strict();

const previewImageLayerSchema = previewLayerBaseSchema
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

const previewTextLayerSchema = previewLayerBaseSchema.extend({
  type: z.literal("text"),
  text: z.string().trim().min(1).max(300),
  font: z.string().trim().min(1).max(128),
  fontSize: z.number().finite().min(1).max(512),
  fontWeight: z.union([z.string().trim().min(1).max(32), z.number().int()]).optional(),
  letterSpacing: z.number().finite().min(-100).max(100).optional(),
  color: z.string().trim().min(1).max(32).optional(),
});

export const previewLayerSchema = z.union([previewImageLayerSchema, previewTextLayerSchema]);

export const previewLayersSchema = z.array(previewLayerSchema).min(1).max(200);

export const cartItemCustomizationInputSchema = z
  .object({
    designArea: z.string().trim().min(1).max(64),
    designData: z.record(z.unknown()),
    layers: previewLayersSchema,
    previewUrl: z.string().url().optional(),
    thumbnailUrl: z.string().url().optional(),
  })
  .strict();

export const addCartItemInputSchema = z
  .object({
    productVariantId: cuidSchema,
    quantity: z
      .number()
      .int()
      .min(CART_ITEM_MIN_QUANTITY, "Quantity must be at least 1.")
      .max(CART_ITEM_MAX_QUANTITY, "Quantity limit exceeded."),
    customization: cartItemCustomizationInputSchema.optional(),
  })
  .strict();

export type CartSummaryView = z.infer<typeof cartSummaryViewSchema>;
export type CartStockIssue = z.infer<typeof cartStockIssueSchema>;
export type AddCartItemInput = z.infer<typeof addCartItemInputSchema>;
export type CartItemWithProduct = z.infer<typeof cartItemWithProductSchema>;
export type CartSummaryWithProducts = z.infer<typeof cartSummaryWithProductsSchema>;
export type CartItemCustomizationInput = z.infer<typeof cartItemCustomizationInputSchema>;
