/* eslint-disable unicorn/prefer-export-from */
import { z } from "zod";

import {
  categoryCreateRequestSchema,
  categoryUpdateRequestSchema,
  cuidSchema,
  productCreateRequestSchema,
  productFilterSchema as productFilterSchemaBase,
  productUpdateRequestSchema,
  productVariantInputSchema,
  productVariantUpdateSchema as productVariantUpdateSchemaBase,
  slugSchema,
} from "@lumi/shared/dto";

export const productListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional(),
    perPage: z.coerce.number().int().min(1).max(200).optional(),
    categoryId: cuidSchema.optional(),
    categorySlug: slugSchema.optional(),
    refreshCache: z.coerce.boolean().optional(),
    cursor: z.string().optional(),
    take: z.coerce.number().int().min(1).max(100).optional(),
  })
  .passthrough();

export const popularProductsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).optional(),
    refreshCache: z.coerce.boolean().optional(),
  })
  .passthrough();

export const variantQuerySchema = z
  .object({
    inStock: z.coerce.boolean().optional(),
  })
  .strict();

export const categoryTreeQuerySchema = z
  .object({
    depth: z.coerce.number().int().min(1).max(10).optional(),
    refresh: z.coerce.boolean().optional(),
  })
  .strict();

export const productCreateSchema = productCreateRequestSchema;
export const productUpdateSchema = productUpdateRequestSchema;
export const productFilterSchema = productFilterSchemaBase;
export const productVariantCreateSchema = productVariantInputSchema;
export const productVariantUpdateSchema = productVariantUpdateSchemaBase;
export const categoryCreateSchema = categoryCreateRequestSchema;
export const categoryUpdateSchema = categoryUpdateRequestSchema;

export type ProductListQuery = z.infer<typeof productListQuerySchema>;
export type PopularProductsQuery = z.infer<typeof popularProductsQuerySchema>;
export type VariantQuery = z.infer<typeof variantQuerySchema>;
export type CategoryTreeQuery = z.infer<typeof categoryTreeQuerySchema>;
export type ProductFilterInput = z.infer<typeof productFilterSchema>;
