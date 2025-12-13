import { z } from "zod";

import { cuidSchema as baseCuidSchema } from "@lumi/shared/dto";
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
    orderItemId: baseCuidSchema,
    force: z.boolean().optional(),
  })
  .strict();

export type OrderItemDesignData = z.infer<typeof orderItemDesignDataSchema>;
export type ProductionGenerateBody = z.infer<typeof productionGenerateBodySchema>;
