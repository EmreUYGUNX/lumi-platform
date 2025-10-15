import { InventoryPolicy, MediaProvider, MediaType, ProductStatus } from "@prisma/client";
import { z } from "zod";

import {
  auditTimestampsSchema,
  cuidSchema,
  currencyCodeSchema,
  localeStringSchema,
  moneySchema,
  nullableLocaleStringSchema,
  optionalJsonSchema,
  skuSchema,
  slugSchema,
  softDeleteSchema,
  urlSchema,
} from "./base.js";

export const productStatusSchema = z.nativeEnum(ProductStatus);
export const inventoryPolicySchema = z.nativeEnum(InventoryPolicy);
export const mediaTypeSchema = z.nativeEnum(MediaType);
export const mediaProviderSchema = z.nativeEnum(MediaProvider);

export const mediaAssetSchema = z
  .object({
    id: cuidSchema,
    assetId: localeStringSchema.max(120),
    url: urlSchema,
    type: mediaTypeSchema,
    provider: mediaProviderSchema,
    mimeType: localeStringSchema.max(180),
    sizeBytes: z.number().int().nonnegative(),
    width: z.number().int().positive().nullable(),
    height: z.number().int().positive().nullable(),
    alt: nullableLocaleStringSchema,
    caption: nullableLocaleStringSchema,
  })
  .merge(auditTimestampsSchema)
  .strict();

export const categorySummarySchema = z
  .object({
    id: cuidSchema,
    name: localeStringSchema.max(120),
    slug: slugSchema,
    description: nullableLocaleStringSchema,
    parentId: cuidSchema.nullable(),
    level: z.number().int().nonnegative(),
    path: localeStringSchema.max(500),
    imageUrl: urlSchema.nullable(),
    iconUrl: urlSchema.nullable(),
    displayOrder: z.number().int().nullable(),
  })
  .merge(auditTimestampsSchema)
  .strict();

export const productVariantSchema = z
  .object({
    id: cuidSchema,
    title: localeStringSchema.max(180),
    sku: skuSchema,
    price: moneySchema,
    compareAtPrice: moneySchema.optional(),
    stock: z.number().int().nonnegative(),
    attributes: optionalJsonSchema,
    weightGrams: z.number().int().positive().nullable(),
    isPrimary: z.boolean(),
  })
  .merge(auditTimestampsSchema)
  .strict();

export const productMediaSchema = z
  .object({
    productId: cuidSchema,
    mediaId: cuidSchema,
    sortOrder: z.number().int().nullable(),
    isPrimary: z.boolean(),
    media: mediaAssetSchema,
  })
  .merge(auditTimestampsSchema)
  .strict();

export const productSummarySchema = z
  .object({
    id: cuidSchema,
    title: localeStringSchema.max(240),
    slug: slugSchema,
    sku: localeStringSchema.max(64).nullable(),
    summary: nullableLocaleStringSchema,
    description: nullableLocaleStringSchema,
    status: productStatusSchema,
    price: moneySchema,
    compareAtPrice: moneySchema.optional(),
    currency: currencyCodeSchema,
    inventoryPolicy: inventoryPolicySchema,
    searchKeywords: z.array(localeStringSchema.max(120)),
    attributes: optionalJsonSchema,
    variants: z.array(productVariantSchema),
    categories: z.array(categorySummarySchema),
    media: z.array(productMediaSchema),
  })
  .merge(auditTimestampsSchema)
  .merge(softDeleteSchema)
  .strict();

export const productVariantInputSchema = z
  .object({
    title: localeStringSchema.max(180),
    sku: skuSchema.optional(),
    price: moneySchema,
    compareAtPrice: moneySchema.optional(),
    stock: z.number().int().nonnegative().default(0),
    attributes: optionalJsonSchema.optional(),
    weightGrams: z.number().int().positive().nullable().optional(),
    isPrimary: z.boolean().optional(),
  })
  .strict();

export const productCreateRequestSchema = z
  .object({
    title: localeStringSchema.max(240),
    slug: slugSchema,
    summary: nullableLocaleStringSchema.optional(),
    description: nullableLocaleStringSchema.optional(),
    status: productStatusSchema.optional(),
    price: moneySchema,
    compareAtPrice: moneySchema.optional(),
    currency: currencyCodeSchema.optional(),
    inventoryPolicy: inventoryPolicySchema.optional(),
    searchKeywords: z.array(localeStringSchema.max(120)).max(50).optional(),
    attributes: optionalJsonSchema.optional(),
    variants: z.array(productVariantInputSchema).min(1),
    categoryIds: z.array(cuidSchema).min(1),
    media: z
      .array(
        z
          .object({
            mediaId: cuidSchema,
            sortOrder: z.number().int().nullable().optional(),
            isPrimary: z.boolean().optional(),
          })
          .strict(),
      )
      .optional(),
  })
  .strict();

export type MediaAssetDTO = z.infer<typeof mediaAssetSchema>;
export type CategorySummaryDTO = z.infer<typeof categorySummarySchema>;
export type ProductVariantDTO = z.infer<typeof productVariantSchema>;
export type ProductMediaDTO = z.infer<typeof productMediaSchema>;
export type ProductSummaryDTO = z.infer<typeof productSummarySchema>;
export type ProductVariantInputDTO = z.infer<typeof productVariantInputSchema>;
export type ProductCreateRequestDTO = z.infer<typeof productCreateRequestSchema>;

export const isMediaAssetDTO = (value: unknown): value is MediaAssetDTO =>
  mediaAssetSchema.safeParse(value).success;

export const isCategorySummaryDTO = (value: unknown): value is CategorySummaryDTO =>
  categorySummarySchema.safeParse(value).success;

export const isProductVariantDTO = (value: unknown): value is ProductVariantDTO =>
  productVariantSchema.safeParse(value).success;

export const isProductSummaryDTO = (value: unknown): value is ProductSummaryDTO =>
  productSummarySchema.safeParse(value).success;
