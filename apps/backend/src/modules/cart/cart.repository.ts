import { randomUUID } from "node:crypto";

import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";

import { NotFoundError } from "@/lib/errors.js";
import { BaseRepository, type RepositoryContext } from "@/lib/repository/base.repository.js";

type CartRepositoryContext = RepositoryContext<
  Prisma.CartDelegate,
  Prisma.CartWhereInput,
  Prisma.CartOrderByWithRelationInput
>;

const CART_ITEM_INCLUDE = Prisma.validator<Prisma.CartItemInclude>()({
  customization: true,
  productVariant: {
    include: {
      product: true,
      inventory: true,
    },
  },
});

export const CART_DEFAULT_INCLUDE = Prisma.validator<Prisma.CartInclude>()({
  items: {
    where: {
      quantity: {
        gt: 0,
      },
    },
    include: CART_ITEM_INCLUDE,
  },
  user: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
    },
  },
});

export type CartWithRelations = Prisma.CartGetPayload<{ include: typeof CART_DEFAULT_INCLUDE }>;

const buildActiveCartCondition = (): Prisma.CartWhereInput => ({
  status: "ACTIVE",
  // eslint-disable-next-line unicorn/no-null -- Null sentinel tracks carts without an explicit expiry
  OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
});

export class CartRepository extends BaseRepository<
  Prisma.CartDelegate,
  Prisma.CartWhereInput,
  Prisma.CartOrderByWithRelationInput,
  Prisma.CartSelect,
  Prisma.CartInclude
> {
  constructor(
    private readonly prisma: PrismaClient,
    context?: CartRepositoryContext,
  ) {
    super(
      context ?? {
        modelName: "Cart",
        delegate: prisma.cart,
        getDelegate: (client) => client.cart,
        runInTransaction: (callback) => prisma.$transaction(callback),
        primaryKey: "id",
        defaultSort: [{ updatedAt: "desc" }],
      },
    );
  }

  // eslint-disable-next-line class-methods-use-this -- Context binding is handled via explicit dependency wiring
  protected createWithContext(context: CartRepositoryContext): this {
    return new CartRepository(this.prisma, context) as this;
  }

  async findActiveCartByUser(
    userId: string,
    options: { include?: Prisma.CartInclude } = {},
  ): Promise<CartWithRelations | null> {
    return (await this.findFirst({
      where: {
        ...buildActiveCartCondition(),
        userId,
      },
      include: options.include ?? CART_DEFAULT_INCLUDE,
    })) as CartWithRelations | null;
  }

  async findActiveCartBySession(
    sessionId: string,
    options: { include?: Prisma.CartInclude } = {},
  ): Promise<CartWithRelations | null> {
    return (await this.findFirst({
      where: {
        ...buildActiveCartCondition(),
        sessionId,
      },
      include: options.include ?? CART_DEFAULT_INCLUDE,
    })) as CartWithRelations | null;
  }

  async ensureActiveCart(cartId: string): Promise<CartWithRelations> {
    const cart = (await this.findById(cartId, {
      include: CART_DEFAULT_INCLUDE,
    })) as CartWithRelations | null;
    if (!cart || cart.status !== "ACTIVE") {
      throw new NotFoundError("Active cart not found.", { details: { cartId } });
    }

    if (cart.expiresAt && cart.expiresAt <= new Date()) {
      throw new NotFoundError("Cart expired.", { details: { cartId } });
    }

    return cart;
  }

  async addOrUpdateItem(
    cartId: string,
    variantId: string,
    quantity: number,
    unitPrice: Prisma.Decimal | number,
  ): Promise<CartWithRelations> {
    return this.withTransaction(async (repo, tx) => {
      await repo.ensureActiveCart(cartId);

      await tx.cartItem.upsert({
        where: {
          cartId_productVariantId_lineKey: {
            cartId,
            productVariantId: variantId,
            lineKey: "standard",
          },
        },
        update: {
          quantity: { set: quantity },
          unitPrice,
        },
        create: {
          cartId,
          productVariantId: variantId,
          lineKey: "standard",
          quantity,
          unitPrice,
        },
      });

      await tx.cart.update({
        where: { id: cartId },
        data: { updatedAt: new Date() },
      });

      const updated = (await repo.findById(cartId, {
        include: CART_DEFAULT_INCLUDE,
      })) as CartWithRelations | null;
      if (!updated) {
        throw new NotFoundError("Cart not found after update.", { details: { cartId } });
      }

      return updated;
    });
  }

  async removeItem(cartId: string, variantId: string): Promise<void> {
    await this.withTransaction(async (repo, tx) => {
      await repo.ensureActiveCart(cartId);

      await tx.cartItem.delete({
        where: {
          cartId_productVariantId_lineKey: {
            cartId,
            productVariantId: variantId,
            lineKey: "standard",
          },
        },
      });

      await tx.cart.update({
        where: { id: cartId },
        data: { updatedAt: new Date() },
      });
    });
  }

  async clear(cartId: string): Promise<void> {
    await this.withTransaction(async (_repo, tx) => {
      await tx.cartItem.deleteMany({ where: { cartId } });
      await tx.cart.update({
        where: { id: cartId },
        data: { updatedAt: new Date() },
      });
    });
  }

  async mergeCarts(sourceCartId: string, targetCartId: string): Promise<void> {
    if (sourceCartId === targetCartId) {
      return;
    }

    await this.withTransaction(async (repo, tx) => {
      const [source, target] = await Promise.all([
        repo.ensureActiveCart(sourceCartId),
        repo.ensureActiveCart(targetCartId),
      ]);

      const itemOperations = source.items.map((item) => {
        const isStandardLine = item.lineKey === "standard" && !item.customization;

        if (isStandardLine) {
          return tx.cartItem.upsert({
            where: {
              cartId_productVariantId_lineKey: {
                cartId: target.id,
                productVariantId: item.productVariantId,
                lineKey: "standard",
              },
            },
            update: {
              quantity: { increment: item.quantity },
              unitPrice: item.unitPrice,
            },
            create: {
              cartId: target.id,
              productVariantId: item.productVariantId,
              lineKey: "standard",
              quantity: item.quantity,
              unitPrice: item.unitPrice,
            },
          });
        }

        return tx.cartItem.create({
          data: {
            cartId: target.id,
            productVariantId: item.productVariantId,
            lineKey: `line-${randomUUID()}`,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            customization: item.customization
              ? {
                  create: {
                    productId: item.customization.productId,
                    designArea: item.customization.designArea,
                    designData: item.customization.designData as Prisma.InputJsonValue,
                    previewUrl: item.customization.previewUrl,
                    thumbnailUrl: item.customization.thumbnailUrl,
                    layerCount: item.customization.layerCount,
                    hasImages: item.customization.hasImages,
                    hasText: item.customization.hasText,
                  },
                }
              : undefined,
          },
        });
      });

      await Promise.all(itemOperations);

      await Promise.all([
        tx.cart.update({
          where: { id: target.id },
          data: { updatedAt: new Date() },
        }),
        tx.cart.update({
          where: { id: source.id },
          data: { status: "CHECKED_OUT", updatedAt: new Date() },
        }),
      ]);
    });
  }
}
