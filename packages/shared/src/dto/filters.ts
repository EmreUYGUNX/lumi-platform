import { OrderStatus, ProductStatus, ReviewStatus } from "@prisma/client";
import { z } from "zod";

import {
  cuidSchema,
  decimalAmountSchema,
  isoDateTimeSchema,
  localeStringSchema,
  nullableLocaleStringSchema,
} from "./base.js";

const ensureMinLteMax = (
  min: string | undefined,
  max: string | undefined,
  message: string,
): true | { message: string } => {
  if (!min || !max) {
    return true;
  }

  const minValue = Number.parseFloat(min);
  const maxValue = Number.parseFloat(max);

  if (Number.isNaN(minValue) || Number.isNaN(maxValue) || minValue <= maxValue) {
    return true;
  }

  return {
    message,
  };
};

export const priceRangeFilterSchema = z
  .object({
    min: decimalAmountSchema.optional(),
    max: decimalAmountSchema.optional(),
  })
  .strict()
  .refine(
    (range) => ensureMinLteMax(range.min, range.max, "Minimum price cannot exceed maximum price."),
    (range) => ({
      message: "Minimum price cannot exceed maximum price.",
      path: range.min && range.max ? ["min", "max"] : [],
    }),
  );

export const dateRangeFilterSchema = z
  .object({
    from: isoDateTimeSchema.optional(),
    to: isoDateTimeSchema.optional(),
  })
  .strict()
  .refine(
    (range) =>
      !range.from || !range.to || new Date(range.from).getTime() <= new Date(range.to).getTime(),
    {
      message: "Start of the range must be before the end.",
      path: ["from", "to"],
    },
  );

const productAttributeValueSchema = z.union([
  localeStringSchema.max(120),
  z.array(localeStringSchema.max(120)).min(1),
]);

export const productAttributeFilterSchema = z
  .record(productAttributeValueSchema)
  .refine((value) => Object.keys(value).length > 0, {
    message: "Attribute filter cannot be empty.",
  });

export const productFilterSchema = z
  .object({
    search: localeStringSchema.max(120).optional(),
    statuses: z.array(z.nativeEnum(ProductStatus)).max(4).optional(),
    categoryIds: z.array(cuidSchema).max(10).optional(),
    collectionIds: z.array(cuidSchema).max(10).optional(),
    primaryCategoryId: cuidSchema.optional(),
    tags: z.array(localeStringSchema.max(120)).max(20).optional(),
    attributes: productAttributeFilterSchema.optional(),
    priceRange: priceRangeFilterSchema.optional(),
    includeDeleted: z.boolean().optional(),
    inventoryAvailability: z.enum(["in_stock", "low_stock", "out_of_stock"]).optional(),
    sort: z
      .enum([
        "relevance",
        "newest",
        "oldest",
        "price_asc",
        "price_desc",
        "title_asc",
        "title_desc",
        "rating",
      ])
      .optional(),
    cursor: z.string().optional(),
    take: z.coerce.number().int().positive().max(100).optional(),
  })
  .strict();

export const reviewFilterSchema = z
  .object({
    status: z.nativeEnum(ReviewStatus).optional(),
    ratings: z.array(z.number().int().min(1).max(5)).optional(),
    productId: cuidSchema.optional(),
    userId: cuidSchema.optional(),
    search: nullableLocaleStringSchema.optional(),
    createdAt: dateRangeFilterSchema.optional(),
  })
  .strict();

export const orderFilterSchema = z
  .object({
    status: z.array(z.nativeEnum(OrderStatus)).optional(),
    userId: cuidSchema.optional(),
    reference: localeStringSchema.max(50).optional(),
    createdAt: dateRangeFilterSchema.optional(),
    updatedAt: dateRangeFilterSchema.optional(),
    totalAmount: priceRangeFilterSchema.optional(),
  })
  .strict();

export type PriceRangeFilter = z.infer<typeof priceRangeFilterSchema>;
export type DateRangeFilter = z.infer<typeof dateRangeFilterSchema>;
export type ProductAttributeFilter = z.infer<typeof productAttributeFilterSchema>;
export type ProductFilter = z.infer<typeof productFilterSchema>;
export type ReviewFilter = z.infer<typeof reviewFilterSchema>;
export type OrderFilter = z.infer<typeof orderFilterSchema>;

export const isPriceRangeFilter = (value: unknown): value is PriceRangeFilter =>
  priceRangeFilterSchema.safeParse(value).success;

export const isDateRangeFilter = (value: unknown): value is DateRangeFilter =>
  dateRangeFilterSchema.safeParse(value).success;

export const isProductFilter = (value: unknown): value is ProductFilter =>
  productFilterSchema.safeParse(value).success;

export const isReviewFilter = (value: unknown): value is ReviewFilter =>
  reviewFilterSchema.safeParse(value).success;

export const isOrderFilter = (value: unknown): value is OrderFilter =>
  orderFilterSchema.safeParse(value).success;
