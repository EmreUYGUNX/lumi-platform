/* eslint-disable unicorn/prefer-export-from */
import { z } from "zod";

import {
  categoryCreateRequestSchema,
  categoryUpdateRequestSchema,
  cuidSchema,
  productCreateRequestSchema,
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
export const productVariantCreateSchema = productVariantInputSchema;
export const productVariantUpdateSchema = productVariantUpdateSchemaBase;
export const categoryCreateSchema = categoryCreateRequestSchema;
export const categoryUpdateSchema = categoryUpdateRequestSchema;

export type ProductListQuery = z.infer<typeof productListQuerySchema>;
export type VariantQuery = z.infer<typeof variantQuerySchema>;
export type CategoryTreeQuery = z.infer<typeof categoryTreeQuerySchema>;
