import { beforeAll, describe, expect, it } from "@jest/globals";
import type { PrismaClient } from "@prisma/client";
import { OrderStatus, PaymentStatus, ReviewStatus } from "@prisma/client";

import { CartRepository } from "@/modules/cart/cart.repository.js";
import { CategoryRepository } from "@/modules/category/category.repository.js";
import { OrderRepository } from "@/modules/order/order.repository.js";
import { PaymentRepository } from "@/modules/payment/payment.repository.js";
import { ProductRepository } from "@/modules/product/product.repository.js";
import { ReviewRepository } from "@/modules/review/review.repository.js";
import { UserRepository } from "@/modules/user/user.repository.js";

import {
  createAddress,
  createCart,
  createCartItem,
  createCategory,
  createOrder,
  createPayment,
  createProductBundle,
  createUser,
} from "../../fixtures/index.js";
import { getTestDatabaseManager } from "../../helpers/db.js";

describe("End-to-end data flows", () => {
  const testDatabase = getTestDatabaseManager();
  let prisma: PrismaClient;
  let userRepository: UserRepository;
  let cartRepository: CartRepository;
  let productRepository: ProductRepository;
  let orderRepository: OrderRepository;
  let paymentRepository: PaymentRepository;
  let reviewRepository: ReviewRepository;
  let categoryRepository: CategoryRepository;

  beforeAll(async () => {
    prisma = await testDatabase.getPrismaClient();
    userRepository = new UserRepository(prisma);
    cartRepository = new CartRepository(prisma);
    productRepository = new ProductRepository(prisma);
    orderRepository = new OrderRepository(prisma);
    paymentRepository = new PaymentRepository(prisma);
    reviewRepository = new ReviewRepository(prisma);
    categoryRepository = new CategoryRepository(prisma);
  });

  it("executes the user registration onboarding flow", async () => {
    const user = await userRepository.create({
      data: {
        email: "member@lumi.com",
        passwordHash: "$2b$12$OSHKWccOvE9nzQKHmNr/HOO0cTffkMMDmZCfoS2xYJ9o6Vqp5/Pli",
        firstName: "Lumi",
        lastName: "Member",
      },
    });

    const address = await createAddress(prisma, { user, isDefault: true });
    await cartRepository.create({
      data: {
        userId: user.id,
        status: "ACTIVE",
        sessionId: "session-registration",
      },
    });

    await userRepository.markEmailVerified(user.id);

    const refreshed = await userRepository.requireById(user.id);
    const defaultAddress = await prisma.address.findFirstOrThrow({ where: { id: address.id } });
    const activeCart = await cartRepository.findActiveCartByUser(user.id);

    expect(refreshed.emailVerified).toBe(true);
    expect(defaultAddress.isDefault).toBe(true);
    expect(activeCart?.status).toBe("ACTIVE");
  });

  it("persists a product with primary variant", async () => {
    const category = await createCategory(prisma);
    const { product } = await createProductBundle(prisma, {
      category,
      primaryVariantStock: 10,
    });

    const hydrated = await productRepository.findBySlug(product.slug);

    expect(hydrated?.variants.some((variant) => variant.isPrimary)).toBe(true);
    expect(hydrated?.categories.some((entry) => entry.categoryId === category.id)).toBe(true);
  });

  it("converts a cart into an order with consistent totals", async () => {
    const user = await createUser(prisma);
    const { product, primaryVariant } = await createProductBundle(prisma);
    const cart = await createCart(prisma, { user });
    await createCartItem(prisma, { cart, variant: primaryVariant, quantity: 2 });

    const order = await createOrder(prisma, {
      user,
      cart,
      items: [{ product, variant: primaryVariant, quantity: 2 }],
      status: OrderStatus.PAID,
    });

    const refreshedCart = await prisma.cart.findUniqueOrThrow({ where: { id: cart.id } });
    const ordersForUser = await orderRepository.listForUser(user.id, { page: 1, pageSize: 5 });

    expect(order.items).toHaveLength(1);
    expect(order.totalAmount.toNumber()).toBeGreaterThan(0);
    expect(ordersForUser.items[0]?.id).toBe(order.id);
    expect(refreshedCart.userId).toBe(user.id);
  });

  it("records and settles payments for an order", async () => {
    const user = await createUser(prisma);
    const { product, primaryVariant } = await createProductBundle(prisma);
    const order = await createOrder(prisma, {
      user,
      items: [{ product, variant: primaryVariant, quantity: 1 }],
      status: OrderStatus.PENDING,
    });
    const payment = await createPayment(prisma, { order, user, status: PaymentStatus.AUTHORIZED });

    const settled = await paymentRepository.updateStatus(payment.id, PaymentStatus.SETTLED, {
      settledAt: new Date(),
    });

    expect(settled.status).toBe(PaymentStatus.SETTLED);
    expect(settled.settledAt).toBeInstanceOf(Date);
  });

  it("submits and moderates product reviews", async () => {
    const user = await createUser(prisma);
    const { product } = await createProductBundle(prisma);
    const review = await reviewRepository.submitReview({
      product: { connect: { id: product.id } },
      user: { connect: { id: user.id } },
      rating: 5,
      title: "Brilliant",
      content: "Excellent quality",
      status: ReviewStatus.PENDING,
    });

    await reviewRepository.moderateReview(review.id, ReviewStatus.APPROVED, "Looks good");

    const listed = await reviewRepository.listForProduct(product.id, {
      status: ReviewStatus.APPROVED,
    });
    expect(listed.items).toHaveLength(1);
    expect(listed.items[0]?.status).toBe(ReviewStatus.APPROVED);
    expect(listed.items[0]?.content).toContain("Moderation note");
  });

  it("builds category hierarchy traversal results", async () => {
    const root = await createCategory(prisma, { name: "Root" });
    const child = await createCategory(prisma, { parent: root, name: "Child" });
    await createCategory(prisma, { parent: child, name: "Grandchild" });

    const hierarchy = await categoryRepository.getHierarchy();
    expect(hierarchy).toHaveLength(1);
    expect(hierarchy[0]?.children).toHaveLength(1);
    expect(hierarchy[0]?.children[0]?.children).toHaveLength(1);

    const breadcrumbs = await categoryRepository.getBreadcrumbs(child.id);
    expect(breadcrumbs.map((entry) => entry.id)).toEqual(
      expect.arrayContaining([root.id, child.id]),
    );
  });
});
