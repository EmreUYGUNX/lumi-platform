import { faker } from "@faker-js/faker";
import {
  type Address,
  type Cart,
  type CartItem,
  CartStatus,
  type Category,
  type Media,
  MediaProvider,
  MediaType,
  type Order,
  OrderStatus,
  type Payment,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  type PrismaClient,
  type Product,
  ProductStatus,
  type ProductVariant,
  type Review,
  ReviewStatus,
  type User,
  UserStatus,
} from "@prisma/client";

export const TEST_PASSWORD_HASH = "$2b$12$OSHKWccOvE9nzQKHmNr/HOO0cTffkMMDmZCfoS2xYJ9o6Vqp5/Pli";
const DEFAULT_CURRENCY = "TRY";

const toDecimal = (value: number | Prisma.Decimal): Prisma.Decimal =>
  value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);

const uniqueSlug = (base: string) =>
  `${faker.helpers.slugify(base.toLowerCase())}-${faker.string.alphanumeric(6).toLowerCase()}`;

export interface CreateUserOptions {
  email?: string;
  passwordHash?: string;
  status?: UserStatus;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export const createUser = async (
  prisma: PrismaClient,
  options: CreateUserOptions = {},
): Promise<User> => {
  const email = options.email ?? faker.internet.email().toLowerCase();
  const data = {
    email,
    passwordHash: options.passwordHash ?? TEST_PASSWORD_HASH,
    firstName: options.firstName ?? faker.person.firstName(),
    lastName: options.lastName ?? faker.person.lastName(),
    phone: options.phone,
    status: options.status ?? UserStatus.ACTIVE,
  };

  return prisma.user.create({ data });
};

export interface CreateCategoryOptions {
  parent?: Category;
  name?: string;
  slug?: string;
  level?: number;
  path?: string;
}

export const createCategory = async (
  prisma: PrismaClient,
  options: CreateCategoryOptions = {},
): Promise<Category> => {
  const {
    parent,
    name: providedName,
    slug: providedSlug,
    level: providedLevel,
    path: providedPath,
  } = options;
  const name = providedName ?? faker.commerce.department();
  const slug = providedSlug ?? uniqueSlug(name);
  const level = providedLevel ?? (parent ? parent.level + 1 : 0);
  const parentPath = parent
    ? parent.path.endsWith("/")
      ? parent.path.slice(0, -1)
      : parent.path
    : undefined;
  const path = providedPath ?? (parentPath ? `${parentPath}/${slug}` : `/${slug}`);

  return prisma.category.create({
    data: {
      name,
      slug,
      level,
      path,
      description: faker.lorem.sentence(),
      parent: parent ? { connect: { id: parent.id } } : undefined,
    },
  });
};

export interface CreateProductOptions {
  status?: ProductStatus;
  price?: number;
  compareAtPrice?: number;
  currency?: string;
  category?: Category;
  includePrimaryVariant?: boolean;
  primaryVariantPrice?: number;
  primaryVariantStock?: number;
  searchKeywords?: string[];
}

export interface CreatedProductBundle {
  product: Product;
  primaryVariant: ProductVariant;
}

export const createProductBundle = async (
  prisma: PrismaClient,
  options: CreateProductOptions = {},
): Promise<CreatedProductBundle> => {
  const title = faker.commerce.productName();
  const slug = uniqueSlug(title);
  const price = toDecimal(options.price ?? Number(faker.commerce.price({ min: 50, max: 500 })));
  const compareAtPrice = options.compareAtPrice ? toDecimal(options.compareAtPrice) : undefined;

  const product = await prisma.product.create({
    data: {
      title,
      slug,
      summary: faker.commerce.productDescription(),
      description: faker.lorem.paragraph(),
      price,
      compareAtPrice,
      status: options.status ?? ProductStatus.ACTIVE,
      currency: options.currency ?? DEFAULT_CURRENCY,
      inventoryPolicy: "TRACK",
      searchKeywords: options.searchKeywords ?? [title.toLowerCase(), slug],
      categories: options.category
        ? {
            create: {
              categoryId: options.category.id,
              isPrimary: true,
            },
          }
        : undefined,
    },
  });

  const primaryVariantPrice = toDecimal(options.primaryVariantPrice ?? Number(price.toNumber()));

  const primaryVariant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      title: `${title} Primary`,
      sku: uniqueSlug(`SKU-${title}`),
      price: primaryVariantPrice,
      stock: options.primaryVariantStock ?? 25,
      isPrimary: options.includePrimaryVariant ?? true,
      inventory: {
        create: {
          quantityAvailable: options.primaryVariantStock ?? 25,
          quantityOnHand: options.primaryVariantStock ?? 25,
        },
      },
    },
  });

  return { product, primaryVariant };
};

export interface CreateMediaOptions {
  type?: MediaType;
  provider?: MediaProvider;
}

export const createMedia = async (
  prisma: PrismaClient,
  options: CreateMediaOptions = {},
): Promise<Media> =>
  prisma.media.create({
    data: {
      assetId: faker.string.uuid(),
      url: faker.internet.url(),
      type: options.type ?? MediaType.IMAGE,
      provider: options.provider ?? MediaProvider.CLOUDINARY,
      mimeType: "image/jpeg",
      sizeBytes: faker.number.int({ min: 1024, max: 5_242_880 }),
      width: 1200,
      height: 800,
      alt: faker.commerce.productAdjective(),
    },
  });

export interface CreateCartOptions {
  user?: User;
  status?: CartStatus;
  sessionId?: string;
  expiresAt?: Date;
}

export const createCart = async (
  prisma: PrismaClient,
  options: CreateCartOptions = {},
): Promise<Cart> =>
  prisma.cart.create({
    data: {
      status: options.status ?? CartStatus.ACTIVE,
      sessionId: options.sessionId ?? faker.string.uuid(),
      expiresAt: options.expiresAt,
      user: options.user ? { connect: { id: options.user.id } } : undefined,
    },
    include: {
      items: true,
    },
  });

export interface CreateCartItemOptions {
  cart: Cart;
  variant: ProductVariant;
  quantity?: number;
  unitPrice?: number | Prisma.Decimal;
}

export const createCartItem = async (
  prisma: PrismaClient,
  options: CreateCartItemOptions,
): Promise<CartItem> => {
  const quantity = options.quantity ?? faker.number.int({ min: 1, max: 3 });
  const unitPrice = toDecimal(options.unitPrice ?? Number(options.variant.price));

  return prisma.cartItem.create({
    data: {
      cartId: options.cart.id,
      productVariantId: options.variant.id,
      quantity,
      unitPrice,
    },
  });
};

export interface CreateAddressOptions {
  user: User;
  isDefault?: boolean;
  label?: string;
  city?: string;
  country?: string;
}

export const createAddress = async (
  prisma: PrismaClient,
  options: CreateAddressOptions,
): Promise<Address> =>
  prisma.address.create({
    data: {
      userId: options.user.id,
      label: options.label ?? "Home",
      fullName: `${options.user.firstName ?? "Test"} ${options.user.lastName ?? "User"}`,
      line1: faker.location.streetAddress(),
      city: options.city ?? faker.location.city(),
      country: options.country ?? "TR",
      postalCode: faker.location.zipCode(),
      phone: faker.phone.number(),
      isDefault: options.isDefault ?? true,
    },
  });

export interface OrderItemInput {
  product: Product;
  variant: ProductVariant;
  quantity?: number;
  unitPrice?: number | Prisma.Decimal;
}

export interface CreateOrderOptions {
  user?: User;
  cart?: Cart;
  items: OrderItemInput[];
  status?: OrderStatus;
  currency?: string;
  placedAt?: Date;
  shippingAddress?: Address;
  billingAddress?: Address;
}

export const createOrder = async (
  prisma: PrismaClient,
  options: CreateOrderOptions,
): Promise<Prisma.OrderGetPayload<{ include: { items: true } }>> => {
  const items = options.items.map((item) => ({
    productId: item.product.id,
    productVariantId: item.variant.id,
    quantity: item.quantity ?? 1,
    unitPrice: toDecimal(item.unitPrice ?? Number(item.variant.price)),
    currency: options.currency ?? DEFAULT_CURRENCY,
    titleSnapshot: item.product.title,
    variantSnapshot: {
      title: item.variant.title,
      sku: item.variant.sku,
    },
  }));

  let subtotal = new Prisma.Decimal(0);
  items.forEach(({ unitPrice, quantity }) => {
    subtotal = subtotal.add(toDecimal(unitPrice).mul(quantity));
  });
  subtotal = subtotal.toDecimalPlaces(2);

  const taxes = subtotal.mul(0.18).toDecimalPlaces(2);
  const total = subtotal.add(taxes);

  return prisma.order.create({
    data: {
      reference: uniqueSlug("order"),
      user: options.user ? { connect: { id: options.user.id } } : undefined,
      cart: options.cart ? { connect: { id: options.cart.id } } : undefined,
      status: options.status ?? OrderStatus.PENDING,
      subtotalAmount: subtotal,
      taxAmount: taxes,
      discountAmount: new Prisma.Decimal(0),
      totalAmount: total,
      currency: options.currency ?? DEFAULT_CURRENCY,
      placedAt: options.placedAt,
      shippingAddress: options.shippingAddress
        ? { connect: { id: options.shippingAddress.id } }
        : undefined,
      billingAddress: options.billingAddress
        ? { connect: { id: options.billingAddress.id } }
        : undefined,
      items: {
        createMany: {
          data: items,
        },
      },
    },
    include: {
      items: true,
    },
  });
};

export interface CreatePaymentOptions {
  order: Order;
  user?: User;
  provider?: PaymentProvider;
  status?: PaymentStatus;
  amount?: number | Prisma.Decimal;
}

export const createPayment = async (
  prisma: PrismaClient,
  options: CreatePaymentOptions,
): Promise<Payment> => {
  const amount = toDecimal(options.amount ?? Number(options.order.totalAmount));

  return prisma.payment.create({
    data: {
      orderId: options.order.id,
      userId: options.user?.id,
      provider: options.provider ?? PaymentProvider.IYZICO,
      status: options.status ?? PaymentStatus.AUTHORIZED,
      amount,
      transactionId: `${faker.string.alphanumeric(8)}-${faker.number.int({ min: 1000, max: 9999 })}`,
      paidPrice: amount,
      currency: DEFAULT_CURRENCY,
      authorizedAt: new Date(),
    },
  });
};

export interface CreateReviewOptions {
  product: Product;
  user: User;
  order?: Order;
  rating?: number;
  status?: ReviewStatus;
}

export const createReview = async (
  prisma: PrismaClient,
  options: CreateReviewOptions,
): Promise<Review> =>
  prisma.review.create({
    data: {
      productId: options.product.id,
      userId: options.user.id,
      orderId: options.order?.id,
      rating: options.rating ?? faker.number.int({ min: 4, max: 5 }),
      title: faker.commerce.productAdjective(),
      content: faker.lorem.sentence(),
      isVerifiedPurchase: Boolean(options.order),
      status: options.status ?? ReviewStatus.APPROVED,
    },
  });
