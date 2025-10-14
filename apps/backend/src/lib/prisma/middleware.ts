import { AsyncLocalStorage } from "node:async_hooks";

import { Prisma, type PrismaClient } from "@prisma/client";

/* eslint-disable security/detect-object-injection, sonarjs/cognitive-complexity, unicorn/no-null, no-await-in-loop, no-restricted-syntax, no-param-reassign, unicorn/consistent-function-scoping -- Prisma middleware instrumentation requires controlled dynamic access and imperative flows. */
import { ConflictError, ValidationError } from "../errors.js";
import { getRequestContext, logger } from "../logger.js";
import { registerPrismaExtension } from "../prisma.js";

type Middleware = Prisma.Middleware;
type MiddlewareParams = Prisma.MiddlewareParams;

const INTERNAL_CONTEXT = new AsyncLocalStorage<{ skipGuards?: boolean }>();

const AUDIT_EXCLUDED_MODELS = new Set<string>(["AuditLog"]);

const SOFT_DELETE_MODELS: Record<string, string> = {
  Product: "deletedAt",
};

const VERSIONED_MODELS: Record<string, string> = {
  Order: "version",
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/iu;

const SENSITIVE_FIELDS = new Set([
  "password",
  "passwordHash",
  "refreshToken",
  "refreshTokenHash",
  "twoFactorSecret",
  "cardToken",
  "cardHolderName",
  "cardNumber",
  "binNumber",
]);

const NON_NEGATIVE_FIELDS: Record<string, string[]> = {
  Product: ["price", "compareAtPrice"],
  ProductVariant: ["price", "compareAtPrice", "stock"],
  Inventory: ["quantityAvailable", "quantityReserved", "quantityOnHand", "lowStockThreshold"],
  CartItem: ["quantity", "unitPrice"],
  OrderItem: ["quantity", "unitPrice"],
  Order: ["totalAmount", "subtotalAmount", "taxAmount", "discountAmount"],
  Payment: ["amount", "paidPrice"],
  PaymentRefund: ["amount"],
  Coupon: ["value", "minOrderAmount", "maxDiscountAmount"],
  CouponUsage: ["discountAmount"],
};

const RATING_CONSTRAINTS: Record<string, { field: string; min: number; max: number }[]> = {
  Review: [{ field: "rating", min: 1, max: 5 }],
};

const FOREIGN_KEY_VALIDATIONS: Record<
  string,
  { field: string; target: string; optional?: boolean }[]
> = {
  ProductVariant: [{ field: "productId", target: "Product" }],
  Inventory: [{ field: "productVariantId", target: "ProductVariant" }],
  CartItem: [
    { field: "cartId", target: "Cart" },
    { field: "productVariantId", target: "ProductVariant" },
  ],
  OrderItem: [
    { field: "orderId", target: "Order" },
    { field: "productId", target: "Product" },
    { field: "productVariantId", target: "ProductVariant" },
  ],
  Payment: [
    { field: "orderId", target: "Order" },
    { field: "userId", target: "User", optional: true },
  ],
  Review: [
    { field: "productId", target: "Product" },
    { field: "userId", target: "User" },
    { field: "orderId", target: "Order", optional: true },
  ],
  CouponUsage: [
    { field: "couponId", target: "Coupon" },
    { field: "userId", target: "User" },
    { field: "orderId", target: "Order" },
  ],
  Address: [{ field: "userId", target: "User" }],
  SavedCard: [{ field: "userId", target: "User" }],
  PaymentRefund: [{ field: "paymentId", target: "Payment" }],
};

const EXPIRY_MODELS = new Set(["UserSession", "Cart", "Coupon"]);

const CART_ITEM_DUPLICATE_ERROR = "Cart already contains this product variant.";
const PRODUCT_VARIANT_PRIMARY_FIELD = "ProductVariant.isPrimary";
const PRIMARY_VARIANT_EXISTS_ERROR = "Another primary variant already exists for this product.";
const PRIMARY_VARIANT_REQUIRED_ERROR =
  "Each product must have exactly one primary variant. Assign another primary variant before demoting this one.";
const PRIMARY_VARIANT_REMOVE_ERROR =
  "Each product must have exactly one primary variant. Assign another primary variant before removing this one.";
const PAYMENT_AMOUNT_MISMATCH_ERROR = "Payment amount must match the order total.";
const REVIEW_DUPLICATE_ERROR = "User has already submitted a review for this product.";
const COUPON_USAGE_LIMIT_ERROR = "Coupon usage limit has been reached.";

const NORMALISED_ACTIONS: Record<string, string> = {
  create: "create",
  createMany: "createMany",
  update: "update",
  updateMany: "updateMany",
  delete: "delete",
  deleteMany: "deleteMany",
  upsert: "upsert",
};

const MUTATING_ACTIONS = new Set(Object.keys(NORMALISED_ACTIONS));

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

interface PrismaDelegate {
  findUnique?: (args: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  findFirst?: (args: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  count?: (args: Record<string, unknown>) => Promise<number>;
  create?: (args: Record<string, unknown>) => Promise<unknown>;
  update?: (args: Record<string, unknown>) => Promise<unknown>;
  updateMany?: (args: Record<string, unknown>) => Promise<unknown>;
}

const toCamelCase = (model?: string): string | undefined => {
  if (!model) {
    return undefined;
  }

  return model.charAt(0).toLowerCase() + model.slice(1);
};

const getDelegate = (client: PrismaClient, model: string): PrismaDelegate | null => {
  const key = toCamelCase(model);
  if (!key) {
    return null;
  }

  const delegates = client as unknown as Record<string, PrismaDelegate>;
  return delegates[key] ?? null;
};

const runWithoutGuards = async <T>(callback: () => Promise<T>): Promise<T> =>
  INTERNAL_CONTEXT.run({ skipGuards: true }, callback);

const shouldSkipGuards = (): boolean => Boolean(INTERNAL_CONTEXT.getStore()?.skipGuards);

const normaliseDecimal = (value: unknown): Prisma.Decimal | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (value instanceof Prisma.Decimal) {
    return value;
  }

  if (typeof value === "number") {
    return new Prisma.Decimal(value);
  }

  if (typeof value === "string" && value.trim()) {
    return new Prisma.Decimal(value);
  }

  return undefined;
};

const resolveNumericUpdate = (
  existing: Prisma.Decimal | undefined,
  update: unknown,
): Prisma.Decimal | undefined => {
  if (update === undefined || update === null) {
    return existing;
  }

  if (
    update instanceof Prisma.Decimal ||
    typeof update === "number" ||
    typeof update === "string"
  ) {
    return normaliseDecimal(update);
  }

  if (isObject(update)) {
    if ("set" in update) {
      return normaliseDecimal(update.set);
    }

    if (existing) {
      if ("increment" in update) {
        const increment = normaliseDecimal(update.increment);
        return increment ? existing.add(increment) : existing;
      }
      if ("decrement" in update) {
        const decrement = normaliseDecimal(update.decrement);
        return decrement ? existing.sub(decrement) : existing;
      }
    }
  }

  return existing;
};

const maskSensitiveData = (payload: unknown): unknown => {
  if (!isObject(payload)) {
    return payload;
  }

  const result: Record<string, unknown> = {};
  Object.entries(payload).forEach(([key, value]) => {
    if (SENSITIVE_FIELDS.has(key)) {
      result[key] = "[REDACTED]";
      return;
    }

    if (Array.isArray(value)) {
      result[key] = value.map((entry) => maskSensitiveData(entry));
      return;
    }

    if (isObject(value)) {
      result[key] = maskSensitiveData(value);
      return;
    }

    result[key] = value;
  });

  return result;
};

const createValidationError = (path: string, message: string) =>
  new ValidationError("Database validation failed.", {
    issues: [
      {
        path,
        message,
      },
    ],
  });

const createSoftDeleteMiddleware = (): Middleware => async (params, next) => {
  if (!params.model || !MUTATING_ACTIONS.has(params.action) || shouldSkipGuards()) {
    return next(params);
  }

  const field = SOFT_DELETE_MODELS[params.model];
  if (!field) {
    return next(params);
  }

  if (params.action === "delete") {
    return next({
      ...params,
      action: "update",
      args: {
        where: params.args.where,
        data: {
          [field]: new Date(),
        },
      },
    });
  }

  if (params.action === "deleteMany") {
    return next({
      ...params,
      action: "updateMany",
      args: {
        where: params.args.where,
        data: {
          [field]: new Date(),
        },
      },
    });
  }

  return next(params);
};

const createTimestampValidationMiddleware = (): Middleware => async (params, next) => {
  if (!params.model || !MUTATING_ACTIONS.has(params.action) || shouldSkipGuards()) {
    return next(params);
  }

  const data = params.args?.data;
  if (!isObject(data)) {
    return next(params);
  }

  if ("createdAt" in data && params.action !== "create") {
    throw createValidationError("createdAt", "createdAt is immutable once persisted.");
  }

  if ("updatedAt" in data) {
    throw createValidationError(
      "updatedAt",
      "updatedAt is managed automatically and cannot be set manually.",
    );
  }

  return next(params);
};

const createVersioningMiddleware = (): Middleware => async (params, next) => {
  if (!params.model || shouldSkipGuards()) {
    return next(params);
  }

  const versionField = VERSIONED_MODELS[params.model];
  if (!versionField) {
    return next(params);
  }

  if (
    (params.action === "update" || params.action === "updateMany" || params.action === "upsert") &&
    isObject(params.args?.data)
  ) {
    const data = params.args.data as Record<string, unknown>;
    if (versionField in data) {
      const value = data[versionField];
      if (!isObject(value) || (!("increment" in value) && !("set" in value))) {
        throw createValidationError(
          versionField,
          "Versioned updates must use { increment: 1 } semantics. Direct assignment is not allowed.",
        );
      }
      if ("set" in value) {
        throw createValidationError(
          versionField,
          "Version field cannot be set manually. Use { increment: 1 } for optimistic locking.",
        );
      }
    } else {
      data[versionField] = { increment: 1 };
    }
  }

  return next(params);
};

const ensureEmailValidity = (model: string, data: Record<string, unknown>) => {
  if ("email" in data && typeof data.email === "string") {
    const email = data.email.trim();
    if (!EMAIL_REGEX.test(email)) {
      throw createValidationError(`${model}.email`, "Email format is invalid.");
    }
    data.email = email.toLowerCase();
  }
};

const ensureNonNegativeValues = (
  model: string,
  data: Record<string, unknown>,
  existing?: Record<string, unknown> | null,
) => {
  const fields = NON_NEGATIVE_FIELDS[model];
  if (!fields) {
    return;
  }

  fields.forEach((field) => {
    if (!(field in data)) {
      return;
    }

    const existingDecimal =
      existing && field in existing ? normaliseDecimal(existing[field]) : new Prisma.Decimal(0);
    const finalValue = resolveNumericUpdate(existingDecimal ?? undefined, data[field]);

    if (finalValue && finalValue.lt(0)) {
      throw createValidationError(`${model}.${field}`, `${field} cannot be negative.`);
    }
  });
};

const ensureRatingConstraints = (model: string, data: Record<string, unknown>) => {
  const definitions = RATING_CONSTRAINTS[model];
  if (!definitions) {
    return;
  }

  definitions.forEach(({ field, min, max }) => {
    if (!(field in data)) {
      return;
    }

    const value = data[field];
    if (typeof value !== "number") {
      throw createValidationError(`${model}.${field}`, "Rating must be a numeric value.");
    }

    if (value < min || value > max) {
      throw createValidationError(`${model}.${field}`, `Rating must be between ${min} and ${max}.`);
    }
  });
};

const ensureExpiryAfterCreation = (
  model: string,
  data: Record<string, unknown>,
  existing?: Record<string, unknown> | null,
) => {
  if (!EXPIRY_MODELS.has(model) || !("expiresAt" in data)) {
    return;
  }

  const expiresAtValue = data.expiresAt;
  if (!(expiresAtValue instanceof Date)) {
    throw createValidationError(`${model}.expiresAt`, "expiresAt must be a valid Date instance.");
  }

  const createdAt =
    (existing?.createdAt instanceof Date ? existing.createdAt : undefined) ??
    (data.createdAt instanceof Date ? data.createdAt : new Date());

  if (expiresAtValue.getTime() <= createdAt.getTime()) {
    throw createValidationError(`${model}.expiresAt`, "expiresAt must be later than createdAt.");
  }
};

const extractForeignKeyValue = (value: unknown): string | null | undefined => {
  if (typeof value === "string") {
    return value;
  }

  if (value === null) {
    // eslint-disable-next-line unicorn/no-null -- Distinguish explicit null assignment for relational fields
    return null;
  }

  if (isObject(value)) {
    if ("set" in value) {
      return extractForeignKeyValue(value.set);
    }

    if ("connect" in value && isObject(value.connect)) {
      const connect = value.connect as Record<string, unknown>;
      if (typeof connect.id === "string") {
        return connect.id;
      }
    }
  }

  return undefined;
};

const fetchSingleRecord = async (
  client: PrismaClient,
  model: string,
  where: Record<string, unknown>,
) => {
  const delegate = getDelegate(client, model);
  if (!delegate?.findUnique) {
    // eslint-disable-next-line unicorn/no-null -- Delegate absent indicates unsupported model
    return null;
  }

  return delegate.findUnique({ where });
};

const countByWhere = async (
  client: PrismaClient,
  model: string,
  where: Record<string, unknown>,
): Promise<number> => {
  const delegate = getDelegate(client, model);
  if (!delegate?.count) {
    return 0;
  }

  return delegate.count({ where });
};

const ensureForeignKeys = async (
  client: PrismaClient,
  model: string,
  data: Record<string, unknown>,
) => {
  const definitions = FOREIGN_KEY_VALIDATIONS[model];
  if (!definitions) {
    return;
  }

  for (const { field, target, optional } of definitions) {
    if (!(field in data)) {
      // eslint-disable-next-line no-continue -- Early continue improves readability for optional foreign keys
      continue;
    }

    const value = extractForeignKeyValue(data[field]);

    if (value === undefined) {
      // eslint-disable-next-line no-continue -- Undefined indicates field untouched
      continue;
    }

    if (value === null) {
      if (optional) {
        // eslint-disable-next-line no-continue -- Allow nullable optional relation reset
        continue;
      }
      throw createValidationError(`${model}.${field}`, `${field} cannot be null.`);
    }

    const targetRecord = await fetchSingleRecord(client, target, { id: value });
    if (!targetRecord) {
      throw createValidationError(`${model}.${field}`, `${target} not found.`);
    }
  }
};

const ensureOrderTotals = (
  data: Record<string, unknown>,
  existing?: Record<string, unknown> | null,
) => {
  const existingTotal = existing?.totalAmount ? normaliseDecimal(existing.totalAmount) : undefined;
  const existingSubtotal = existing?.subtotalAmount
    ? normaliseDecimal(existing.subtotalAmount)
    : undefined;
  const existingTax = existing?.taxAmount ? normaliseDecimal(existing.taxAmount) : undefined;
  const existingDiscount = existing?.discountAmount
    ? normaliseDecimal(existing.discountAmount)
    : undefined;

  const subtotal = resolveNumericUpdate(existingSubtotal, data.subtotalAmount) ?? existingSubtotal;
  const tax = resolveNumericUpdate(existingTax, data.taxAmount) ?? existingTax;
  const discount = resolveNumericUpdate(existingDiscount, data.discountAmount) ?? existingDiscount;
  const total = resolveNumericUpdate(existingTotal, data.totalAmount) ?? existingTotal;

  if (!subtotal || !tax || !discount || !total) {
    return;
  }

  const expectedTotal = subtotal.add(tax).sub(discount);

  if (!expectedTotal.equals(total)) {
    throw createValidationError(
      "Order.totalAmount",
      "totalAmount must equal subtotalAmount + taxAmount - discountAmount.",
    );
  }
};

const toJsonInput = (
  value: Prisma.JsonValue,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput =>
  value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);

const countPrimaryVariants = async (client: PrismaClient, productId: string, excludeId?: string) =>
  countByWhere(client, "ProductVariant", {
    productId,
    isPrimary: true,
    ...(excludeId ? { NOT: { id: excludeId } } : {}),
  });

const handleProductVariantRules = async (client: PrismaClient, params: MiddlewareParams) => {
  if (params.action === "create" && isObject(params.args?.data)) {
    const { productId, isPrimary } = params.args.data as {
      productId?: string;
      isPrimary?: boolean;
    };

    if (!productId) {
      throw createValidationError("ProductVariant.productId", "productId is required.");
    }

    if (isPrimary) {
      const primaryCount = await countPrimaryVariants(client, productId);
      if (primaryCount > 0) {
        throw createValidationError(PRODUCT_VARIANT_PRIMARY_FIELD, PRIMARY_VARIANT_EXISTS_ERROR);
      }
      return;
    }

    const primaryCount = await countPrimaryVariants(client, productId);
    if (primaryCount === 0) {
      throw createValidationError(PRODUCT_VARIANT_PRIMARY_FIELD, PRIMARY_VARIANT_REQUIRED_ERROR);
    }
  }

  if (params.action === "update" && isObject(params.args?.data) && isObject(params.args?.where)) {
    const before = await fetchSingleRecord(client, "ProductVariant", params.args.where);
    if (!before) {
      throw new ConflictError("Product variant no longer exists.");
    }

    const { isPrimary } = params.args.data as { isPrimary?: boolean };
    if (isPrimary === undefined) {
      return;
    }

    const productId = before.productId as string;

    if (isPrimary) {
      const primaryCount = await countPrimaryVariants(client, productId, before.id as string);
      if (primaryCount > 0) {
        throw createValidationError(PRODUCT_VARIANT_PRIMARY_FIELD, PRIMARY_VARIANT_EXISTS_ERROR);
      }
      return;
    }

    if (before.isPrimary) {
      const otherPrimary = await countPrimaryVariants(client, productId, before.id as string);
      if (otherPrimary === 0) {
        throw createValidationError(PRODUCT_VARIANT_PRIMARY_FIELD, PRIMARY_VARIANT_REQUIRED_ERROR);
      }
    }
  }

  if (params.action === "delete" && isObject(params.args?.where)) {
    const before = await fetchSingleRecord(client, "ProductVariant", params.args.where);
    if (before?.isPrimary) {
      const otherPrimary = await countPrimaryVariants(
        client,
        before.productId as string,
        before.id as string,
      );
      if (otherPrimary === 0) {
        throw createValidationError(PRODUCT_VARIANT_PRIMARY_FIELD, PRIMARY_VARIANT_REMOVE_ERROR);
      }
    }
  }
};

const handleCategoryRules = async (client: PrismaClient, params: MiddlewareParams) => {
  if (!isObject(params.args?.data) || !("parentId" in params.args.data)) {
    return;
  }

  const { parentId } = params.args.data as { parentId?: string | null };
  if (!parentId || !isObject(params.args?.where)) {
    return;
  }

  const currentId = (params.args.where as Record<string, unknown>).id as string | undefined;
  if (currentId === parentId) {
    throw createValidationError("Category.parentId", "A category cannot be its own parent.");
  }

  let cursor: string | null = parentId;
  const visited = new Set<string>(currentId ? [currentId] : []);

  while (cursor) {
    if (visited.has(cursor)) {
      throw createValidationError("Category.parentId", "Circular category hierarchy detected.");
    }
    visited.add(cursor);
    // eslint-disable-next-line no-await-in-loop -- Hierarchy traversal requires sequential database lookups
    const parent = await fetchSingleRecord(client, "Category", { id: cursor });
    cursor = (parent?.parentId as string | undefined) ?? null;
  }
};

const handleCartItemRules = async (client: PrismaClient, params: MiddlewareParams) => {
  if (params.action !== "create" || !isObject(params.args?.data)) {
    return;
  }

  const { cartId, productVariantId } = params.args.data as {
    cartId?: string;
    productVariantId?: string;
  };

  if (cartId && productVariantId) {
    const existing = await countByWhere(client, "CartItem", { cartId, productVariantId });
    if (existing > 0) {
      throw createValidationError("CartItem", CART_ITEM_DUPLICATE_ERROR);
    }
  }
};

const handlePaymentRules = async (client: PrismaClient, params: MiddlewareParams) => {
  if (!isObject(params.args?.data)) {
    return;
  }

  const { orderId: providedOrderId, amount: rawAmount } = params.args.data as {
    orderId?: string;
    amount?: Prisma.Decimal | number | string;
  };

  let orderId = providedOrderId;
  let amount = normaliseDecimal(rawAmount);

  if (!orderId && params.action !== "create" && isObject(params.args?.where)) {
    const before = await fetchSingleRecord(client, "Payment", params.args.where);
    orderId = before?.orderId as string | undefined;
    amount = resolveNumericUpdate(
      before?.amount ? normaliseDecimal(before.amount) : undefined,
      (params.args.data as Record<string, unknown>).amount,
    );
  }

  if (!orderId || !amount) {
    return;
  }

  const order = await fetchSingleRecord(client, "Order", { id: orderId });
  const orderTotal = order?.totalAmount ? normaliseDecimal(order.totalAmount) : undefined;
  if (orderTotal && !amount.equals(orderTotal)) {
    throw createValidationError("Payment.amount", PAYMENT_AMOUNT_MISMATCH_ERROR);
  }
};

const handleReviewRules = async (client: PrismaClient, params: MiddlewareParams) => {
  if (params.action !== "create" || !isObject(params.args?.data)) {
    return;
  }

  const { productId, userId } = params.args.data as { productId?: string; userId?: string };

  if (productId && userId) {
    const existing = await countByWhere(client, "Review", { productId, userId });
    if (existing > 0) {
      throw createValidationError("Review", REVIEW_DUPLICATE_ERROR);
    }
  }
};

const handleCouponUsageRules = async (client: PrismaClient, params: MiddlewareParams) => {
  if (params.action !== "create" || !isObject(params.args?.data)) {
    return;
  }

  const { couponId } = params.args.data as { couponId?: string };
  if (!couponId) {
    return;
  }

  const coupon = await fetchSingleRecord(client, "Coupon", { id: couponId });
  if (!coupon) {
    throw createValidationError("CouponUsage.couponId", "Coupon does not exist.");
  }

  const limit = typeof coupon.usageLimit === "number" ? coupon.usageLimit : null;
  if (limit === null) {
    return;
  }

  const usageCount = await countByWhere(client, "CouponUsage", { couponId });
  if (usageCount >= limit) {
    throw createValidationError("CouponUsage", COUPON_USAGE_LIMIT_ERROR);
  }
};

const createValidationMiddleware =
  (client: PrismaClient): Middleware =>
  async (params, next) => {
    if (!params.model || shouldSkipGuards()) {
      return next(params);
    }

    if (!["create", "update", "upsert"].includes(params.action)) {
      return next(params);
    }

    const data = params.args?.data;
    if (!isObject(data)) {
      return next(params);
    }

    let existingRecord: Record<string, unknown> | null = null;
    if ((params.action === "update" || params.action === "upsert") && isObject(params.args.where)) {
      const delegate = getDelegate(client, params.model);
      existingRecord = delegate?.findUnique
        ? await delegate.findUnique({ where: params.args.where })
        : null;
    }

    await ensureForeignKeys(client, params.model, data);
    ensureEmailValidity(params.model, data);
    ensureNonNegativeValues(params.model, data, existingRecord ?? undefined);
    ensureRatingConstraints(params.model, data);

    if (params.model === "Order") {
      ensureOrderTotals(data, existingRecord ?? undefined);
    }

    ensureExpiryAfterCreation(params.model, data, existingRecord ?? undefined);

    return next(params);
  };

const BUSINESS_RULE_HANDLERS: Record<
  string,
  (client: PrismaClient, params: MiddlewareParams) => Promise<void>
> = {
  ProductVariant: handleProductVariantRules,
  Category: handleCategoryRules,
  CartItem: handleCartItemRules,
  Payment: handlePaymentRules,
  Review: handleReviewRules,
  CouponUsage: handleCouponUsageRules,
};

const createBusinessRulesMiddleware =
  (client: PrismaClient): Middleware =>
  async (params, next) => {
    if (!params.model || shouldSkipGuards() || !MUTATING_ACTIONS.has(params.action)) {
      return next(params);
    }

    const handler = BUSINESS_RULE_HANDLERS[params.model];
    if (!handler) {
      return next(params);
    }

    await handler(client, params);
    return next(params);
  };

const createAuditLogMiddleware =
  (client: PrismaClient): Middleware =>
  async (params, next) => {
    if (!params.model || AUDIT_EXCLUDED_MODELS.has(params.model) || shouldSkipGuards()) {
      return next(params);
    }

    if (!MUTATING_ACTIONS.has(params.action)) {
      return next(params);
    }

    const delegate = getDelegate(client, params.model);

    let before: unknown;

    if (
      delegate?.findUnique &&
      isObject(params.args?.where) &&
      (params.action === "update" || params.action === "delete")
    ) {
      before = await delegate.findUnique({ where: params.args.where });
    }

    const result = await next(params);

    const actorContext = getRequestContext();
    const entity = params.model as string;
    const actorType = actorContext.userId ? "user" : "system";
    const entityId =
      (isObject(result) && "id" in result ? (result.id as string) : undefined) ??
      (isObject(params.args?.where) && "id" in params.args.where
        ? (params.args.where.id as string)
        : undefined) ??
      "unknown";

    const beforePayload = before ? (maskSensitiveData(before) as Prisma.JsonValue) : undefined;
    const afterPayload =
      params.action === "delete" || params.action === "deleteMany"
        ? undefined
        : (maskSensitiveData(result) as Prisma.JsonValue);

    try {
      await runWithoutGuards(async () => {
        const auditData: Prisma.AuditLogUncheckedCreateInput = {
          actorType,
          action: params.action,
          entity,
          entityId,
          userId: actorContext.userId ?? null,
        };

        if (beforePayload !== undefined) {
          auditData.before = toJsonInput(beforePayload);
        }
        if (afterPayload !== undefined) {
          auditData.after = toJsonInput(afterPayload);
        }
        if (typeof actorContext.ip === "string") {
          auditData.ipAddress = actorContext.ip;
        }
        if (typeof actorContext.userAgent === "string") {
          auditData.userAgent = actorContext.userAgent;
        }

        await client.auditLog.create({ data: auditData });
      });
    } catch (error) {
      logger.warn("Failed to persist audit log entry", {
        error,
        entity: params.model,
        action: params.action,
      });
    }

    return result;
  };

let registered = false;

export const registerPrismaMiddlewares = (client?: PrismaClient): void => {
  if (registered) {
    return;
  }

  registered = true;

  registerPrismaExtension((baseClient) => {
    const prismaClient = (client ?? (baseClient as unknown as PrismaClient)) as PrismaClient;
    const middlewareHost = prismaClient as unknown as {
      $use: (middleware: Prisma.Middleware) => void;
    };

    middlewareHost.$use(createSoftDeleteMiddleware());
    middlewareHost.$use(createTimestampValidationMiddleware());
    middlewareHost.$use(createVersioningMiddleware());
    middlewareHost.$use(createValidationMiddleware(prismaClient));
    middlewareHost.$use(createBusinessRulesMiddleware(prismaClient));
    middlewareHost.$use(createAuditLogMiddleware(prismaClient));
    return prismaClient as unknown as typeof baseClient;
  });
};

export const prismaMiddlewaresInternals = {
  createSoftDeleteMiddleware,
  createTimestampValidationMiddleware,
  createVersioningMiddleware,
  createValidationMiddleware,
  createBusinessRulesMiddleware,
  createAuditLogMiddleware,
  shouldSkipGuards,
  runWithoutGuards,
};
