import { z } from "zod";

export const productionOrderStatusSchema = z.enum(["pending", "ready", "downloaded", "printed"]);
export type ProductionOrderStatus = z.infer<typeof productionOrderStatusSchema>;

export const productionPaginationSchema = z
  .object({
    totalItems: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
    page: z.number().int().nonnegative(),
    pageSize: z.number().int().positive(),
    hasNextPage: z.boolean(),
    hasPreviousPage: z.boolean(),
  })
  .strict();

export const productionPaginatedMetaSchema = z
  .object({
    pagination: productionPaginationSchema,
  })
  .strict();

export type ProductionPaginationMeta = z.infer<typeof productionPaginationSchema>;

const moneySchema = z
  .object({
    amount: z.string().trim().min(1),
    currency: z.string().trim().min(1),
  })
  .strict();

export const productionTotalsSchema = z
  .object({
    totalAmount: moneySchema,
    currency: z.string().trim().min(1),
  })
  .strict();

export const productionCustomerSchema = z
  .object({
    userId: z.string().trim().min(1).optional(),
    name: z.string().trim().min(1),
    email: z.string().trim().email().optional(),
  })
  .strict();

export const productionOrderListItemSchema = z
  .object({
    orderId: z.string().trim().min(1),
    orderReference: z.string().trim().min(1),
    orderStatus: z.string().trim().min(1),
    orderDate: z.string().trim().min(1),
    customer: productionCustomerSchema,
    totals: productionTotalsSchema,
    customizationCount: z.number().int().nonnegative(),
    pendingCount: z.number().int().nonnegative(),
    downloadedCount: z.number().int().nonnegative(),
    productionStatus: productionOrderStatusSchema,
  })
  .strict();

export type ProductionOrderListItem = z.infer<typeof productionOrderListItemSchema>;

export const productionDownloadResultSchema = z
  .object({
    customizationId: z.string().trim().min(1),
    downloadUrl: z.string().trim().url(),
    expiresAt: z.string().trim().min(1),
  })
  .strict();

export type ProductionDownloadResult = z.infer<typeof productionDownloadResultSchema>;

export const productionGenerateResultSchema = z
  .object({
    customizationId: z.string().trim().min(1),
    orderId: z.string().trim().min(1),
    orderItemId: z.string().trim().min(1),
    productId: z.string().trim().min(1),
    productName: z.string().trim().min(1),
    designArea: z.string().trim().min(1),
    printMethod: z.string().trim().min(1),
    productionPublicId: z.string().trim().min(1),
    productionFileUrl: z.string().trim().url(),
    downloadUrl: z.string().trim().url(),
    downloadExpiresAt: z.string().trim().min(1),
    generatedAt: z.string().trim().min(1),
    regenerated: z.boolean(),
  })
  .strict();

export type ProductionGenerateResult = z.infer<typeof productionGenerateResultSchema>;

export const productionShippingAddressSchema = z
  .object({
    fullName: z.string().trim().min(1),
    phone: z.string().trim().min(1).nullable(),
    line1: z.string().trim().min(1),
    line2: z.string().trim().min(1).nullable(),
    city: z.string().trim().min(1),
    state: z.string().trim().min(1).nullable(),
    postalCode: z.string().trim().min(1),
    country: z.string().trim().min(1),
  })
  .strict();

export const productionPrintSpecsSchema = z
  .object({
    dpi: z.number().int().positive(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    bleedMm: z.number().finite().nonnegative(),
    safeMm: z.number().finite().nonnegative(),
    bleedPx: z.number().int().nonnegative(),
    safePx: z.number().int().nonnegative(),
  })
  .strict();

export const productionOrderItemSchema = z
  .object({
    customizationId: z.string().trim().min(1),
    orderItemId: z.string().trim().min(1),
    productId: z.string().trim().min(1),
    productName: z.string().trim().min(1),
    productImageUrl: z.string().trim().url().nullable().optional(),
    productVariantId: z.string().trim().min(1).optional(),
    variantTitle: z.string().trim().min(1).nullable().optional(),
    sku: z.string().trim().min(1).nullable().optional(),
    quantity: z.number().int().positive(),
    designArea: z.string().trim().min(1),
    previewUrl: z.string().trim().url().nullable().optional(),
    thumbnailUrl: z.string().trim().url().nullable().optional(),
    designData: z.unknown().optional(),
    layerCount: z.number().int().nonnegative().optional(),
    printMethod: z.string().trim().min(1),
    productionGenerated: z.boolean(),
    productionFileUrl: z.string().trim().url().nullable(),
    productionPublicId: z.string().trim().min(1).nullable(),
    productionDpi: z.number().int().positive(),
    downloadedAt: z.string().trim().min(1).nullable().optional(),
    downloadUrl: z.string().trim().url().optional(),
    downloadExpiresAt: z.string().trim().min(1).optional(),
  })
  .strict();

export type ProductionOrderItem = z.infer<typeof productionOrderItemSchema>;

export const productionOrderManifestEntrySchema = z
  .object({
    productName: z.string().trim().min(1),
    designArea: z.string().trim().min(1),
    productionFile: z.string().trim().min(1).nullable(),
    printMethod: z.string().trim().min(1),
    resolution: z.string().trim().min(1),
    colorProfile: z.string().trim().min(1),
    bleed: z.string().trim().min(1),
    safeArea: z.string().trim().min(1),
  })
  .strict();

export const productionOrderManifestSchema = z
  .object({
    orderId: z.string().trim().min(1),
    orderDate: z.string().trim().min(1),
    customizations: z.array(productionOrderManifestEntrySchema),
  })
  .strict();

export type ProductionOrderManifest = z.infer<typeof productionOrderManifestSchema>;

export const productionOrderDetailSchema = z
  .object({
    orderId: z.string().trim().min(1),
    orderReference: z.string().trim().min(1),
    orderStatus: z.string().trim().min(1),
    orderDate: z.string().trim().min(1),
    customer: productionCustomerSchema,
    totals: productionTotalsSchema,
    shippingAddress: productionShippingAddressSchema.nullable(),
    printSpecs: productionPrintSpecsSchema,
    items: z.array(productionOrderItemSchema),
    batchDownload: z
      .object({
        available: z.boolean(),
        items: z.array(productionDownloadResultSchema),
      })
      .strict(),
    manifest: productionOrderManifestSchema,
  })
  .strict();

export type ProductionOrderDetail = z.infer<typeof productionOrderDetailSchema>;
