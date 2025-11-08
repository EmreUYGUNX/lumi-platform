import { OrderStatus, Prisma, UserStatus } from "@prisma/client";

import {
  categorySummarySchema,
  mediaAssetSchema,
  productMediaSchema,
  productSummarySchema,
  productVariantSchema,
} from "./catalog.dto.js";
import type { CategorySummaryDTO, ProductSummaryDTO } from "./catalog.dto.js";
import {
  addressSchema,
  cartItemSchema,
  cartSummarySchema,
  couponSummarySchema,
  orderCustomerSchema,
  orderDetailSchema,
  orderStatusTimelineEntrySchema,
  orderSummarySchema,
  orderTrackingSummarySchema,
  paymentSummarySchema,
} from "./commerce.dto.js";
import type {
  AddressDTO,
  CartSummaryDTO,
  CouponSummaryDTO,
  OrderDetailDTO,
  OrderSummaryDTO,
  PaymentSummaryDTO,
} from "./commerce.dto.js";
import type {
  AddressEntity,
  CartWithItems,
  CouponEntity,
  OrderWithRelations,
  PaymentEntity,
  ProductCategoryEntity,
  ProductMediaEntity,
  ProductVariantEntity,
  ProductWithRelations,
  UserWithRoleEntities,
} from "./prisma-types.js";
import {
  userDetailSchema,
  userPermissionSchema,
  userRoleSchema,
  userSummarySchema,
} from "./user.dto.js";
import type {
  UserCreateRequestDTO,
  UserDetailDTO,
  UserSummaryDTO,
  UserUpdateRequestDTO,
} from "./user.dto.js";

/* eslint-disable unicorn/no-null */

const DEFAULT_CURRENCY = "TRY";

const normaliseDecimal = (value: Prisma.Decimal | string | number | null | undefined): string => {
  if (value === null || value === undefined) {
    return "0";
  }

  if (value instanceof Prisma.Decimal) {
    return value.toFixed(2);
  }

  const numeric = typeof value === "number" ? value : Number.parseFloat(value);
  if (Number.isNaN(numeric)) {
    return "0";
  }

  return numeric.toFixed(2);
};

const toCurrency = (currency?: string | null): string =>
  currency && currency.trim() ? currency.trim().toUpperCase() : DEFAULT_CURRENCY;

const toMoney = (
  value: Prisma.Decimal | string | number | null | undefined,
  currency?: string | null,
) => ({
  amount: normaliseDecimal(value),
  currency: toCurrency(currency),
});

const toIsoString = (value: Date | string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const toNullableString = (value: string | null | undefined): string | null => {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
};

const buildFullName = (firstName?: string | null, lastName?: string | null): string | null => {
  const parts = [firstName, lastName].map((part) => toNullableString(part)).filter(Boolean);
  return parts.length > 0 ? (parts as string[]).join(" ") : null;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const buildOrderTimeline = (order: OrderWithRelations) => {
  const checkpoints: ({ status: OrderStatus; timestamp: Date } | null)[] = [
    { status: OrderStatus.PENDING, timestamp: order.createdAt },
    order.placedAt ? { status: OrderStatus.PAID, timestamp: order.placedAt } : null,
    order.fulfilledAt ? { status: OrderStatus.FULFILLED, timestamp: order.fulfilledAt } : null,
    order.shippedAt ? { status: OrderStatus.SHIPPED, timestamp: order.shippedAt } : null,
    order.deliveredAt ? { status: OrderStatus.DELIVERED, timestamp: order.deliveredAt } : null,
    order.cancelledAt ? { status: OrderStatus.CANCELLED, timestamp: order.cancelledAt } : null,
  ];

  return checkpoints.filter(Boolean).map((entry) =>
    orderStatusTimelineEntrySchema.parse({
      status: entry!.status,
      timestamp: entry!.timestamp.toISOString(),
    }),
  );
};

const resolveTrackingMetadata = (metadata: unknown): Record<string, unknown> | null => {
  if (!isPlainObject(metadata)) {
    return null;
  }

  const maybeTracking = metadata.tracking ?? metadata.shipment;
  if (isPlainObject(maybeTracking)) {
    return maybeTracking;
  }

  return null;
};

const buildTrackingSummary = (order: OrderWithRelations) => {
  const trackingMetadata = resolveTrackingMetadata(order.metadata ?? null);
  const fallbackEstimatedDelivery =
    order.deliveredAt ?? order.shippedAt ?? order.fulfilledAt ?? null;

  return orderTrackingSummarySchema.parse({
    trackingNumber: toNullableString(
      (trackingMetadata?.trackingNumber as string | null | undefined) ?? null,
    ),
    trackingUrl: toNullableString(
      (trackingMetadata?.trackingUrl as string | null | undefined) ?? null,
    ),
    carrier: toNullableString((trackingMetadata?.carrier as string | null | undefined) ?? null),
    estimatedDelivery:
      toIsoString(
        (trackingMetadata?.estimatedDelivery as string | Date | null | undefined) ?? null,
      ) ?? toIsoString(fallbackEstimatedDelivery),
  });
};

const mapOrderCustomer = (order: OrderWithRelations) => {
  if (!order.user) {
    return null;
  }

  return orderCustomerSchema.parse({
    id: order.user.id,
    email: order.user.email,
    firstName: toNullableString(order.user.firstName),
    lastName: toNullableString(order.user.lastName),
    phone: toNullableString(order.user.phone),
    createdAt: order.user.createdAt.toISOString(),
    updatedAt: order.user.updatedAt.toISOString(),
  });
};

export const mapUserEntityToSummary = (user: UserWithRoleEntities): UserSummaryDTO => {
  const payload = {
    id: user.id,
    email: user.email,
    firstName: toNullableString(user.firstName),
    lastName: toNullableString(user.lastName),
    fullName: buildFullName(user.firstName, user.lastName),
    phone: toNullableString(user.phone),
    status: user.status,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    roles:
      user.roles?.map((assignment) =>
        userRoleSchema.parse({
          id: assignment.role.id,
          name: assignment.role.name,
          description: toNullableString(assignment.role.description),
          createdAt: assignment.role.createdAt.toISOString(),
          updatedAt: assignment.role.updatedAt.toISOString(),
        }),
      ) ?? [],
    permissions:
      user.permissions?.map((assignment) =>
        userPermissionSchema.parse({
          id: assignment.permission.id,
          key: assignment.permission.key,
          description: toNullableString(assignment.permission.description),
          createdAt: assignment.permission.createdAt.toISOString(),
          updatedAt: assignment.permission.updatedAt.toISOString(),
        }),
      ) ?? [],
  };

  return userSummarySchema.parse(payload);
};

export const mapUserEntityToDetail = (user: UserWithRoleEntities): UserDetailDTO => {
  const summary = mapUserEntityToSummary(user);

  return userDetailSchema.parse({
    ...summary,
    emailVerifiedAt: toIsoString(user.emailVerifiedAt),
    lockoutUntil: toIsoString(user.lockoutUntil),
    twoFactorEnabled: user.twoFactorEnabled,
  });
};

export const mapUserCreateRequestToData = (
  payload: UserCreateRequestDTO,
  passwordHash: string,
): Prisma.UserCreateInput => ({
  email: payload.email.trim().toLowerCase(),
  passwordHash,
  firstName: payload.firstName?.trim(),
  lastName: payload.lastName?.trim(),
  phone: payload.phone ?? null,
  status: UserStatus.ACTIVE,
});

export const mapUserUpdateRequestToData = (
  payload: UserUpdateRequestDTO,
): Prisma.UserUpdateInput => {
  const data: Prisma.UserUpdateInput = {};

  if (payload.firstName !== undefined) {
    data.firstName = payload.firstName?.trim() ?? null;
  }
  if (payload.lastName !== undefined) {
    data.lastName = payload.lastName?.trim() ?? null;
  }
  if (payload.phone !== undefined) {
    data.phone = payload.phone ?? null;
  }
  if (payload.status !== undefined) {
    data.status = payload.status;
  }
  if (payload.emailVerified !== undefined) {
    data.emailVerified = payload.emailVerified;
    data.emailVerifiedAt = payload.emailVerified ? new Date() : null;
  }

  return data;
};

const mapCategory = (entry: ProductCategoryEntity): CategorySummaryDTO =>
  categorySummarySchema.parse({
    id: entry.category.id,
    name: entry.category.name,
    slug: entry.category.slug,
    description: toNullableString(entry.category.description),
    parentId: entry.category.parentId ?? null,
    level: entry.category.level,
    path: entry.category.path,
    imageUrl: entry.category.imageUrl ?? null,
    iconUrl: entry.category.iconUrl ?? null,
    displayOrder: entry.category.displayOrder ?? null,
    createdAt: entry.category.createdAt.toISOString(),
    updatedAt: entry.category.updatedAt.toISOString(),
  });

const mapMedia = (entry: ProductMediaEntity) =>
  productMediaSchema.parse({
    productId: entry.productId,
    mediaId: entry.mediaId,
    sortOrder: entry.sortOrder ?? null,
    isPrimary: entry.isPrimary,
    media: mediaAssetSchema.parse({
      id: entry.media.id,
      assetId: entry.media.assetId,
      url: entry.media.url,
      type: entry.media.type,
      provider: entry.media.provider,
      mimeType: entry.media.mimeType,
      sizeBytes: entry.media.sizeBytes,
      width: entry.media.width ?? null,
      height: entry.media.height ?? null,
      alt: toNullableString(entry.media.alt),
      caption: toNullableString(entry.media.caption),
      createdAt: entry.media.createdAt.toISOString(),
      updatedAt: entry.media.updatedAt.toISOString(),
    }),
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  });

const mapVariant = (variant: ProductVariantEntity, currency: string) =>
  productVariantSchema.parse({
    id: variant.id,
    title: variant.title,
    sku: variant.sku,
    price: toMoney(variant.price, currency),
    compareAtPrice: variant.compareAtPrice ? toMoney(variant.compareAtPrice, currency) : undefined,
    stock: variant.stock,
    attributes: variant.attributes ?? null,
    weightGrams: variant.weightGrams ?? null,
    isPrimary: variant.isPrimary,
    createdAt: variant.createdAt.toISOString(),
    updatedAt: variant.updatedAt.toISOString(),
  });

export const mapProductToSummary = (product: ProductWithRelations): ProductSummaryDTO => {
  const currency = product.currency ?? DEFAULT_CURRENCY;

  return productSummarySchema.parse({
    id: product.id,
    title: product.title,
    slug: product.slug,
    sku: product.sku ?? null,
    summary: product.summary ?? null,
    description: product.description ?? null,
    status: product.status,
    price: toMoney(product.price, currency),
    compareAtPrice: product.compareAtPrice ? toMoney(product.compareAtPrice, currency) : undefined,
    currency,
    inventoryPolicy: product.inventoryPolicy,
    searchKeywords: product.searchKeywords ?? [],
    attributes: product.attributes ?? null,
    variants: product.variants.map((variant) => mapVariant(variant, currency)),
    categories: product.categories.map((category) => mapCategory(category)),
    media: product.productMedia.map((media) => mapMedia(media)),
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    deletedAt: toIsoString(product.deletedAt),
  });
};

const aggregateCartTotals = (cart: CartWithItems, currency: string) => {
  let subtotal = new Prisma.Decimal(0);

  cart.items.forEach((item) => {
    const unitPrice =
      item.unitPrice instanceof Prisma.Decimal
        ? item.unitPrice
        : new Prisma.Decimal(item.unitPrice);
    subtotal = subtotal.plus(unitPrice.times(item.quantity));
  });

  return {
    subtotal: toMoney(subtotal, currency),
    tax: toMoney(0, currency),
    discount: toMoney(0, currency),
    total: toMoney(subtotal, currency),
  };
};

export const mapCartToSummary = (cart: CartWithItems, currency?: string): CartSummaryDTO => {
  const resolvedCurrency =
    currency ?? cart.items[0]?.productVariant?.product?.currency ?? DEFAULT_CURRENCY;

  return cartSummarySchema.parse({
    id: cart.id,
    userId: cart.userId ?? null,
    sessionId: cart.sessionId ?? null,
    status: cart.status,
    expiresAt: toIsoString(cart.expiresAt),
    items: cart.items.map((item) =>
      cartItemSchema.parse({
        id: item.id,
        cartId: item.cartId,
        productVariantId: item.productVariantId,
        quantity: item.quantity,
        unitPrice: toMoney(item.unitPrice, resolvedCurrency),
        productVariant: item.productVariant
          ? mapVariant(item.productVariant, resolvedCurrency)
          : undefined,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      }),
    ),
    totals: aggregateCartTotals(cart, resolvedCurrency),
    createdAt: cart.createdAt.toISOString(),
    updatedAt: cart.updatedAt.toISOString(),
  });
};

const mapAddress = (address: AddressEntity | null | undefined): AddressDTO | null => {
  if (!address) {
    return null;
  }

  return addressSchema.parse({
    id: address.id,
    userId: address.userId,
    label: address.label,
    fullName: address.fullName,
    phone: toNullableString(address.phone),
    line1: address.line1,
    line2: address.line2 ?? null,
    city: address.city,
    state: address.state ?? null,
    postalCode: address.postalCode,
    country: address.country,
    isDefault: address.isDefault,
    createdAt: address.createdAt.toISOString(),
    updatedAt: address.updatedAt.toISOString(),
  });
};

const mapOrderItems = (order: OrderWithRelations, currency: string) =>
  order.items.map((item) =>
    orderSummarySchema.shape.items.element.parse({
      id: item.id,
      orderId: item.orderId,
      productId: item.productId,
      productVariantId: item.productVariantId,
      quantity: item.quantity,
      unitPrice: toMoney(item.unitPrice, currency),
      currency: item.currency ?? currency,
      titleSnapshot: item.titleSnapshot,
      variantSnapshot: item.variantSnapshot ?? null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }),
  );

export const mapOrderToSummary = (
  order: OrderWithRelations,
  currency?: string,
): OrderSummaryDTO => {
  const resolvedCurrency = currency ?? order.currency ?? DEFAULT_CURRENCY;

  return orderSummarySchema.parse({
    id: order.id,
    reference: order.reference,
    userId: order.userId ?? null,
    cartId: order.cartId ?? null,
    status: order.status,
    totalAmount: toMoney(order.totalAmount, resolvedCurrency),
    subtotalAmount: toMoney(order.subtotalAmount, resolvedCurrency),
    taxAmount: toMoney(order.taxAmount, resolvedCurrency),
    discountAmount: toMoney(order.discountAmount, resolvedCurrency),
    currency: resolvedCurrency,
    placedAt: toIsoString(order.placedAt),
    fulfilledAt: toIsoString(order.fulfilledAt),
    shippedAt: toIsoString(order.shippedAt),
    deliveredAt: toIsoString(order.deliveredAt),
    cancelledAt: toIsoString(order.cancelledAt),
    notes: toNullableString(order.notes ?? null),
    metadata: order.metadata ?? null,
    items: mapOrderItems(order, resolvedCurrency),
    itemsCount: order.items.length,
    shippingAddressId: order.shippingAddressId ?? null,
    billingAddressId: order.billingAddressId ?? null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  });
};

export const mapPaymentToSummary = (payment: PaymentEntity, currency?: string): PaymentSummaryDTO =>
  paymentSummarySchema.parse({
    id: payment.id,
    orderId: payment.orderId,
    userId: payment.userId ?? null,
    provider: payment.provider,
    status: payment.status,
    transactionId: payment.transactionId,
    conversationId: payment.conversationId ?? null,
    amount: toMoney(payment.amount, currency ?? payment.currency),
    paidPrice: payment.paidPrice
      ? toMoney(payment.paidPrice, currency ?? payment.currency)
      : undefined,
    currency: toCurrency(currency ?? payment.currency),
    installment: payment.installment ?? null,
    paymentChannel: toNullableString(payment.paymentChannel),
    paymentGroup: toNullableString(payment.paymentGroup),
    cardToken: toNullableString(payment.cardToken),
    cardAssociation: toNullableString(payment.cardAssociation),
    cardFamily: toNullableString(payment.cardFamily),
    cardType: toNullableString(payment.cardType),
    cardBankName: toNullableString(payment.cardBankName),
    cardHolderName: toNullableString(payment.cardHolderName),
    binNumber: toNullableString(payment.binNumber),
    lastFourDigits: toNullableString(payment.lastFourDigits),
    ipAddress: toNullableString(payment.ipAddress),
    deviceId: toNullableString(payment.deviceId),
    fraudScore: payment.fraudScore ?? null,
    riskFlags: payment.riskFlags ?? null,
    authorizedAt: toIsoString(payment.authorizedAt),
    settledAt: toIsoString(payment.settledAt),
    failedAt: toIsoString(payment.failedAt),
    failureReason: toNullableString(payment.failureReason),
    failureCode: toNullableString(payment.failureCode),
    rawPayload: payment.rawPayload ?? null,
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
  });

export const mapOrderToDetail = (order: OrderWithRelations): OrderDetailDTO => {
  const summary = mapOrderToSummary(order);

  return orderDetailSchema.parse({
    ...summary,
    customer: mapOrderCustomer(order),
    version: order.version,
    shippingAddress: mapAddress(order.shippingAddress),
    billingAddress: mapAddress(order.billingAddress),
    payments: order.payments?.map((payment) => mapPaymentToSummary(payment)) ?? [],
    timeline: buildOrderTimeline(order),
    tracking: buildTrackingSummary(order),
  });
};

export const mapCouponToSummary = (coupon: CouponEntity, currency?: string): CouponSummaryDTO =>
  couponSummarySchema.parse({
    id: coupon.id,
    code: coupon.code,
    description: toNullableString(coupon.description),
    type: coupon.type,
    value: toMoney(coupon.value, currency),
    minOrderAmount: coupon.minOrderAmount ? toMoney(coupon.minOrderAmount, currency) : undefined,
    maxDiscountAmount: coupon.maxDiscountAmount
      ? toMoney(coupon.maxDiscountAmount, currency)
      : undefined,
    usageLimit: coupon.usageLimit ?? null,
    usageCount: coupon.usageCount,
    startsAt: toIsoString(coupon.startsAt),
    expiresAt: toIsoString(coupon.expiresAt),
    isActive: coupon.isActive,
    createdAt: coupon.createdAt.toISOString(),
    updatedAt: coupon.updatedAt.toISOString(),
  });
