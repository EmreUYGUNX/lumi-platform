// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

/* eslint-disable unicorn/no-null */
import { describe, expect, it, jest } from "@jest/globals";
import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

import { NotFoundError } from "@/lib/errors.js";

import { AddressRepository } from "../address/address.repository";
import { CartRepository } from "../cart/cart.repository";
import { CategoryRepository } from "../category/category.repository";
import { MediaRepository } from "../media/media.repository";
import { OrderRepository } from "../order/order.repository";
import { PaymentRepository } from "../payment/payment.repository";
import { ProductRepository, type ProductSearchFilters } from "../product/product.repository";
import { ReviewRepository } from "../review/review.repository";
import { UserRepository } from "../user/user.repository";

type MockDelegate = Record<string, jest.Mock>;

const createPrismaStub = (
  delegates: Record<string, MockDelegate>,
  transactionDelegates: Record<string, MockDelegate> = delegates,
): PrismaClient => {
  const prisma: Record<string, MockDelegate> & { $transaction: jest.Mock } = {
    $transaction: jest.fn(),
  };

  Object.entries(delegates).forEach(([key, methods]) => {
    prisma[key] = methods;
  });

  prisma.$transaction.mockImplementation(
    async (callback: (client: Prisma.TransactionClient) => Promise<unknown>) => {
      const tx: Record<string, MockDelegate> = {};
      Object.entries(transactionDelegates).forEach(([key, methods]) => {
        tx[key] = methods;
      });

      return callback(tx as unknown as Prisma.TransactionClient);
    },
  );

  return prisma as unknown as PrismaClient;
};

describe("Repository layer", () => {
  it("UserRepository.findByEmail requests relations when required", async () => {
    const delegates: Record<string, MockDelegate> = {
      user: {
        findFirst: jest.fn().mockResolvedValue(),
        update: jest.fn(),
      },
    };

    const prisma = createPrismaStub(delegates);
    const repository = new UserRepository(prisma);

    await repository.findByEmail("test@example.com", {
      includeRoles: true,
      includePermissions: true,
    });

    expect(delegates.user.findFirst).toHaveBeenCalledWith({
      where: { email: "test@example.com", status: undefined },
      include: {
        roles: { include: { role: true } },
        permissions: { include: { permission: true } },
      },
      select: undefined,
    });
  });

  it("ProductRepository.search applies filters and pagination", async () => {
    const delegates: Record<string, MockDelegate> = {
      product: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([{ id: "product-1" }]),
      },
    };

    const prisma = createPrismaStub(delegates);
    const repository = new ProductRepository(prisma);

    await repository.search({ term: "Phone", statuses: ["ACTIVE"] }, { page: 1, pageSize: 10 });

    const findManyArgs = delegates.product.findMany.mock
      .calls[0]?.[0] as Prisma.ProductFindManyArgs;
    expect(findManyArgs).toBeDefined();

    const whereClause = findManyArgs.where as Prisma.ProductWhereInput;
    expect(whereClause?.AND).toBeInstanceOf(Array);

    const nestedAnd = Array.isArray(whereClause?.AND) ? whereClause.AND.at(-1) : undefined;
    const finalFilter =
      nestedAnd && "AND" in nestedAnd && Array.isArray(nestedAnd.AND)
        ? nestedAnd.AND.at(-1)
        : nestedAnd;

    expect(finalFilter).toEqual(
      expect.objectContaining({
        status: "ACTIVE",
        OR: expect.any(Array),
      }),
    );
  });

  it("ProductRepository.searchWithCursor returns cursor metadata", async () => {
    const delegates: Record<string, MockDelegate> = {
      product: {
        count: jest.fn(),
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: "product-1" }, { id: "product-2" }, { id: "product-3" }]),
      },
    };

    const prisma = createPrismaStub(delegates);
    const repository = new ProductRepository(prisma as unknown as PrismaClient);

    const result = await repository.searchWithCursor({} as ProductSearchFilters, {
      take: 2,
    });

    expect(delegates.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 3,
      }),
    );
    expect(result.nextCursor).toEqual({ id: "product-2" });
    expect(result.hasMore).toBe(true);
  });

  it("ProductRepository.attachMedia performs transactional upsert", async () => {
    const delegates: Record<string, MockDelegate> = {
      product: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
    };

    const transactionDelegates: Record<string, MockDelegate> = {
      ...delegates,
      productMedia: {
        upsert: jest.fn(),
      },
    };

    const prisma = createPrismaStub(delegates, transactionDelegates);
    const repository = new ProductRepository(prisma);

    await repository.attachMedia("prod-1", "media-1", 1);

    expect(transactionDelegates.productMedia.upsert).toHaveBeenCalledWith({
      where: { productId_mediaId: { productId: "prod-1", mediaId: "media-1" } },
      update: { sortOrder: 1 },
      create: { productId: "prod-1", mediaId: "media-1", sortOrder: 1 },
    });
  });

  it("CategoryRepository.getHierarchy builds nested structure", async () => {
    const delegates: Record<string, MockDelegate> = {
      category: {
        findMany: jest.fn().mockResolvedValue([
          { id: "root", parentId: undefined, children: [], level: 0 },
          { id: "child", parentId: "root", children: [], level: 1 },
        ]),
      },
    };

    const prisma = createPrismaStub(delegates);
    const repository = new CategoryRepository(prisma);

    const hierarchy = await repository.getHierarchy();
    expect(hierarchy).toHaveLength(1);
    expect(hierarchy[0].children).toHaveLength(1);
  });

  it("CategoryRepository.getBreadcrumbs returns empty list when category is missing", async () => {
    const delegates: Record<string, MockDelegate> = {
      category: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn(),
      },
    };

    const prisma = createPrismaStub(delegates);
    const repository = new CategoryRepository(prisma);

    await expect(repository.getBreadcrumbs("missing")).resolves.toEqual([]);
    expect(delegates.category.findMany).not.toHaveBeenCalled();
  });

  it("CategoryRepository.getBreadcrumbs builds lookup segments from paths", async () => {
    const delegates: Record<string, MockDelegate> = {
      category: {
        findFirst: jest.fn().mockResolvedValue({
          id: "lighting",
          parentId: "home",
          slug: "lighting",
          path: "/home",
        }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const prisma = createPrismaStub(delegates);
    const repository = new CategoryRepository(prisma);

    await repository.getBreadcrumbs("lighting");

    const findManyArgs = delegates.category.findMany.mock
      .calls[0]?.[0] as Prisma.CategoryFindManyArgs;
    const where = findManyArgs?.where as Prisma.CategoryWhereInput;
    const orClauses = Array.isArray(where?.OR) ? where?.OR : [];
    expect(orClauses).toContainEqual({ id: { in: ["home", "lighting"] } });
    expect(orClauses).toContainEqual({ slug: { in: ["home", "lighting"] } });
  });

  it("CategoryRepository.getTopLevel applies limit and ordering", async () => {
    const delegates: Record<string, MockDelegate> = {
      category: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const prisma = createPrismaStub(delegates);
    const repository = new CategoryRepository(prisma);

    await repository.getTopLevel(5);

    expect(delegates.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { level: 0 },
        take: 5,
      }),
    );
  });

  it("OrderRepository.updateStatus increments version and sets timestamps", async () => {
    const orderRecord = { id: "order-1", status: "PENDING", version: 3 };

    const delegates: Record<string, MockDelegate> = {
      order: {
        findFirst: jest.fn().mockResolvedValue(orderRecord),
      },
    };

    const transactionDelegates: Record<string, MockDelegate> = {
      order: {
        update: jest.fn().mockImplementation(async ({ data }) => ({
          ...orderRecord,
          status: data.status,
          version: orderRecord.version + 1,
          fulfilledAt: data.fulfilledAt,
        })),
        findFirst: delegates.order.findFirst,
      },
    };

    const prisma = createPrismaStub(delegates, transactionDelegates);
    const repository = new OrderRepository(prisma);

    const updated = await repository.updateStatus("order-1", "FULFILLED", { version: 3 });

    expect(updated.status).toBe("FULFILLED");
    expect(transactionDelegates.order.update).toHaveBeenCalled();
  });

  it("CartRepository.addOrUpdateItem orchestrates cart item changes", async () => {
    const cartRecord = {
      id: "cart-1",
      status: "ACTIVE",
      expiresAt: undefined,
      items: [],
    };

    const delegates: Record<string, MockDelegate> = {
      cart: {
        findFirst: jest.fn().mockResolvedValue(cartRecord),
      },
    };

    const transactionDelegates: Record<string, MockDelegate> = {
      cart: {
        findFirst: delegates.cart.findFirst,
        update: jest.fn(),
      },
      cartItem: {
        upsert: jest.fn(),
      },
    };

    const prisma = createPrismaStub(delegates, transactionDelegates);
    const repository = new CartRepository(prisma);

    await repository.addOrUpdateItem("cart-1", "variant-1", 2, 99.5);

    expect(transactionDelegates.cartItem.upsert).toHaveBeenCalledWith({
      where: {
        cartId_productVariantId: {
          cartId: "cart-1",
          productVariantId: "variant-1",
        },
      },
      update: {
        quantity: { set: 2 },
        unitPrice: 99.5,
      },
      create: {
        cartId: "cart-1",
        productVariantId: "variant-1",
        quantity: 2,
        unitPrice: 99.5,
      },
    });
  });

  it("PaymentRepository.updateStatus delegates to update", async () => {
    const paymentRecord = { id: "payment-1" };

    const delegates: Record<string, MockDelegate> = {
      payment: {
        findFirst: jest.fn().mockResolvedValue(paymentRecord),
        update: jest.fn(),
      },
    };

    const prisma = createPrismaStub(delegates);
    const repository = new PaymentRepository(prisma);

    await repository.updateStatus("payment-1", "AUTHORIZED");

    expect(delegates.payment.update).toHaveBeenCalledWith({
      where: { id: "payment-1" },
      data: expect.objectContaining({ status: "AUTHORIZED" }),
    });
  });

  it("ReviewRepository.listForProduct applies status filter", async () => {
    const delegates: Record<string, MockDelegate> = {
      review: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const prisma = createPrismaStub(delegates);
    const repository = new ReviewRepository(prisma);

    await repository.listForProduct("product-1", { status: "APPROVED" });

    expect(delegates.review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { productId: "product-1", status: "APPROVED" },
      }),
    );
  });

  it("MediaRepository.createAsset delegates to Prisma client", async () => {
    const delegates: Record<string, MockDelegate> = {
      mediaAsset: {
        create: jest.fn().mockResolvedValue({ id: "asset-1" }),
      },
    };

    const prisma = createPrismaStub(delegates);
    const repository = new MediaRepository(prisma);

    await repository.createAsset({
      publicId: "lumi/products/asset-1",
      url: "https://cdn.example.com/image.jpg",
      secureUrl: "https://cdn.example.com/image.jpg",
      format: "jpg",
      bytes: 512_000,
      uploadedBy: {
        connect: { id: "user-1" },
      },
    });

    expect(delegates.mediaAsset.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        publicId: "lumi/products/asset-1",
        uploadedBy: { connect: { id: "user-1" } },
      }),
    });
  });

  it("MediaRepository.list applies relation filters", async () => {
    const delegates: Record<string, MockDelegate> = {
      mediaAsset: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const prisma = createPrismaStub(delegates);
    const repository = new MediaRepository(prisma);

    await repository.list({ productId: "product-1", tag: "hero" }, { page: 1, pageSize: 10 });

    const findManyArgs = delegates.mediaAsset.findMany.mock
      .calls[0]?.[0] as Prisma.MediaAssetFindManyArgs;
    expect(findManyArgs).toBeDefined();

    const where = findManyArgs.where as Prisma.MediaAssetWhereInput;
    const findRelationFilter = (
      input?: Prisma.MediaAssetWhereInput,
    ): Prisma.MediaAssetWhereInput | undefined => {
      if (!input) {
        return undefined;
      }

      if ("products" in input || "tags" in input) {
        return input;
      }

      if (Array.isArray(input.AND)) {
        const nested = input.AND.map((clause) =>
          findRelationFilter(clause as Prisma.MediaAssetWhereInput),
        ).find(Boolean);
        if (nested) {
          return nested;
        }
      }

      return undefined;
    };

    const normalizedWhere = findRelationFilter(where);

    expect(normalizedWhere).toEqual(
      expect.objectContaining({
        products: { some: { id: "product-1" } },
        tags: { has: "hero" },
      }),
    );
  });

  it("MediaRepository.softDeleteAsset delegates to base soft delete", async () => {
    const delegates: Record<string, MockDelegate> = {
      mediaAsset: {
        update: jest.fn().mockResolvedValue({ id: "asset-1" }),
      },
    };

    const prisma = createPrismaStub(delegates);
    const repository = new MediaRepository(prisma);

    await repository.softDeleteAsset("asset-1");

    expect(delegates.mediaAsset.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "asset-1" },
        data: { deletedAt: expect.any(Date) },
      }),
    );
  });

  it("MediaRepository.findOrphans filters unattached assets", async () => {
    const delegates: Record<string, MockDelegate> = {
      mediaAsset: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const prisma = createPrismaStub(delegates);
    const repository = new MediaRepository(prisma);

    await repository.findOrphans(25);

    const findManyArgs = delegates.mediaAsset.findMany.mock
      .calls[0]?.[0] as Prisma.MediaAssetFindManyArgs;
    const where = findManyArgs.where as Prisma.MediaAssetWhereInput;
    const relationFilter = Array.isArray(where?.AND)
      ? (where.AND.find(
          (entry) => "products" in entry || "productVariants" in entry,
        ) as Prisma.MediaAssetWhereInput)
      : where;

    expect(relationFilter).toEqual(
      expect.objectContaining({
        products: { none: {} },
        productVariants: { none: {} },
      }),
    );
    expect(findManyArgs.take).toBe(25);
  });

  it("AddressRepository.setDefaultAddress toggles default flags", async () => {
    const delegates: Record<string, MockDelegate> = {
      address: {
        findFirst: jest.fn().mockResolvedValue({ id: "address-1" }),
      },
    };

    const transactionDelegates: Record<string, MockDelegate> = {
      address: {
        findFirst: delegates.address.findFirst,
        updateMany: jest.fn(),
        update: jest.fn(),
      },
    };

    const prisma = createPrismaStub(delegates, transactionDelegates);
    const repository = new AddressRepository(prisma);

    await repository.setDefaultAddress("user-1", "address-1");

    expect(transactionDelegates.address.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: { isDefault: false },
    });
    expect(transactionDelegates.address.update).toHaveBeenCalledWith({
      where: { id: "address-1" },
      data: { isDefault: true },
    });
  });

  it("UserRepository manages authentication state", async () => {
    const update = jest.fn();
    const delegates: Record<string, MockDelegate> = {
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: "user-1" }),
        update,
      },
    };

    const prisma = createPrismaStub(delegates);
    const repository = new UserRepository(prisma);

    await repository.incrementFailedLoginAttempts("user-1");
    await repository.resetFailedLoginState("user-1");
    await repository.setLockout("user-1", new Date("2025-01-01T00:00:00Z"));
    await repository.markEmailVerified("user-1");
    await repository.enableTwoFactor("user-1", "secret-value");
    await repository.disableTwoFactor("user-1");

    expect(update).toHaveBeenCalled();
  });

  it("UserRepository.findByEmail normalises input and merges include options", async () => {
    const delegates: Record<string, MockDelegate> = {
      user: {
        findFirst: jest.fn(),
      },
    };

    const prisma = createPrismaStub(delegates);
    const repository = new UserRepository(prisma);

    await repository.findByEmail("  Admin@Example.COM  ", {
      includeRoles: true,
      includePermissions: true,
      include: {
        profile: true,
      },
      select: { id: true },
      requireActive: true,
    });

    const findFirstArgs = delegates.user.findFirst.mock.calls[0]?.[0] as Prisma.UserFindFirstArgs;
    expect(findFirstArgs?.where).toEqual({ email: "admin@example.com", status: "ACTIVE" });
    expect(findFirstArgs?.include).toEqual({
      roles: { include: { role: true } },
      permissions: { include: { permission: true } },
      profile: true,
    });
    expect(findFirstArgs?.select).toEqual({ id: true });
  });

  it("UserRepository.requireById throws NotFoundError when user does not exist", async () => {
    const delegates: Record<string, MockDelegate> = {
      user: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    const prisma = createPrismaStub(delegates);
    const repository = new UserRepository(prisma);

    await expect(repository.requireById("missing-user")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("ProductRepository covers association helpers", async () => {
    const productRecord = { id: "product-1", slug: "demo", status: "ACTIVE" };

    const delegates: Record<string, MockDelegate> = {
      product: {
        findFirst: jest.fn().mockResolvedValue(productRecord),
        findMany: jest.fn().mockResolvedValue([productRecord]),
      },
    };

    const transactionDelegates: Record<string, MockDelegate> = {
      ...delegates,
      productMedia: {
        upsert: jest.fn(),
        delete: jest.fn(),
      },
      productCategory: {
        upsert: jest.fn(),
      },
    };

    const prisma = createPrismaStub(delegates, transactionDelegates);
    const repository = new ProductRepository(prisma as unknown as PrismaClient);

    await repository.findBySlug("demo");
    await repository.listActiveProducts();
    await repository.detachMedia("product-1", "media-1");
    await repository.addToCategory("product-1", "category-1", true);

    const listArgs = delegates.product.findMany.mock.calls[0]?.[0] as Prisma.ProductFindManyArgs;
    expect(listArgs?.select).toBeDefined();
    expect(listArgs?.select).toEqual(
      expect.objectContaining({
        id: true,
        title: true,
        productMedia: expect.any(Object),
      }),
    );

    expect(transactionDelegates.productMedia.delete).toHaveBeenCalled();
    expect(transactionDelegates.productCategory.upsert).toHaveBeenCalled();
  });

  it("ReviewRepository submits and moderates entries", async () => {
    const delegates: Record<string, MockDelegate> = {
      review: {
        findFirst: jest.fn().mockResolvedValue({ id: "review-1", content: "" }),
        update: jest.fn(),
      },
    };

    const transactionDelegates: Record<string, MockDelegate> = {
      review: {
        create: jest.fn().mockResolvedValue({ id: "review-1" }),
        findFirst: delegates.review.findFirst,
        update: jest.fn(),
      },
    };

    const prisma = createPrismaStub(delegates, transactionDelegates);
    const repository = new ReviewRepository(prisma);

    await repository.submitReview({
      content: "Great product",
      rating: 5,
      product: { connect: { id: "product-1" } },
      user: { connect: { id: "user-1" } },
    });
    await repository.moderateReview("review-1", "APPROVED", "looks good");

    expect(transactionDelegates.review.create).toHaveBeenCalled();
    expect(delegates.review.findFirst).toHaveBeenCalled();
  });

  it("PaymentRepository lists orders and records refunds", async () => {
    const delegates: Record<string, MockDelegate> = {
      payment: {
        findMany: jest.fn().mockResolvedValue([{ id: "payment-1" }]),
        findFirst: jest.fn().mockResolvedValue({ id: "payment-1" }),
        update: jest.fn(),
      },
    };

    const transactionDelegates: Record<string, MockDelegate> = {
      paymentRefund: {
        create: jest.fn(),
      },
      payment: delegates.payment,
    };

    const prisma = createPrismaStub(delegates, transactionDelegates);
    const repository = new PaymentRepository(prisma);

    await repository.listForOrder("order-1");
    await repository.recordRefund("payment-1", {
      amount: new Prisma.Decimal(10),
      currency: "TRY",
      status: "COMPLETED",
    });

    expect(delegates.payment.findMany).toHaveBeenCalled();
    expect(transactionDelegates.paymentRefund.create).toHaveBeenCalled();
  });

  it("CartRepository clears and merges items", async () => {
    const cartA = {
      id: "cart-1",
      status: "ACTIVE",
      expiresAt: undefined,
      items: [
        {
          cartId: "cart-1",
          productVariantId: "variant-2",
          quantity: 2,
          unitPrice: new Prisma.Decimal(50),
        },
        {
          cartId: "cart-1",
          productVariantId: "variant-3",
          quantity: 1,
          unitPrice: new Prisma.Decimal(25),
        },
      ],
    };
    const cartB = {
      id: "cart-2",
      status: "ACTIVE",
      expiresAt: undefined,
      items: [
        {
          cartId: "cart-2",
          productVariantId: "variant-2",
          quantity: 1,
          unitPrice: new Prisma.Decimal(50),
        },
      ],
    };

    const cartLookup = new Map([
      [cartA.id, cartA],
      [cartB.id, cartB],
    ]);

    const cartFindFirst = jest.fn().mockImplementation((args: Prisma.CartFindFirstArgs = {}) => {
      const where = args.where as { id?: string | { equals?: string } } | undefined;
      const idFilter = where?.id;
      const cartId =
        typeof idFilter === "string"
          ? idFilter
          : typeof idFilter === "object"
            ? idFilter?.equals
            : undefined;

      const resolvedId = cartId ?? "__missing_cart__";
      return cartLookup.get(resolvedId);
    });

    const delegates: Record<string, MockDelegate> = {
      cart: {
        findFirst: cartFindFirst,
      },
    };

    const transactionDelegates: Record<string, MockDelegate> = {
      cart: {
        findFirst: delegates.cart.findFirst,
        update: jest.fn(),
      },
      cartItem: {
        delete: jest.fn(),
        deleteMany: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
      },
    };

    const prisma = createPrismaStub(delegates, transactionDelegates);
    const repository = new CartRepository(prisma);

    await repository.removeItem("cart-1", "variant-1");
    await repository.clear("cart-1");
    await repository.mergeCarts("cart-1", "cart-2");

    expect(transactionDelegates.cartItem.deleteMany).toHaveBeenCalled();
    expect(transactionDelegates.cartItem.update).toHaveBeenCalled();
    expect(transactionDelegates.cartItem.create).toHaveBeenCalled();
  });

  it("CartRepository mergeCarts exits early for identical carts", async () => {
    const delegates: Record<string, MockDelegate> = {
      cart: {
        findFirst: jest.fn(),
      },
    };

    const prisma = createPrismaStub(delegates) as PrismaClient & { $transaction: jest.Mock };
    const repository = new CartRepository(prisma);

    await repository.mergeCarts("cart-1", "cart-1");

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("CartRepository.ensureActiveCart rejects missing or inactive carts", async () => {
    const inactiveCart = {
      id: "cart-1",
      status: "PENDING",
      items: [],
      expiresAt: undefined,
    };
    const findFirst = jest.fn().mockResolvedValueOnce(null).mockResolvedValue(inactiveCart);

    const delegates: Record<string, MockDelegate> = {
      cart: {
        findFirst,
      },
    };

    const prisma = createPrismaStub(delegates);
    const repository = new CartRepository(prisma);

    await expect(repository.ensureActiveCart("cart-1")).rejects.toBeInstanceOf(NotFoundError);

    await expect(repository.ensureActiveCart("cart-1")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("CartRepository.ensureActiveCart rejects expired carts", async () => {
    const delegates: Record<string, MockDelegate> = {
      cart: {
        findFirst: jest.fn().mockResolvedValue({
          id: "cart-2",
          status: "ACTIVE",
          items: [],
          expiresAt: new Date(Date.now() - 60_000),
        }),
      },
    };

    const prisma = createPrismaStub(delegates);
    const repository = new CartRepository(prisma);

    await expect(repository.ensureActiveCart("cart-2")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("CartRepository.addOrUpdateItem throws when updated cart cannot be reloaded", async () => {
    const activeCart = {
      id: "cart-3",
      status: "ACTIVE",
      items: [],
      expiresAt: undefined,
    };

    const findFirst = jest.fn().mockResolvedValueOnce(activeCart).mockResolvedValueOnce(null);

    const delegates: Record<string, MockDelegate> = {
      cart: {
        findFirst,
      },
    };

    const transactionDelegates: Record<string, MockDelegate> = {
      cart: {
        findFirst,
        update: jest.fn(),
      },
      cartItem: {
        upsert: jest.fn(),
      },
    };

    const prisma = createPrismaStub(delegates, transactionDelegates);
    const repository = new CartRepository(prisma);

    await expect(
      repository.addOrUpdateItem("cart-3", "variant-1", 1, new Prisma.Decimal(10)),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("OrderRepository supports listing helpers", async () => {
    const orderRecord = { id: "order-1", status: "PENDING" };

    const delegates: Record<string, MockDelegate> = {
      order: {
        findFirst: jest.fn().mockResolvedValue(orderRecord),
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: "order-1" }, { id: "order-2" }, { id: "order-3" }]),
        count: jest.fn().mockResolvedValue(1),
        update: jest.fn(),
      },
    };

    const prisma = createPrismaStub(delegates);
    const repository = new OrderRepository(prisma);

    await repository.findByReference("order-1");
    await repository.listByStatus("PENDING", { page: 1, pageSize: 1 });
    await repository.listForUser("user-1", { page: 1, pageSize: 1 });
    await repository.listForUserHistory("user-1", { pageSize: 1 });
    await repository.listForUserCursor("user-1", { take: 1 });
    await repository.attachPayment("order-1", "payment-1");

    expect(delegates.order.findMany).toHaveBeenCalled();
    const cursorCall = delegates.order.findMany.mock.calls.at(-1)?.[0] as Prisma.OrderFindManyArgs;
    expect(cursorCall?.select).toEqual(expect.objectContaining({ id: true, reference: true }));
    expect(cursorCall?.take).toBe(2);
    expect(delegates.order.update).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: expect.objectContaining({ payments: { connect: { id: "payment-1" } } }),
    });
  });
});
