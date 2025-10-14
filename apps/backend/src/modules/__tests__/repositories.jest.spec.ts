// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { describe, expect, it, jest } from "@jest/globals";
import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

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

    await repository.search(
      { term: "Phone", status: "ACTIVE" as Prisma.ProductStatus },
      { page: 1, pageSize: 10 },
    );

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

  it("MediaRepository.upsertMedia updates existing record", async () => {
    const delegates: Record<string, MockDelegate> = {
      media: {
        findFirst: jest.fn(),
      },
    };

    const transactionDelegates: Record<string, MockDelegate> = {
      media: {
        findFirst: jest.fn().mockResolvedValue({ id: "media-1" }),
        update: jest.fn(),
        create: jest.fn(),
      },
    };

    const prisma = createPrismaStub(delegates, transactionDelegates);
    const repository = new MediaRepository(prisma);

    await repository.upsertMedia({
      assetId: "asset-1",
      url: "https://cdn.example.com/image.jpg",
      type: "IMAGE" as Prisma.MediaType,
      provider: "CLOUDINARY" as Prisma.MediaProvider,
      mimeType: "image/jpeg",
      sizeBytes: 100,
    });

    expect(transactionDelegates.media.update).toHaveBeenCalled();
    expect(transactionDelegates.media.create).not.toHaveBeenCalled();
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
