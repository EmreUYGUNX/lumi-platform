/* eslint-disable max-lines, unicorn/no-null */
import { setInterval as scheduleInterval } from "node:timers";

import { InventoryPolicy, Prisma, ProductStatus } from "@prisma/client";
import type { CartStatus, PrismaClient } from "@prisma/client";

import { getConfig } from "@/config/index.js";
import { type EmailService, createEmailService } from "@/lib/email/email.service.js";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors.js";
import { createChildLogger } from "@/lib/logger.js";
import { getPrismaClient } from "@/lib/prisma.js";
import { recordCartOperationMetric } from "@/observability/index.js";
import {
  type CartSummaryDTO,
  type MoneyDTO,
  type ProductVariantDTO,
  mapCartToSummary,
} from "@lumi/shared/dto";

import type { CartCache } from "./cart.cache.js";
import { createCartCache } from "./cart.cache.js";
import { emitCartEvent } from "./cart.events.js";
import { CART_DEFAULT_INCLUDE, CartRepository, type CartWithRelations } from "./cart.repository.js";
import type {
  CartDeliveryEstimate,
  CartItemWithProduct,
  CartStockIssue,
  CartStockStatus,
  CartSummaryView,
  CartSummaryWithProducts,
  CartValidationIssue,
  CartValidationReport,
} from "./cart.types.js";
import {
  type AddCartItemInput,
  CART_ITEM_MAX_QUANTITY,
  type MergeCartInput,
  type UpdateCartItemInput,
} from "./cart.validators.js";

const CART_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const DEFAULT_CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

const PRODUCT_INACTIVE_MESSAGE = "This product is no longer available.";
const VARIANT_UNAVAILABLE_MESSAGE = "The selected product variant is no longer available.";

interface CartProductVariant {
  id: string;
  title: string;
  sku: string;
  price: Prisma.Decimal;
  compareAtPrice: Prisma.Decimal | null;
  stock: number;
  attributes: unknown;
  weightGrams: number | null;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
  product: {
    id: string;
    title: string;
    slug: string;
    price: Prisma.Decimal;
    compareAtPrice: Prisma.Decimal | null;
    currency: string;
    status: ProductStatus;
    inventoryPolicy: InventoryPolicy;
  };
}

interface CartItemEntity {
  id: string;
  cartId: string;
  productVariantId: string;
  quantity: number;
  unitPrice: Prisma.Decimal | number;
  createdAt: Date;
  updatedAt: Date;
  productVariant: CartProductVariant | null;
}

interface CartEntity {
  id: string;
  userId: string | null;
  sessionId: string | null;
  status: CartStatus;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  items: CartItemEntity[];
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
}

const toMoney = (value: Prisma.Decimal | number | string, currency: string): MoneyDTO => {
  const decimal =
    value instanceof Prisma.Decimal
      ? value
      : new Prisma.Decimal(typeof value === "number" ? value : String(value));
  return {
    amount: decimal.toFixed(2),
    currency,
  };
};

const compareMoney = (left: Prisma.Decimal, right: Prisma.Decimal): boolean => left.equals(right);

export interface CartServiceOptions {
  prisma?: PrismaClient;
  repository?: CartRepository;
  cache?: CartCache;
  logger?: ReturnType<typeof createChildLogger>;
  now?: () => Date;
  cleanupIntervalMs?: number;
  disableCleanupJob?: boolean;
  emailService?: EmailService;
}

export interface CartContext {
  userId: string;
  sessionId?: string;
}

interface CartMutationResult {
  cart: CartWithRelations;
  affectedItemId?: string;
  variantId?: string;
  previousQuantity?: number;
  newQuantity?: number;
  removedItemCount?: number;
  mergedItemCount?: number;
  sourceCartId?: string;
  targetCartId?: string;
}

export class CartService {
  private readonly prisma: PrismaClient;

  private readonly repository: CartRepository;

  private readonly cache: CartCache;

  private readonly logger: ReturnType<typeof createChildLogger>;

  private readonly now: () => Date;

  private readonly cleanupIntervalMs: number;

  private readonly emailService: EmailService;

  private cleanupTimer: NodeJS.Timeout | undefined;

  constructor(options: CartServiceOptions = {}) {
    this.prisma = options.prisma ?? getPrismaClient();
    this.repository = options.repository ?? new CartRepository(this.prisma);
    this.cache = options.cache ?? createCartCache();
    this.logger = options.logger ?? createChildLogger("cart:service");
    this.now = options.now ?? (() => new Date());
    this.cleanupIntervalMs = Math.max(
      60 * 1000,
      options.cleanupIntervalMs ?? DEFAULT_CLEANUP_INTERVAL_MS,
    );
    this.emailService =
      options.emailService ??
      createEmailService({
        config: getConfig(),
      });

    if (!options.disableCleanupJob) {
      this.startCleanupJob();
    }
  }

  async getCart(context: CartContext): Promise<CartSummaryView> {
    const cached = await this.cache.get("user", context.userId);
    if (cached) {
      return cached;
    }

    const cart = await this.ensureActiveCartForUser(context);
    const view = this.buildCartView(cart);
    await this.cacheCart(cart.id, context, view);
    return view;
  }

  async addItem(context: CartContext, input: AddCartItemInput): Promise<CartSummaryView> {
    const result = await this.repository.withTransaction(async (repo, tx) => {
      const cart = await this.ensureActiveCartForUser(context, { repo });
      const mutation = await this.applyAddItem(tx, cart, context, input);
      const refreshed = (await repo.findById(cart.id, {
        include: CART_DEFAULT_INCLUDE,
      })) as CartWithRelations | null;
      if (!refreshed) {
        throw new NotFoundError("Cart not found after update.");
      }

      return {
        cart: refreshed,
        affectedItemId: mutation.itemId,
        variantId: mutation.variantId,
        previousQuantity: mutation.previousQuantity,
        newQuantity: mutation.newQuantity,
      } satisfies CartMutationResult;
    });

    const view = this.buildCartView(result.cart);
    await this.cacheCart(result.cart.id, context, view);
    recordCartOperationMetric("add_item");
    emitCartEvent("cart.item_added", {
      cartId: result.cart.id,
      userId: context.userId,
      sessionId: context.sessionId,
      itemId: result.affectedItemId ?? "unknown",
      variantId: result.variantId ?? input.productVariantId,
      previousQuantity: result.previousQuantity ?? 0,
      quantity: result.newQuantity ?? input.quantity,
      summary: view,
    });
    return view;
  }

  async updateItem(
    context: CartContext,
    itemId: string,
    input: UpdateCartItemInput,
  ): Promise<CartSummaryView> {
    const result = await this.repository.withTransaction(async (repo, tx) => {
      const cart = await this.ensureActiveCartForUser(context, { repo });
      const mutation = await this.applyUpdateItem(tx, cart, context, itemId, input.quantity);
      const refreshed = (await repo.findById(cart.id, {
        include: CART_DEFAULT_INCLUDE,
      })) as CartWithRelations | null;
      if (!refreshed) {
        throw new NotFoundError("Cart not found after update.");
      }

      return {
        cart: refreshed,
        affectedItemId: mutation.itemId,
        variantId: mutation.variantId,
        previousQuantity: mutation.previousQuantity,
        newQuantity: mutation.newQuantity,
      } satisfies CartMutationResult;
    });

    const view = this.buildCartView(result.cart);
    await this.cacheCart(result.cart.id, context, view);
    const updatedQuantity = result.newQuantity ?? 0;
    recordCartOperationMetric(updatedQuantity === 0 ? "remove_item" : "update_item");

    emitCartEvent("cart.item_updated", {
      cartId: result.cart.id,
      userId: context.userId,
      sessionId: context.sessionId,
      itemId,
      variantId: result.variantId ?? "unknown",
      previousQuantity: result.previousQuantity ?? 0,
      quantity: result.newQuantity ?? 0,
      summary: view,
    });

    if (updatedQuantity === 0) {
      emitCartEvent("cart.item_removed", {
        cartId: result.cart.id,
        userId: context.userId,
        sessionId: context.sessionId,
        itemId,
        variantId: result.variantId ?? "unknown",
        previousQuantity: result.previousQuantity ?? 0,
      });
    }

    return view;
  }

  async removeItem(context: CartContext, itemId: string): Promise<CartSummaryView> {
    return this.updateItem(context, itemId, { quantity: 0 });
  }

  async clearCart(context: CartContext): Promise<CartSummaryView> {
    const result = await this.repository.withTransaction(async (repo, tx) => {
      const cart = await this.ensureActiveCartForUser(context, { repo });
      const removed = await this.applyClearCart(tx, cart);
      const refreshed = (await repo.findById(cart.id, {
        include: CART_DEFAULT_INCLUDE,
      })) as CartWithRelations | null;
      if (!refreshed) {
        throw new NotFoundError("Cart not found after clearing.");
      }

      return {
        cart: refreshed,
        removedItemCount: removed,
      } satisfies CartMutationResult;
    });

    const view = this.buildCartView(result.cart);
    await this.cacheCart(result.cart.id, context, view);
    recordCartOperationMetric("clear_cart");
    emitCartEvent("cart.cleared", {
      cartId: result.cart.id,
      userId: context.userId,
      sessionId: context.sessionId,
      removedItemCount: result.removedItemCount ?? 0,
    });
    return view;
  }

  async mergeCart(userId: string, input: MergeCartInput): Promise<CartSummaryView> {
    const result = await this.repository.withTransaction(async (repo, tx) => {
      const guestCart = (await repo.findActiveCartBySession(
        input.sessionId,
      )) as CartWithRelations | null;
      if (!guestCart) {
        throw new NotFoundError("Guest cart not found.");
      }

      const userCart = (await repo.findActiveCartByUser(userId)) as CartWithRelations | null;
      if (!userCart) {
        // Claim guest cart for the user
        await tx.cart.update({
          where: { id: guestCart.id },
          data: {
            userId,
            sessionId: null,
            expiresAt: this.computeExpiryDate(),
            updatedAt: this.now(),
          },
        });
        const claimed = (await repo.findById(guestCart.id, {
          include: CART_DEFAULT_INCLUDE,
        })) as CartWithRelations | null;
        if (!claimed) {
          throw new NotFoundError("Cart not found after reassignment.");
        }
        const guestEntity = guestCart as unknown as CartEntity;
        return {
          cart: claimed,
          mergedItemCount: guestEntity.items.length,
          sourceCartId: guestCart.id,
          targetCartId: guestCart.id,
        } satisfies CartMutationResult;
      }

      const merged = await this.applyMergeCarts(tx, guestCart, userCart, input.strategy);
      const refreshed = (await repo.findById(userCart.id, {
        include: CART_DEFAULT_INCLUDE,
      })) as CartWithRelations | null;
      if (!refreshed) {
        throw new NotFoundError("Cart not found after merge.");
      }

      return {
        cart: refreshed,
        mergedItemCount: merged.mergedItems,
        sourceCartId: guestCart.id,
        targetCartId: userCart.id,
      } satisfies CartMutationResult;
    });

    const view = this.buildCartView(result.cart);
    await this.cacheCart(result.cart.id, { userId }, view);
    await this.cache.invalidate("session", input.sessionId).catch(() => {});
    recordCartOperationMetric("merge_cart");
    emitCartEvent("cart.merged", {
      sourceCartId: result.sourceCartId ?? "unknown",
      targetCartId: result.targetCartId ?? result.cart.id,
      userId,
      mergedItemCount: result.mergedItemCount ?? 0,
    });
    return view;
  }

  async validateCart(context: CartContext): Promise<CartValidationReport> {
    const cart = await this.ensureActiveCartForUser(context);
    const report = this.evaluateCart(cart);
    recordCartOperationMetric("validate_cart");

    emitCartEvent("cart.validated", {
      cartId: cart.id,
      userId: context.userId,
      sessionId: context.sessionId,
      report,
    });

    return report;
  }

  async cleanupExpiredCarts(): Promise<void> {
    const now = this.now();
    const expirationThreshold = new Date(now.getTime() - CART_EXPIRY_MS);

    const staleCarts = await this.prisma.cart.findMany({
      where: {
        status: "ACTIVE",
        OR: [
          { expiresAt: { lt: now } },
          { expiresAt: null, updatedAt: { lt: expirationThreshold } },
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
          },
        },
      },
    });

    if (staleCarts.length === 0) {
      return;
    }

    await Promise.all(
      staleCarts.map(async (cart) => {
        await this.prisma.cart.update({
          where: { id: cart.id },
          data: {
            status: "ABANDONED",
            expiresAt: now,
            updatedAt: now,
          },
        });
        await this.cache.invalidateByCartId(cart.id);

        if (cart.user?.email) {
          const detailed = (await this.repository.findById(cart.id, {
            include: CART_DEFAULT_INCLUDE,
          })) as CartWithRelations | null;
          if (detailed) {
            await this.triggerCartRecoveryEmail(detailed);
          }
        }
      }),
    );
  }

  async shutdown(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    await this.cache.shutdown();
  }

  private startCleanupJob(): void {
    if (this.cleanupTimer) {
      return;
    }

    this.cleanupTimer = scheduleInterval(() => {
      this.cleanupExpiredCarts().catch((error) => {
        this.logger.error("Cart cleanup job failed", { error });
      });
    }, this.cleanupIntervalMs);
    this.cleanupTimer.unref?.();
  }

  private computeExpiryDate(baseDate = this.now()): Date {
    return new Date(baseDate.getTime() + CART_EXPIRY_MS);
  }

  private async cacheCart(
    cartId: string,
    context: CartContext,
    view: CartSummaryView,
  ): Promise<void> {
    await this.cache.set("user", context.userId, cartId, view);
    if (context.sessionId) {
      await this.cache.set("session", context.sessionId, cartId, view);
    }
  }

  private async ensureActiveCartForUser(
    context: CartContext,
    options: { repo?: CartRepository } = {},
  ): Promise<CartWithRelations> {
    const repo = options.repo ?? this.repository;
    const existing = await repo.findActiveCartByUser(context.userId);
    if (existing) {
      return existing as CartWithRelations;
    }

    const now = this.now();
    const created = await repo.create({
      data: {
        userId: context.userId,
        sessionId: context.sessionId ?? null,
        status: "ACTIVE",
        expiresAt: this.computeExpiryDate(now),
      },
    });

    const cart = (await repo.findById(created.id, {
      include: CART_DEFAULT_INCLUDE,
    })) as CartWithRelations | null;
    if (!cart) {
      throw new NotFoundError("Cart creation failed.");
    }

    return cart as CartWithRelations;
  }

  private buildCartView(cart: CartWithRelations): CartSummaryView {
    const materialised = cart as unknown as CartEntity;
    const firstItem = materialised.items[0];
    const currency = firstItem?.productVariant?.product?.currency ?? "TRY";
    const summary = mapCartToSummary(materialised, currency);
    const enriched = CartService.enrichSummary(summary, materialised, currency);
    const stock = this.computeStockStatus(materialised);
    const delivery = this.estimateDelivery(stock, materialised);

    return {
      cart: enriched,
      stock,
      delivery,
    };
  }

  private static enrichSummary(
    summary: CartSummaryDTO,
    cart: CartEntity,
    currency: string,
  ): CartSummaryWithProducts {
    const variantMap = new Map<string, CartItemEntity>();
    cart.items.forEach((item) => {
      variantMap.set(item.id, item);
    });

    const items = summary.items.flatMap<CartItemWithProduct>((item) => {
      const entity = variantMap.get(item.id);
      const variant = entity?.productVariant;
      if (!entity || !variant || !variant.product) {
        return [];
      }

      const { product } = variant;

      return [
        {
          ...item,
          product: {
            id: product.id,
            title: product.title,
            slug: product.slug,
            status: product.status,
            inventoryPolicy: product.inventoryPolicy,
            price: toMoney(product.price, currency),
            compareAtPrice: product.compareAtPrice
              ? toMoney(product.compareAtPrice, currency)
              : undefined,
            currency: product.currency,
          },
          variant: CartService.mapVariant(variant, currency),
          availableStock: variant.stock,
        },
      ];
    });

    return {
      ...summary,
      items,
    };
  }

  private static mapVariant(
    variant: NonNullable<CartWithRelations["items"][number]["productVariant"]>,
    currency: string,
  ): ProductVariantDTO {
    return {
      id: variant.id,
      title: variant.title,
      sku: variant.sku,
      price: toMoney(variant.price, currency),
      compareAtPrice: variant.compareAtPrice
        ? toMoney(variant.compareAtPrice, currency)
        : undefined,
      stock: variant.stock,
      attributes: variant.attributes ?? null,
      weightGrams: variant.weightGrams ?? null,
      isPrimary: variant.isPrimary,
      createdAt: variant.createdAt.toISOString(),
      updatedAt: variant.updatedAt.toISOString(),
    } satisfies ProductVariantDTO;
  }

  private computeStockStatus(cart: CartEntity): CartStockStatus {
    const issues: CartStockIssue[] = [];

    cart.items.forEach((item) => {
      const variant = item.productVariant;
      const product = variant?.product;
      if (!variant || !product) {
        issues.push({
          type: "variant_unavailable",
          itemId: item.id,
          variantId: item.productVariantId,
          productId: product?.id ?? "unknown",
          requestedQuantity: item.quantity,
          availableQuantity: 0,
          message: VARIANT_UNAVAILABLE_MESSAGE,
        });
        return;
      }

      if (product.status !== ProductStatus.ACTIVE) {
        issues.push({
          type: "variant_unavailable",
          itemId: item.id,
          variantId: item.productVariantId,
          productId: product.id,
          requestedQuantity: item.quantity,
          availableQuantity: variant.stock,
          message: PRODUCT_INACTIVE_MESSAGE,
        });
        return;
      }

      if (variant.stock <= 0 || variant.stock < item.quantity) {
        issues.push({
          type: "out_of_stock",
          itemId: item.id,
          variantId: item.productVariantId,
          productId: product.id,
          requestedQuantity: item.quantity,
          availableQuantity: Math.max(0, variant.stock),
          message: "Requested quantity exceeds available stock.",
        });
        return;
      }

      if (variant.stock - item.quantity <= 2) {
        issues.push({
          type: "low_stock",
          itemId: item.id,
          variantId: item.productVariantId,
          productId: product.id,
          requestedQuantity: item.quantity,
          availableQuantity: variant.stock,
          message: "Stock levels are low for this item.",
        });
      }
    });

    const status: CartStockStatus["status"] =
      issues.length === 0
        ? "ok"
        : issues.some(
              (issue) => issue.type === "out_of_stock" || issue.type === "variant_unavailable",
            )
          ? "error"
          : "warning";

    return {
      status,
      issues,
      checkedAt: this.now().toISOString(),
    };
  }

  private estimateDelivery(stock: CartStockStatus, _cart: CartEntity): CartDeliveryEstimate {
    const now = this.now();

    if (stock.status === "error") {
      return {
        status: "backorder",
        message: "Some items are unavailable. Delivery will be scheduled once stock is restored.",
      };
    }

    if (stock.status === "warning") {
      const minHours = 48;
      const maxHours = 96;
      const estimate = new Date(now.getTime() + maxHours * 60 * 60 * 1000).toISOString();
      return {
        status: "delayed",
        minHours,
        maxHours,
        estimatedDeliveryDate: estimate,
        message: "Limited stock detected. Delivery may be delayed up to 4 days.",
      };
    }

    const minHours = 24;
    const maxHours = 72;
    const estimate = new Date(now.getTime() + maxHours * 60 * 60 * 1000).toISOString();
    return {
      status: "standard",
      minHours,
      maxHours,
      estimatedDeliveryDate: estimate,
      message: "Standard delivery estimated between 1-3 business days.",
    };
  }

  private evaluateCart(cart: CartWithRelations): CartValidationReport {
    const materialised = cart as unknown as CartEntity;
    const currency = materialised.items[0]?.productVariant?.product?.currency ?? "TRY";
    const { totals } = mapCartToSummary(materialised, currency);

    const issues: CartValidationIssue[] = [];
    materialised.items.forEach((item) => {
      const { productVariant: variant } = item;
      const product = variant?.product;
      if (!variant || !product) {
        issues.push({
          type: "variant_unavailable",
          itemId: item.id,
          variantId: item.productVariantId,
          productId: product?.id ?? "unknown",
          message: VARIANT_UNAVAILABLE_MESSAGE,
        });
        return;
      }

      if (product.status !== ProductStatus.ACTIVE) {
        issues.push({
          type: "product_unavailable",
          itemId: item.id,
          variantId: item.productVariantId,
          productId: product.id,
          message: PRODUCT_INACTIVE_MESSAGE,
        });
      }

      if (variant.stock <= 0 || variant.stock < item.quantity) {
        issues.push({
          type: "out_of_stock",
          itemId: item.id,
          variantId: item.productVariantId,
          productId: product.id,
          requestedQuantity: item.quantity,
          availableQuantity: Math.max(0, variant.stock),
          message: "Insufficient inventory to fulfill this item.",
        });
      } else if (variant.stock - item.quantity <= 2) {
        issues.push({
          type: "low_stock",
          itemId: item.id,
          variantId: item.productVariantId,
          productId: product.id,
          requestedQuantity: item.quantity,
          availableQuantity: variant.stock,
          message: "Low stock for this item.",
        });
      }

      const expectedUnitPrice =
        variant.product.currency === currency ? variant.price : new Prisma.Decimal(variant.price);
      const actualUnitPrice =
        item.unitPrice instanceof Prisma.Decimal
          ? item.unitPrice
          : new Prisma.Decimal(item.unitPrice);

      if (!compareMoney(expectedUnitPrice, actualUnitPrice)) {
        issues.push({
          type: "price_mismatch",
          itemId: item.id,
          variantId: item.productVariantId,
          productId: product.id,
          message: "Price mismatch detected for this item.",
          expectedUnitPrice: toMoney(expectedUnitPrice, currency),
          actualUnitPrice: toMoney(actualUnitPrice, currency),
        });
      }
    });

    const stockStatus = this.computeStockStatus(materialised);
    const valid = issues.every(
      (issue) =>
        issue.type !== "out_of_stock" &&
        issue.type !== "product_unavailable" &&
        issue.type !== "variant_unavailable",
    );

    return {
      cartId: cart.id,
      valid,
      issues,
      stock: stockStatus,
      totals,
      checkedAt: this.now().toISOString(),
    };
  }

  private async applyAddItem(
    tx: Prisma.TransactionClient,
    cart: CartWithRelations,
    context: CartContext,
    input: AddCartItemInput,
  ): Promise<{ itemId: string; variantId: string; previousQuantity: number; newQuantity: number }> {
    const variant = await tx.productVariant.findUnique({
      where: { id: input.productVariantId },
      include: {
        product: true,
      },
    });

    if (!variant || !variant.product) {
      throw new ValidationError("Selected product variant is unavailable.", {
        issues: [
          {
            path: "productVariantId",
            message: VARIANT_UNAVAILABLE_MESSAGE,
          },
        ],
      });
    }

    if (variant.product.status !== ProductStatus.ACTIVE) {
      throw new ValidationError("Product is not available for purchase.", {
        issues: [
          {
            path: "productVariantId",
            message: PRODUCT_INACTIVE_MESSAGE,
          },
        ],
      });
    }

    const existingItem = await tx.cartItem.findUnique({
      where: {
        cartId_productVariantId: {
          cartId: cart.id,
          productVariantId: input.productVariantId,
        },
      },
    });

    const previousQuantity = existingItem?.quantity ?? 0;
    const nextQuantity = previousQuantity + input.quantity;

    if (nextQuantity > CART_ITEM_MAX_QUANTITY) {
      throw new ValidationError("Maximum quantity per item exceeded.", {
        issues: [
          {
            path: "quantity",
            message: `You can only purchase up to ${CART_ITEM_MAX_QUANTITY} units of this item.`,
          },
        ],
      });
    }

    if (
      variant.stock < nextQuantity &&
      variant.product.inventoryPolicy !== InventoryPolicy.CONTINUE
    ) {
      throw new ConflictError("Insufficient inventory to add this item.", {
        details: {
          available: variant.stock,
          requested: nextQuantity,
          variantId: variant.id,
        },
      });
    }

    const item = await tx.cartItem.upsert({
      where: {
        cartId_productVariantId: {
          cartId: cart.id,
          productVariantId: input.productVariantId,
        },
      },
      update: {
        quantity: { set: nextQuantity },
        unitPrice: variant.price,
        updatedAt: this.now(),
      },
      create: {
        cartId: cart.id,
        productVariantId: input.productVariantId,
        quantity: nextQuantity,
        unitPrice: variant.price,
      },
    });

    await tx.cart.update({
      where: { id: cart.id },
      data: {
        expiresAt: this.computeExpiryDate(),
        updatedAt: this.now(),
        sessionId: context.sessionId ?? cart.sessionId,
      },
    });

    return {
      itemId: item.id,
      variantId: variant.id,
      previousQuantity,
      newQuantity: nextQuantity,
    };
  }

  private async applyUpdateItem(
    tx: Prisma.TransactionClient,
    cart: CartWithRelations,
    context: CartContext,
    itemId: string,
    quantity: number,
  ): Promise<{ itemId: string; variantId: string; previousQuantity: number; newQuantity: number }> {
    const item = await tx.cartItem.findUnique({
      where: { id: itemId },
      include: {
        productVariant: {
          include: {
            product: true,
          },
        },
        cart: true,
      },
    });

    if (!item || item.cartId !== cart.id || item.cart.userId !== context.userId) {
      throw new NotFoundError("Cart item not found.");
    }

    const variant = item.productVariant;
    if (!variant || !variant.product) {
      throw new ValidationError("Selected product variant is unavailable.", {
        issues: [
          {
            path: "itemId",
            message: VARIANT_UNAVAILABLE_MESSAGE,
          },
        ],
      });
    }

    if (quantity > CART_ITEM_MAX_QUANTITY) {
      throw new ValidationError("Maximum quantity per item exceeded.", {
        issues: [
          {
            path: "quantity",
            message: `You can only purchase up to ${CART_ITEM_MAX_QUANTITY} units of this item.`,
          },
        ],
      });
    }

    if (
      quantity > 0 &&
      variant.stock < quantity &&
      variant.product.inventoryPolicy !== InventoryPolicy.CONTINUE
    ) {
      throw new ConflictError("Insufficient inventory to adjust this item.", {
        details: {
          available: variant.stock,
          requested: quantity,
          variantId: variant.id,
        },
      });
    }

    const cartItemUpdateData =
      quantity === 0
        ? {
            quantity: { set: 0 },
            updatedAt: this.now(),
          }
        : {
            quantity: { set: quantity },
            unitPrice: variant.price,
            updatedAt: this.now(),
          };

    await tx.cartItem.update({
      where: { id: item.id },
      data: cartItemUpdateData,
    });

    await tx.cart.update({
      where: { id: cart.id },
      data: {
        expiresAt: this.computeExpiryDate(),
        updatedAt: this.now(),
      },
    });

    return {
      itemId,
      variantId: variant.id,
      previousQuantity: item.quantity,
      newQuantity: quantity,
    };
  }

  private async applyClearCart(
    tx: Prisma.TransactionClient,
    cart: CartWithRelations,
  ): Promise<number> {
    const result = await tx.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    await tx.cart.update({
      where: { id: cart.id },
      data: {
        expiresAt: this.computeExpiryDate(),
        updatedAt: this.now(),
      },
    });

    return result.count;
  }

  private async applyMergeCarts(
    tx: Prisma.TransactionClient,
    guestCart: CartWithRelations,
    userCart: CartWithRelations,
    strategy: "sum" | "replace",
  ): Promise<{ mergedItems: number }> {
    const target = userCart as unknown as CartEntity;
    const source = guestCart as unknown as CartEntity;

    const userItems = new Map<string, { id: string; quantity: number }>();
    target.items.forEach((item) => {
      userItems.set(item.productVariantId, { id: item.id, quantity: item.quantity });
    });

    const desiredQuantities = new Map<
      string,
      { desiredQuantity: number; existingId?: string; guestItemCount: number }
    >();

    source.items.forEach((guestItem) => {
      const existing = userItems.get(guestItem.productVariantId);
      const entry = desiredQuantities.get(guestItem.productVariantId);
      const currentDesired =
        entry?.desiredQuantity ?? (strategy === "replace" ? 0 : (existing?.quantity ?? 0));
      const nextDesired = currentDesired + guestItem.quantity;
      desiredQuantities.set(guestItem.productVariantId, {
        desiredQuantity: Math.min(nextDesired, CART_ITEM_MAX_QUANTITY),
        existingId: entry?.existingId ?? existing?.id,
        guestItemCount: (entry?.guestItemCount ?? 0) + 1,
      });
    });

    const operations = [...desiredQuantities.entries()].map(async ([variantId, details]) => {
      const variant = await tx.productVariant.findUnique({
        where: { id: variantId },
        include: { product: true },
      });

      if (!variant || !variant.product) {
        return 0;
      }

      if (details.existingId) {
        await tx.cartItem.update({
          where: { id: details.existingId },
          data: {
            quantity: { set: details.desiredQuantity },
            unitPrice: variant.price,
            updatedAt: this.now(),
          },
        });
        return details.guestItemCount;
      }

      await tx.cartItem.create({
        data: {
          cartId: userCart.id,
          productVariantId: variantId,
          quantity: details.desiredQuantity,
          unitPrice: variant.price,
        },
      });
      return details.guestItemCount;
    });

    const mergedResults = await Promise.all(operations);
    let mergedCount = 0;
    mergedResults.forEach((value) => {
      mergedCount += value;
    });

    await tx.cart.update({
      where: { id: guestCart.id },
      data: {
        status: "ABANDONED",
        expiresAt: this.now(),
        updatedAt: this.now(),
      },
    });

    await tx.cartItem.deleteMany({
      where: { cartId: guestCart.id },
    });

    await tx.cart.update({
      where: { id: userCart.id },
      data: {
        expiresAt: this.computeExpiryDate(),
        updatedAt: this.now(),
      },
    });

    return { mergedItems: mergedCount };
  }

  private async triggerCartRecoveryEmail(cart: CartWithRelations): Promise<void> {
    if (!cart.user?.email) {
      return;
    }

    try {
      const resumeUrl = `${getConfig().app.frontendUrl.replace(/\/+$/, "")}/cart/recover/${cart.id}`;
      const materialised = cart as unknown as CartEntity;
      const itemCount = materialised.items.reduce((total, item) => total + item.quantity, 0);
      const currency = materialised.items[0]?.productVariant?.product?.currency ?? "TRY";
      const { totals } = mapCartToSummary(materialised, currency);

      await this.emailService.sendCartRecoveryEmail({
        to: cart.user.email,
        firstName: cart.user.firstName,
        cartId: cart.id,
        resumeUrl,
        itemCount,
        total: totals.total,
      });
    } catch (error) {
      this.logger.warn("Failed to send cart recovery email", {
        cartId: cart.id,
        userId: cart.user?.id,
        error,
      });
    }
  }
}
