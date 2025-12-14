import {
  CartStatus,
  CouponType,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  ReviewStatus,
} from "@prisma/client";
import { z } from "zod";

import {
  auditTimestampsSchema,
  cuidSchema,
  currencyCodeSchema,
  emailSchema,
  isoDateTimeSchema,
  localeStringSchema,
  moneySchema,
  nullableLocaleStringSchema,
  optionalJsonSchema,
  phoneNumberSchema,
  urlSchema,
} from "./base.js";
import { mediaAssetSchema, productVariantSchema } from "./catalog.dto.js";

export const cartStatusSchema = z.nativeEnum(CartStatus);
export const orderStatusSchema = z.nativeEnum(OrderStatus);
export const paymentStatusSchema = z.nativeEnum(PaymentStatus);
export const paymentProviderSchema = z.nativeEnum(PaymentProvider);
export const reviewStatusSchema = z.nativeEnum(ReviewStatus);
export const couponTypeSchema = z.nativeEnum(CouponType);

export const addressSchema = z
  .object({
    id: cuidSchema,
    userId: cuidSchema,
    label: localeStringSchema.max(120),
    fullName: localeStringSchema.max(180),
    phone: phoneNumberSchema.nullable(),
    line1: localeStringSchema.max(240),
    line2: nullableLocaleStringSchema,
    city: localeStringSchema.max(120),
    state: nullableLocaleStringSchema,
    postalCode: localeStringSchema.max(20),
    country: localeStringSchema.max(2),
    isDefault: z.boolean(),
  })
  .merge(auditTimestampsSchema)
  .strict();

export const cartItemCustomizationSchema = z
  .object({
    id: cuidSchema,
    cartItemId: cuidSchema,
    productId: cuidSchema,
    designArea: localeStringSchema.max(64),
    designData: z.unknown(),
    previewUrl: urlSchema.nullable().optional(),
    thumbnailUrl: urlSchema.nullable().optional(),
    layerCount: z.number().int().nonnegative().default(0),
    hasImages: z.boolean().default(false),
    hasText: z.boolean().default(false),
  })
  .merge(auditTimestampsSchema)
  .strict();

export const cartItemSchema = z
  .object({
    id: cuidSchema,
    cartId: cuidSchema,
    productVariantId: cuidSchema,
    quantity: z.number().int().positive(),
    unitPrice: moneySchema,
    productVariant: productVariantSchema.optional(),
    customization: cartItemCustomizationSchema.optional(),
  })
  .merge(auditTimestampsSchema)
  .strict();

export const cartSummarySchema = z
  .object({
    id: cuidSchema,
    userId: cuidSchema.nullable(),
    sessionId: localeStringSchema.max(120).nullable(),
    status: cartStatusSchema,
    expiresAt: isoDateTimeSchema.nullable(),
    items: z.array(cartItemSchema),
    totals: z
      .object({
        subtotal: moneySchema,
        tax: moneySchema,
        discount: moneySchema,
        total: moneySchema,
      })
      .strict(),
  })
  .merge(auditTimestampsSchema)
  .strict();

export const orderCustomerSchema = z
  .object({
    id: cuidSchema,
    email: emailSchema,
    firstName: nullableLocaleStringSchema,
    lastName: nullableLocaleStringSchema,
    phone: nullableLocaleStringSchema,
  })
  .merge(auditTimestampsSchema)
  .strict();

export const cartUpsertItemSchema = z
  .object({
    productVariantId: cuidSchema,
    quantity: z.number().int().positive().max(20),
  })
  .strict();

export const orderItemSchema = z
  .object({
    id: cuidSchema,
    orderId: cuidSchema,
    productId: cuidSchema,
    productVariantId: cuidSchema,
    quantity: z.number().int().positive(),
    unitPrice: moneySchema,
    currency: currencyCodeSchema,
    titleSnapshot: localeStringSchema.max(240),
    variantSnapshot: optionalJsonSchema,
  })
  .merge(auditTimestampsSchema)
  .strict();

export const orderSummarySchema = z
  .object({
    id: cuidSchema,
    reference: localeStringSchema.max(64),
    userId: cuidSchema.nullable(),
    cartId: cuidSchema.nullable(),
    status: orderStatusSchema,
    totalAmount: moneySchema,
    subtotalAmount: moneySchema,
    taxAmount: moneySchema,
    discountAmount: moneySchema,
    currency: currencyCodeSchema,
    placedAt: isoDateTimeSchema.nullable(),
    fulfilledAt: isoDateTimeSchema.nullable(),
    shippedAt: isoDateTimeSchema.nullable(),
    deliveredAt: isoDateTimeSchema.nullable(),
    cancelledAt: isoDateTimeSchema.nullable(),
    notes: nullableLocaleStringSchema,
    metadata: optionalJsonSchema,
    items: z.array(orderItemSchema),
    itemsCount: z.number().int().nonnegative(),
    shippingAddressId: cuidSchema.nullable(),
    billingAddressId: cuidSchema.nullable(),
  })
  .merge(auditTimestampsSchema)
  .strict();

export const orderStatusTimelineEntrySchema = z
  .object({
    status: orderStatusSchema,
    timestamp: isoDateTimeSchema,
  })
  .strict();

export const orderTrackingSummarySchema = z
  .object({
    trackingNumber: nullableLocaleStringSchema,
    trackingUrl: nullableLocaleStringSchema,
    carrier: nullableLocaleStringSchema,
    estimatedDelivery: isoDateTimeSchema.nullable(),
  })
  .strict();

export const paymentSummarySchema = z
  .object({
    id: cuidSchema,
    orderId: cuidSchema,
    userId: cuidSchema.nullable(),
    provider: paymentProviderSchema,
    status: paymentStatusSchema,
    transactionId: localeStringSchema.max(120),
    conversationId: localeStringSchema.max(120).nullable(),
    amount: moneySchema,
    paidPrice: moneySchema.optional(),
    currency: currencyCodeSchema,
    installment: z.number().int().positive().nullable(),
    paymentChannel: nullableLocaleStringSchema,
    paymentGroup: nullableLocaleStringSchema,
    cardToken: nullableLocaleStringSchema,
    cardAssociation: nullableLocaleStringSchema,
    cardFamily: nullableLocaleStringSchema,
    cardType: nullableLocaleStringSchema,
    cardBankName: nullableLocaleStringSchema,
    cardHolderName: nullableLocaleStringSchema,
    binNumber: nullableLocaleStringSchema,
    lastFourDigits: nullableLocaleStringSchema,
    ipAddress: nullableLocaleStringSchema,
    deviceId: nullableLocaleStringSchema,
    fraudScore: z.number().min(0).nullable(),
    riskFlags: optionalJsonSchema,
    authorizedAt: isoDateTimeSchema.nullable(),
    settledAt: isoDateTimeSchema.nullable(),
    failedAt: isoDateTimeSchema.nullable(),
    failureReason: nullableLocaleStringSchema,
    failureCode: nullableLocaleStringSchema,
    rawPayload: optionalJsonSchema,
  })
  .merge(auditTimestampsSchema)
  .strict();

export const orderDetailSchema = orderSummarySchema.extend({
  shippingAddress: addressSchema.nullable(),
  billingAddress: addressSchema.nullable(),
  customer: orderCustomerSchema.nullable(),
  payments: z.array(paymentSummarySchema).default([]),
  timeline: z.array(orderStatusTimelineEntrySchema),
  tracking: orderTrackingSummarySchema,
  version: z.number().int().positive(),
});

export const reviewSummarySchema = z
  .object({
    id: cuidSchema,
    productId: cuidSchema,
    userId: cuidSchema,
    orderId: cuidSchema.nullable(),
    rating: z.number().int().min(1).max(5),
    title: localeStringSchema.max(180),
    content: nullableLocaleStringSchema,
    isVerifiedPurchase: z.boolean(),
    status: reviewStatusSchema,
    helpfulCount: z.number().int().nonnegative(),
    notHelpfulCount: z.number().int().nonnegative(),
    media: z.array(mediaAssetSchema),
  })
  .merge(auditTimestampsSchema)
  .strict();

export const couponSummarySchema = z
  .object({
    id: cuidSchema,
    code: localeStringSchema.max(64),
    description: nullableLocaleStringSchema,
    type: couponTypeSchema,
    value: moneySchema,
    minOrderAmount: moneySchema.optional(),
    maxDiscountAmount: moneySchema.optional(),
    usageLimit: z.number().int().positive().nullable(),
    usageCount: z.number().int().nonnegative(),
    startsAt: isoDateTimeSchema.nullable(),
    expiresAt: isoDateTimeSchema.nullable(),
    isActive: z.boolean(),
  })
  .merge(auditTimestampsSchema)
  .strict();

export const applyCouponRequestSchema = z
  .object({
    code: localeStringSchema.max(64),
    cartId: cuidSchema.optional(),
  })
  .strict();

export const createOrderRequestSchema = z
  .object({
    cartId: cuidSchema.optional(),
    userId: cuidSchema.optional(),
    notes: nullableLocaleStringSchema.optional(),
    metadata: optionalJsonSchema.optional(),
    shippingAddressId: cuidSchema.optional(),
    billingAddressId: cuidSchema.optional(),
    couponCode: localeStringSchema.max(64).optional(),
  })
  .strict();

export type AddressDTO = z.infer<typeof addressSchema>;
export type CartItemCustomizationDTO = z.infer<typeof cartItemCustomizationSchema>;
export type CartItemDTO = z.infer<typeof cartItemSchema>;
export type CartSummaryDTO = z.infer<typeof cartSummarySchema>;
export type CartUpsertItemDTO = z.infer<typeof cartUpsertItemSchema>;
export type OrderItemDTO = z.infer<typeof orderItemSchema>;
export type OrderSummaryDTO = z.infer<typeof orderSummarySchema>;
export type OrderDetailDTO = z.infer<typeof orderDetailSchema>;
export type OrderCustomerSummaryDTO = z.infer<typeof orderCustomerSchema>;
export type OrderStatusTimelineEntryDTO = z.infer<typeof orderStatusTimelineEntrySchema>;
export type OrderTrackingSummaryDTO = z.infer<typeof orderTrackingSummarySchema>;
export type PaymentSummaryDTO = z.infer<typeof paymentSummarySchema>;
export type ReviewSummaryDTO = z.infer<typeof reviewSummarySchema>;
export type CouponSummaryDTO = z.infer<typeof couponSummarySchema>;
export type ApplyCouponRequestDTO = z.infer<typeof applyCouponRequestSchema>;
export type CreateOrderRequestDTO = z.infer<typeof createOrderRequestSchema>;

export const isAddressDTO = (value: unknown): value is AddressDTO =>
  addressSchema.safeParse(value).success;

export const isCartItemDTO = (value: unknown): value is CartItemDTO =>
  cartItemSchema.safeParse(value).success;

export const isOrderSummaryDTO = (value: unknown): value is OrderSummaryDTO =>
  orderSummarySchema.safeParse(value).success;

export const isCartSummaryDTO = (value: unknown): value is CartSummaryDTO =>
  cartSummarySchema.safeParse(value).success;

export const isOrderDetailDTO = (value: unknown): value is OrderDetailDTO =>
  orderDetailSchema.safeParse(value).success;

export const isPaymentSummaryDTO = (value: unknown): value is PaymentSummaryDTO =>
  paymentSummarySchema.safeParse(value).success;

export const isReviewSummaryDTO = (value: unknown): value is ReviewSummaryDTO =>
  reviewSummarySchema.safeParse(value).success;

export const isCouponSummaryDTO = (value: unknown): value is CouponSummaryDTO =>
  couponSummarySchema.safeParse(value).success;
