import { z } from "zod";

import { cuidSchema, localeStringSchema, paginationRequestSchema } from "@lumi/shared/dto";
import { previewLayersSchema } from "@/modules/preview/preview.validators.js";

export {
  cuidSchema as productionDownloadIdParamSchema,
  cuidSchema as productionOrderIdParamSchema,
} from "@lumi/shared/dto";

export const orderItemDesignDataSchema = z
  .object({
    designArea: z.string().trim().min(1).max(64).optional(),
    layers: previewLayersSchema,
  })
  .strict();

export const productionGenerateBodySchema = z
  .object({
    orderItemId: cuidSchema,
    force: z.boolean().optional(),
  })
  .strict();

export const productionOrderStatusSchema = z.enum(["pending", "ready", "downloaded", "printed"]);

export const productionOrdersListQuerySchema = paginationRequestSchema
  .extend({
    status: productionOrderStatusSchema.optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    search: localeStringSchema.max(64).optional(),
  })
  .strict();

export const productionBatchDownloadBodySchema = z
  .object({
    orderIds: z.array(cuidSchema).min(1).max(50),
  })
  .strict();

export type OrderItemDesignData = z.infer<typeof orderItemDesignDataSchema>;
export type ProductionGenerateBody = z.infer<typeof productionGenerateBodySchema>;
export type ProductionOrdersListQuery = z.infer<typeof productionOrdersListQuerySchema>;
export type ProductionOrderStatus = z.infer<typeof productionOrderStatusSchema>;
export type ProductionBatchDownloadBody = z.infer<typeof productionBatchDownloadBodySchema>;
