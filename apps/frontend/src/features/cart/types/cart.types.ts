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

export const addCartItemInputSchema = z
  .object({
    productVariantId: cuidSchema,
    quantity: z
      .number()
      .int()
      .min(CART_ITEM_MIN_QUANTITY, "Quantity must be at least 1.")
      .max(CART_ITEM_MAX_QUANTITY, "Quantity limit exceeded."),
  })
  .strict();

export type CartSummaryView = z.infer<typeof cartSummaryViewSchema>;
export type CartStockIssue = z.infer<typeof cartStockIssueSchema>;
export type AddCartItemInput = z.infer<typeof addCartItemInputSchema>;
export type CartItemWithProduct = z.infer<typeof cartItemWithProductSchema>;
export type CartSummaryWithProducts = z.infer<typeof cartSummaryWithProductsSchema>;
