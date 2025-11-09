import { OrderStatus, PaymentProvider } from "@prisma/client";
import { z } from "zod";

import {
  cuidSchema,
  localeStringSchema,
  moneySchema,
  nullableLocaleStringSchema,
  orderFilterSchema,
  paginationRequestSchema,
  createOrderRequestSchema as sharedCreateOrderSchema,
} from "@lumi/shared/dto";

export const orderPaymentSchema = z
  .object({
    provider: z.nativeEnum(PaymentProvider),
    transactionId: localeStringSchema.max(120).optional(),
    paymentChannel: nullableLocaleStringSchema.optional(),
    paymentGroup: nullableLocaleStringSchema.optional(),
    cardToken: nullableLocaleStringSchema.optional(),
    idempotencyKey: localeStringSchema.max(120).optional(),
  })
  .strict();

export const createOrderInputSchema = sharedCreateOrderSchema
  .extend({
    payment: orderPaymentSchema.optional(),
  })
  .strict();

export const orderListQuerySchema = paginationRequestSchema
  .extend({
    status: z.array(z.nativeEnum(OrderStatus)).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .strict();

export const adminOrderListQuerySchema = paginationRequestSchema
  .extend({
    filter: orderFilterSchema.optional(),
    userEmail: z.string().email().optional(),
    minTotal: z.coerce.number().min(0).optional(),
    maxTotal: z.coerce.number().min(0).optional(),
    format: z.enum(["json", "csv"]).default("json"),
    includeStats: z.coerce.boolean().optional().default(true),
    exportLimit: z.coerce.number().int().positive().max(5000).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.minTotal !== undefined &&
      value.maxTotal !== undefined &&
      value.minTotal > value.maxTotal
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "minTotal cannot exceed maxTotal.",
        path: ["minTotal", "maxTotal"],
      });
    }
  });

export const orderCancellationSchema = z
  .object({
    reason: nullableLocaleStringSchema.optional(),
  })
  .strict();

export const orderStatusUpdateSchema = z
  .object({
    status: z.nativeEnum(OrderStatus),
    reason: nullableLocaleStringSchema.optional(),
    version: z.number().int().positive().optional(),
    trackingNumber: localeStringSchema.max(120).optional(),
    trackingUrl: z.string().url().optional(),
    carrier: nullableLocaleStringSchema.optional(),
    estimatedDelivery: z.coerce.date().optional(),
  })
  .strict();

export const orderNoteSchema = z
  .object({
    message: localeStringSchema.min(3).max(2000),
  })
  .strict();

export const orderRefundSchema = z
  .object({
    paymentId: cuidSchema.optional(),
    amount: moneySchema.optional(),
    reason: nullableLocaleStringSchema.optional(),
    type: z.enum(["full", "partial"]).default("full"),
  })
  .strict();

export const orderTrackingParamsSchema = z
  .object({
    reference: localeStringSchema.max(64),
  })
  .strict();

export const orderStatsQuerySchema = z
  .object({
    range: z.enum(["7d", "30d", "90d"]).default("30d"),
    status: z.array(z.nativeEnum(OrderStatus)).optional(),
  })
  .strict();

export const createOrderSchema = createOrderInputSchema;
export const updateOrderStatusSchema = orderStatusUpdateSchema;
export const refundOrderSchema = orderRefundSchema;

export type CreateOrderInput = z.infer<typeof createOrderInputSchema>;
export type OrderListQuery = z.infer<typeof orderListQuerySchema>;
export type AdminOrderListQuery = z.infer<typeof adminOrderListQuerySchema>;
export type OrderCancellationInput = z.infer<typeof orderCancellationSchema>;
export type OrderStatusUpdateInput = z.infer<typeof orderStatusUpdateSchema>;
export type OrderNoteInput = z.infer<typeof orderNoteSchema>;
export type OrderRefundInput = z.infer<typeof orderRefundSchema>;
export type OrderTrackingParams = z.infer<typeof orderTrackingParamsSchema>;
export type OrderStatsQuery = z.infer<typeof orderStatsQuerySchema>;
