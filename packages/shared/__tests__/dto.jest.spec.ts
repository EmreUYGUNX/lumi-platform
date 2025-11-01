/* eslint-disable unicorn/no-null */
import {
  CartStatus,
  InventoryPolicy,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  ProductStatus,
  ReviewStatus,
  UserStatus,
} from "@prisma/client";

import {
  type ProductCreateRequestDTO,
  isCategorySummaryDTO,
  isMediaAssetDTO,
  isProductSummaryDTO,
  isProductVariantDTO,
  productCreateRequestSchema,
  productVariantInputSchema,
} from "../src/dto/catalog.dto.js";
import {
  type CartSummaryDTO,
  type OrderDetailDTO,
  type OrderSummaryDTO,
  type PaymentSummaryDTO,
  cartSummarySchema,
  isAddressDTO,
  isCartItemDTO,
  isCartSummaryDTO,
  isCouponSummaryDTO,
  isOrderDetailDTO,
  isOrderSummaryDTO,
  isPaymentSummaryDTO,
  isReviewSummaryDTO,
  orderSummarySchema,
  paymentSummarySchema,
  reviewSummarySchema,
} from "../src/dto/commerce.dto.js";
import {
  type DateRangeFilter,
  type OrderFilter,
  type PriceRangeFilter,
  type ProductFilter,
  type ReviewFilter,
  dateRangeFilterSchema,
  isDateRangeFilter,
  isOrderFilter,
  isPriceRangeFilter,
  isProductFilter,
  isReviewFilter,
  orderFilterSchema,
  priceRangeFilterSchema,
  productFilterSchema,
  reviewFilterSchema,
} from "../src/dto/filters.js";
import {
  mapCartToSummary,
  mapCouponToSummary,
  mapOrderToDetail,
  mapOrderToSummary,
  mapPaymentToSummary,
  mapProductToSummary,
  mapUserCreateRequestToData,
  mapUserEntityToDetail,
  mapUserEntityToSummary,
  mapUserUpdateRequestToData,
} from "../src/dto/mappers.js";
import {
  type CursorPaginationMeta,
  type PaginationMeta,
  buildCursorPaginatedResponseSchema,
  buildPaginatedResponseSchema,
  cursorPaginationMetaSchema,
  cursorPaginationRequestSchema,
  isCursorPaginationMeta,
  isCursorPaginationRequest,
  isPaginationMeta,
  isPaginationRequest,
  paginationMetaSchema,
  paginationRequestSchema,
} from "../src/dto/pagination.js";
import type {
  CartWithItems,
  CouponEntity,
  OrderWithRelations,
  ProductWithRelations,
  UserWithRoleEntities,
} from "../src/dto/prisma-types.js";
import {
  type UserCreateRequestDTO,
  type UserDetailDTO,
  type UserPermissionDTO,
  type UserRoleDTO,
  type UserSummaryDTO,
  type UserUpdateRequestDTO,
  isUserCreateRequestDTO,
  isUserDetailDTO,
  isUserPermissionDTO,
  isUserRoleDTO,
  isUserSummaryDTO,
  isUserUpdateRequestDTO,
  userCreateRequestSchema,
  userSummarySchema,
  userUpdateRequestSchema,
} from "../src/dto/user.dto.js";

const createDecimal = (value: number | string) => new Prisma.Decimal(value);

const createUserFixture = (): UserWithRoleEntities => {
  const timestamp = new Date("2024-07-01T10:00:00.000Z");

  return {
    id: "ckuserfixture000000000000000",
    email: "summary@example.com",
    passwordHash: "hashed",
    firstName: "Jane",
    lastName: "Doe",
    phone: "+905551112233",
    emailVerified: true,
    emailVerifiedAt: timestamp,
    failedLoginCount: 0,
    lockoutUntil: null,
    twoFactorSecret: null,
    twoFactorEnabled: false,
    status: UserStatus.ACTIVE,
    createdAt: timestamp,
    updatedAt: timestamp,
    roles: [
      {
        userId: "ckuserfixture000000000000000",
        roleId: "ckrolefixture000000000000000",
        assignedAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
        role: {
          id: "ckrolefixture000000000000000",
          name: "Administrator",
          description: "Full access",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      },
    ],
    permissions: [
      {
        userId: "ckuserfixture000000000000000",
        permissionId: "ckpermfixture00000000000000",
        assignedAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
        permission: {
          id: "ckpermfixture00000000000000",
          key: "catalog:manage",
          description: "Manage catalog entities",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      },
    ],
  };
};

const createProductFixture = (): ProductWithRelations => {
  const timestamp = new Date("2024-07-01T10:00:00.000Z");

  return {
    id: "ckproductfixture0000000000000",
    title: "Aurora Desk Lamp",
    slug: "aurora-desk-lamp",
    sku: "LAMP-001",
    description: "Elegant aluminium lamp.",
    summary: "Ambient lighting",
    status: ProductStatus.ACTIVE,
    price: createDecimal("249.90"),
    compareAtPrice: createDecimal("299.90"),
    currency: "TRY",
    inventoryPolicy: InventoryPolicy.TRACK,
    searchKeywords: ["lamp", "desk"],
    attributes: {
      material: "aluminium",
    },
    deletedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    variants: [
      {
        id: "ckvariantfixture000000000000",
        productId: "ckproductfixture0000000000000",
        title: "Aurora Desk Lamp - Midnight Black",
        sku: "LAMP-001-BLK",
        price: createDecimal("249.90"),
        compareAtPrice: null,
        stock: 25,
        attributes: {
          color: "black",
        },
        weightGrams: 3500,
        isPrimary: true,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    categories: [
      {
        productId: "ckproductfixture0000000000000",
        categoryId: "ckcategoryfixture0000000000",
        isPrimary: true,
        assignedAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
        category: {
          id: "ckcategoryfixture0000000000",
          name: "Lighting",
          slug: "lighting",
          description: "Home and office lighting",
          parentId: null,
          level: 0,
          path: "/lighting",
          imageUrl: null,
          iconUrl: null,
          displayOrder: 1,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      },
    ],
    productMedia: [
      {
        productId: "ckproductfixture0000000000000",
        mediaId: "ckmediafixture00000000000000",
        sortOrder: 1,
        isPrimary: true,
        assignedAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
        media: {
          id: "ckmediafixture00000000000000",
          assetId: "lib/aurora-desk-lamp.png",
          url: "https://cdn.lumi.app/aurora.png",
          type: "IMAGE",
          provider: "CLOUDINARY",
          mimeType: "image/png",
          sizeBytes: 204_800,
          width: 1200,
          height: 800,
          alt: "Aurora lamp on a desk",
          caption: "Aurora desk lamp lifestyle shot",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      },
    ],
  };
};

const createCartFixture = (product: ProductWithRelations): CartWithItems => {
  const timestamp = new Date("2024-07-01T11:00:00.000Z");

  return {
    id: "ckcartfixture000000000000000",
    userId: "ckuserfixture000000000000000",
    sessionId: "session-123",
    status: CartStatus.ACTIVE,
    expiresAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    items: [
      {
        id: "ckcartitemfixture00000000000",
        cartId: "ckcartfixture000000000000000",
        productVariantId: product.variants[0]!.id,
        quantity: 2,
        unitPrice: createDecimal("249.90"),
        createdAt: timestamp,
        updatedAt: timestamp,
        productVariant: {
          ...product.variants[0]!,
          product,
        },
      },
    ],
  };
};

const createOrderFixture = (product: ProductWithRelations): OrderWithRelations => {
  const timestamp = new Date("2024-07-01T12:00:00.000Z");
  const cart = createCartFixture(product);

  const shippingAddress = {
    id: "ckaddressfixture000000000000",
    userId: cart.userId!,
    label: "Home",
    fullName: "Jane Doe",
    phone: "+905551112233",
    line1: "Example Street 123",
    line2: "Apt 4B",
    city: "Istanbul",
    state: "Istanbul",
    postalCode: "34000",
    country: "TR",
    isDefault: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const billingAddress = {
    ...shippingAddress,
    id: "ckaddressfixture000000000001",
    label: "Billing",
    isDefault: false,
  };

  return {
    id: "ckorderfixture000000000000000",
    reference: "LUMI-2024-00001",
    userId: cart.userId,
    cartId: cart.id,
    status: OrderStatus.PAID,
    totalAmount: createDecimal("499.80"),
    subtotalAmount: createDecimal("499.80"),
    taxAmount: createDecimal("0"),
    discountAmount: createDecimal("0"),
    currency: "TRY",
    shippingAddressId: shippingAddress.id,
    billingAddressId: billingAddress.id,
    placedAt: timestamp,
    fulfilledAt: null,
    shippedAt: null,
    deliveredAt: null,
    cancelledAt: null,
    notes: null,
    metadata: null,
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    user: null,
    shippingAddress,
    billingAddress,
    items: [
      {
        id: "ckorderitemfixture0000000000",
        orderId: "ckorderfixture000000000000000",
        productId: product.id,
        productVariantId: product.variants[0]!.id,
        quantity: 2,
        unitPrice: createDecimal("249.90"),
        currency: "TRY",
        titleSnapshot: product.title,
        variantSnapshot: {
          attributes: product.variants[0]!.attributes,
        },
        createdAt: timestamp,
        updatedAt: timestamp,
        product,
        productVariant: product.variants[0]!,
      },
    ],
    payments: [],
  };
};

const createPaymentFixture = (orderId: string): Prisma.PaymentGetPayload<undefined> => {
  const timestamp = new Date("2024-07-01T12:05:00.000Z");

  return {
    id: "ckpaymentfixture0000000000000",
    orderId,
    userId: "ckuserfixture000000000000000",
    provider: PaymentProvider.IYZICO,
    status: PaymentStatus.SETTLED,
    transactionId: "tr_123",
    conversationId: "conv_123",
    amount: createDecimal("499.80"),
    paidPrice: createDecimal("499.80"),
    currency: "TRY",
    installment: 1,
    paymentChannel: "web",
    paymentGroup: "product",
    cardToken: "card_123",
    cardAssociation: "VISA",
    cardFamily: "Classic",
    cardType: "CREDIT",
    cardBankName: "Lumi Bank",
    cardHolderName: "Jane Doe",
    binNumber: "450803",
    lastFourDigits: "4242",
    threeDSHtmlContent: null,
    ipAddress: "127.0.0.1",
    deviceId: "device-123",
    fraudScore: 0.12,
    riskFlags: null,
    authorizedAt: timestamp,
    settledAt: timestamp,
    failedAt: null,
    failureReason: null,
    failureCode: null,
    rawPayload: {
      correlationId: "abc",
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const createCouponFixture = (): CouponEntity => {
  const timestamp = new Date("2024-07-01T09:00:00.000Z");
  return {
    id: "ckcouponfixture0000000000000",
    code: "WELCOME10",
    description: "10% welcome discount",
    type: "PERCENTAGE",
    value: createDecimal("10"),
    minOrderAmount: createDecimal("100"),
    maxDiscountAmount: null,
    usageLimit: 100,
    usageCount: 12,
    startsAt: timestamp,
    expiresAt: null,
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

describe("DTO schemas", () => {
  it("validates user request payloads", () => {
    const valid: UserCreateRequestDTO = {
      email: "user@example.com",
      password: "super-secure-password",
      firstName: "Test",
      lastName: "User",
      phone: "+905551234567",
    };

    expect(() => userCreateRequestSchema.parse(valid)).not.toThrow();

    const invalid: UserUpdateRequestDTO = {
      status: UserStatus.DELETED,
      emailVerified: true,
    };

    expect(() => userUpdateRequestSchema.parse(invalid)).toThrow(
      "Deleted accounts cannot remain email verified.",
    );
  });

  it("validates product creation payloads", () => {
    const payload: ProductCreateRequestDTO = {
      title: "Lumen Floor Lamp",
      price: { amount: "599.00", currency: "TRY" },
      variants: [
        productVariantInputSchema.parse({
          title: "Default",
          price: { amount: "599.00", currency: "TRY" },
          stock: 10,
          isPrimary: true,
        }),
      ],
      categoryIds: ["ckcategoryfixture0000000000"],
    };

    expect(() => productCreateRequestSchema.parse(payload)).not.toThrow();
  });

  it("validates filter structures", () => {
    const price: PriceRangeFilter = priceRangeFilterSchema.parse({ min: "10.00", max: "50.00" });
    expect(price.min).toBe("10.00");

    const range: DateRangeFilter = dateRangeFilterSchema.parse({
      from: "2024-01-01T00:00:00.000Z",
      to: "2024-12-31T23:59:59.999Z",
    });
    expect(range.to).toBe("2024-12-31T23:59:59.999Z");

    expect(() =>
      productFilterSchema.parse({
        search: "lamp",
        statuses: [ProductStatus.ACTIVE],
        attributes: { colour: "Black", size: ["M", "L"] },
        sort: "rating",
      }),
    ).not.toThrow();
  });

  it("rejects invalid attribute filters", () => {
    expect(() =>
      productFilterSchema.parse({
        attributes: "not-json",
      }),
    ).toThrow("Attribute filters must be valid JSON.");
  });

  it("builds paginated response schema on demand", () => {
    const params = paginationRequestSchema.parse({ page: "2", pageSize: "10" });
    expect(params.page).toBe(2);

    const pagination: PaginationMeta = paginationMetaSchema.parse({
      page: 1,
      pageSize: 20,
      totalItems: 40,
      totalPages: 2,
      hasNextPage: true,
      hasPreviousPage: false,
    });

    const responseSchema = buildPaginatedResponseSchema(userSummarySchema);
    const sample = {
      items: [mapUserEntityToSummary(createUserFixture())],
      meta: pagination,
    };

    expect(() => responseSchema.parse(sample)).not.toThrow();
  });
});

describe("DTO mappers", () => {
  const user = createUserFixture();
  const product = createProductFixture();
  const cart = createCartFixture(product);
  const order = createOrderFixture(product);
  const payment = createPaymentFixture(order.id);
  const coupon = createCouponFixture();

  it("maps user entities to DTOs with type guards", () => {
    const summary = mapUserEntityToSummary(user);
    expect(isUserSummaryDTO(summary)).toBe(true);
    expect(summary.fullName).toBe("Jane Doe");

    const detail = mapUserEntityToDetail(user);
    expect(isUserDetailDTO(detail)).toBe(true);
    expect(detail.twoFactorEnabled).toBe(false);
  });

  it("maps product aggregates to DTOs", () => {
    const dto = mapProductToSummary(product);
    expect(isProductSummaryDTO(dto)).toBe(true);
    expect(dto.variants[0]?.price.amount).toBe("249.90");
  });

  it("aggregates cart totals consistently", () => {
    const dto = mapCartToSummary(cart);
    expect(cartSummarySchema.parse(dto).totals.total.amount).toBe("499.80");
  });

  it("maps order and payment structures", () => {
    const orderDto = mapOrderToSummary({ ...order, payments: [payment] });
    expect(orderSummarySchema.parse(orderDto).status).toBe(OrderStatus.PAID);

    const paymentDto = mapPaymentToSummary(payment);
    const paymentParsed = paymentSummarySchema.parse(paymentDto);
    expect(paymentParsed.amount.amount).toBe("499.80");
  });

  it("maps coupon records to DTOs", () => {
    const dto = mapCouponToSummary(coupon, "TRY");
    expect(dto.code).toBe("WELCOME10");
    expect(dto.value.amount).toBe("10.00");
    expect(dto.value.currency).toBe("TRY");
  });

  it("maps request DTOs back to Prisma inputs", () => {
    const createRequest: UserCreateRequestDTO = {
      email: "Customer@example.com",
      password: "ultra-secure-password",
      firstName: "Customer",
      lastName: "Example",
    };

    const createInput = mapUserCreateRequestToData(createRequest, "hashed-value");
    expect(createInput.email).toBe("customer@example.com");

    const updateRequest: UserUpdateRequestDTO = {
      firstName: "Updated",
      emailVerified: true,
    };
    const updateInput = mapUserUpdateRequestToData(updateRequest);
    expect(updateInput.emailVerified).toBe(true);
  });
});

describe("DTO type guards", () => {
  const user = createUserFixture();
  const product = createProductFixture();
  const cart = createCartFixture(product);
  const order = createOrderFixture(product);
  const payment = createPaymentFixture(order.id);
  const coupon = createCouponFixture();

  it("recognises catalog DTOs", () => {
    const productDto = mapProductToSummary(product);
    expect(isProductSummaryDTO(productDto)).toBe(true);
    const primaryMedia = productDto.media[0]?.media;
    expect(primaryMedia && isMediaAssetDTO(primaryMedia)).toBe(true);
    expect(isCategorySummaryDTO(productDto.categories[0])).toBe(true);
    expect(isProductVariantDTO(productDto.variants[0])).toBe(true);
    expect(isMediaAssetDTO(null)).toBe(false);
    expect(isCategorySummaryDTO({ id: "invalid" })).toBe(false);
    expect(isProductVariantDTO({})).toBe(false);
    expect(isProductSummaryDTO({})).toBe(false);
  });

  it("recognises commerce DTOs", () => {
    const productDto = mapProductToSummary(product);
    const cartDto: CartSummaryDTO = mapCartToSummary(cart);
    expect(isCartSummaryDTO(cartDto)).toBe(true);
    expect(isCartItemDTO(cartDto.items[0])).toBe(true);
    expect(isCartSummaryDTO({})).toBe(false);
    expect(isCartItemDTO(null)).toBe(false);

    const orderSummary: OrderSummaryDTO = mapOrderToSummary({ ...order, payments: [payment] });
    expect(isOrderSummaryDTO(orderSummary)).toBe(true);
    expect(isOrderSummaryDTO(null)).toBe(false);

    const orderDetail: OrderDetailDTO = mapOrderToDetail({ ...order, payments: [payment] });
    expect(isOrderDetailDTO(orderDetail)).toBe(true);
    expect(orderDetail.shippingAddress && isAddressDTO(orderDetail.shippingAddress)).toBe(true);
    expect(isOrderDetailDTO({})).toBe(false);
    expect(isAddressDTO(null)).toBe(false);

    const paymentSummary: PaymentSummaryDTO = mapPaymentToSummary(payment);
    expect(isPaymentSummaryDTO(paymentSummary)).toBe(true);
    expect(isPaymentSummaryDTO({})).toBe(false);

    const couponSummary = mapCouponToSummary(coupon, "TRY");
    expect(isCouponSummaryDTO(couponSummary)).toBe(true);
    expect(isCouponSummaryDTO({})).toBe(false);

    const reviewTimestamp = new Date("2024-07-03T08:00:00.000Z").toISOString();
    const reviewSample = reviewSummarySchema.parse({
      id: "ckreviewfixture000000000000",
      productId: product.id,
      userId: user.id,
      orderId: order.id,
      rating: 5,
      title: "Fantastic quality",
      content: "Exceeded expectations.",
      isVerifiedPurchase: true,
      status: ReviewStatus.APPROVED,
      helpfulCount: 12,
      notHelpfulCount: 0,
      media: productDto.media.map((entry) => entry.media),
      createdAt: reviewTimestamp,
      updatedAt: reviewTimestamp,
    });
    expect(isReviewSummaryDTO(reviewSample)).toBe(true);
    expect(isReviewSummaryDTO({})).toBe(false);
  });

  it("recognises user DTOs", () => {
    const summary: UserSummaryDTO = mapUserEntityToSummary(user);
    expect(isUserSummaryDTO(summary)).toBe(true);
    expect(isUserSummaryDTO(null)).toBe(false);

    const detail: UserDetailDTO = mapUserEntityToDetail(user);
    expect(isUserDetailDTO(detail)).toBe(true);
    expect(isUserDetailDTO({})).toBe(false);

    const role: UserRoleDTO = summary.roles[0]!;
    expect(isUserRoleDTO(role)).toBe(true);
    expect(isUserRoleDTO({})).toBe(false);

    const permission: UserPermissionDTO = summary.permissions[0]!;
    expect(isUserPermissionDTO(permission)).toBe(true);
    expect(isUserPermissionDTO({})).toBe(false);

    const createRequest: UserCreateRequestDTO = {
      email: "example@lumi.dev",
      password: "very-strong-password",
      firstName: "Example",
      lastName: "User",
    };
    expect(isUserCreateRequestDTO(createRequest)).toBe(true);
    expect(isUserCreateRequestDTO({ password: "short" })).toBe(false);

    const updateRequest: UserUpdateRequestDTO = {
      firstName: "Updated",
    };
    expect(isUserUpdateRequestDTO(updateRequest)).toBe(true);
    expect(isUserUpdateRequestDTO({ status: "INVALID" })).toBe(false);
  });

  it("recognises filter DTOs", () => {
    const price: PriceRangeFilter = priceRangeFilterSchema.parse({ min: "10.00", max: "30.00" });
    expect(isPriceRangeFilter(price)).toBe(true);
    expect(isPriceRangeFilter({ min: "abc" })).toBe(false);

    const range: DateRangeFilter = dateRangeFilterSchema.parse({
      from: "2024-01-01T00:00:00.000Z",
      to: "2024-02-01T00:00:00.000Z",
    });
    expect(isDateRangeFilter(range)).toBe(true);
    expect(isDateRangeFilter({ from: "invalid" })).toBe(false);

    const productFilter: ProductFilter = productFilterSchema.parse({
      statuses: [ProductStatus.ACTIVE],
      priceRange: { min: "100.00", max: "500.00" },
    });
    expect(isProductFilter(productFilter)).toBe(true);
    expect(isProductFilter({ take: -1 })).toBe(false);

    const reviewFilter: ReviewFilter = reviewFilterSchema.parse({
      status: ReviewStatus.APPROVED,
    });
    expect(isReviewFilter(reviewFilter)).toBe(true);
    expect(isReviewFilter({ rating: 10 })).toBe(false);

    const orderFilter: OrderFilter = orderFilterSchema.parse({
      status: [OrderStatus.PAID],
    });
    expect(isOrderFilter(orderFilter)).toBe(true);
    expect(isOrderFilter({ status: ["UNKNOWN"] })).toBe(false);
  });

  it("recognises pagination DTOs", () => {
    const pageRequest = paginationRequestSchema.parse({ page: "1", pageSize: "25" });
    expect(isPaginationRequest(pageRequest)).toBe(true);
    expect(isPaginationRequest({ page: 0 })).toBe(false);

    const cursorRequest = cursorPaginationRequestSchema.parse({ cursor: "abc", take: "10" });
    expect(isCursorPaginationRequest(cursorRequest)).toBe(true);
    expect(isCursorPaginationRequest({ take: -1 })).toBe(false);

    const meta: PaginationMeta = paginationMetaSchema.parse({
      page: 1,
      pageSize: 20,
      totalItems: 100,
      totalPages: 5,
      hasNextPage: true,
      hasPreviousPage: false,
    });
    expect(isPaginationMeta(meta)).toBe(true);
    expect(isPaginationMeta({ page: -1 })).toBe(false);

    const cursorMeta: CursorPaginationMeta = cursorPaginationMetaSchema.parse({
      hasMore: true,
      nextCursor: "next",
    });
    expect(isCursorPaginationMeta(cursorMeta)).toBe(true);
    expect(isCursorPaginationMeta({ hasMore: "yes" })).toBe(false);

    const cursorResponse = buildCursorPaginatedResponseSchema(userSummarySchema);
    expect(() =>
      cursorResponse.parse({
        items: [mapUserEntityToSummary(user)],
        meta: cursorMeta,
      }),
    ).not.toThrow();
  });
});

describe("Mapper edge cases", () => {
  it("normalises malformed monetary inputs and default currency", () => {
    const order = createOrderFixture(createProductFixture());
    const weirdPayment = {
      ...createPaymentFixture(order.id),
      amount: "not-a-number" as unknown as Prisma.Decimal,
      currency: "   ",
    };

    const summary = mapPaymentToSummary(weirdPayment);

    expect(summary.amount.amount).toBe("0");
    expect(summary.amount.currency).toBe("TRY");
  });

  it("defaults missing payment amount when value is nullish", () => {
    const order = createOrderFixture(createProductFixture());
    const paymentWithNullAmount = {
      ...createPaymentFixture(order.id),
      amount: null as unknown as Prisma.Decimal,
      paidPrice: null,
      userId: null,
      conversationId: undefined,
      installment: null,
      paymentChannel: "   ",
      paymentGroup: null,
      cardToken: null,
      cardAssociation: " ",
      cardFamily: null,
      cardType: null,
      cardBankName: null,
      cardHolderName: " ",
      binNumber: " ",
      lastFourDigits: " ",
      ipAddress: null,
      deviceId: null,
      fraudScore: null,
      riskFlags: null,
      authorizedAt: null,
      settledAt: null,
      failedAt: null,
      failureReason: " ",
      failureCode: " ",
      rawPayload: null,
    } as unknown as Prisma.PaymentGetPayload<undefined>;

    const summary = mapPaymentToSummary(paymentWithNullAmount);

    expect(summary.amount.amount).toBe("0");
    expect(summary.amount.currency).toBe("TRY");
    expect(summary.userId).toBeNull();
    expect(summary.paidPrice).toBeUndefined();
    expect(summary.installment).toBeNull();
    expect(summary.paymentChannel).toBeNull();
    expect(summary.paymentGroup).toBeNull();
    expect(summary.cardAssociation).toBeNull();
    expect(summary.cardHolderName).toBeNull();
    expect(summary.binNumber).toBeNull();
    expect(summary.lastFourDigits).toBeNull();
    expect(summary.ipAddress).toBeNull();
    expect(summary.deviceId).toBeNull();
    expect(summary.fraudScore).toBeNull();
    expect(summary.riskFlags).toBeNull();
    expect(summary.authorizedAt).toBeNull();
    expect(summary.settledAt).toBeNull();
    expect(summary.failedAt).toBeNull();
    expect(summary.failureReason).toBeNull();
    expect(summary.failureCode).toBeNull();
    expect(summary.rawPayload).toBeNull();
  });

  it("handles optional date fields gracefully when invalid", () => {
    const malformedUser = {
      ...createUserFixture(),
      emailVerifiedAt: "invalid-date" as unknown as Date,
      lockoutUntil: "invalid-date" as unknown as Date,
      firstName: "   ",
      lastName: "\t",
      roles: undefined,
      permissions: undefined,
    } as unknown as UserWithRoleEntities;

    const detail = mapUserEntityToDetail(malformedUser);

    expect(detail.emailVerifiedAt).toBeNull();
    expect(detail.lockoutUntil).toBeNull();
    expect(detail.fullName).toBeNull();
    expect(detail.roles).toHaveLength(0);
    expect(detail.permissions).toHaveLength(0);
  });

  it("maps update requests by trimming and nullifying fields", () => {
    const updatePayload: UserUpdateRequestDTO = {
      firstName: "  ",
      lastName: " Doe ",
      phone: null,
      emailVerified: false,
      status: UserStatus.SUSPENDED,
    };

    const result = mapUserUpdateRequestToData(updatePayload);

    expect(result.firstName).toBe("");
    expect(result.lastName).toBe("Doe");
    expect(result.phone).toBeNull();
    expect(result.emailVerifiedAt).toBeNull();
    expect(result.emailVerified).toBe(false);
    expect(result.status).toBe(UserStatus.SUSPENDED);
  });

  it("normalises optional product relations with sparse data", () => {
    const baseProduct = createProductFixture();
    const mutatedProduct: ProductWithRelations = {
      ...baseProduct,
      sku: null as unknown as string,
      summary: null,
      description: null,
      currency: null as unknown as string,
      variants: [
        {
          ...baseProduct.variants[0]!,
          compareAtPrice: "invalid" as unknown as Prisma.Decimal,
          attributes: null,
        },
      ],
      productMedia: [
        {
          ...baseProduct.productMedia[0]!,
          sortOrder: null,
          media: {
            ...baseProduct.productMedia[0]!.media,
            alt: "   ",
            caption: " ",
            width: undefined as unknown as number,
            height: undefined as unknown as number,
          },
        },
      ],
      categories: [
        {
          ...baseProduct.categories[0]!,
          category: {
            ...baseProduct.categories[0]!.category,
            description: " ",
            displayOrder: undefined as unknown as number,
          },
        },
      ],
    };

    const summary = mapProductToSummary(mutatedProduct);

    expect(summary.sku).toBeNull();
    expect(summary.summary).toBeNull();
    expect(summary.description).toBeNull();
    expect(summary.price.currency).toBe("TRY");
    expect(summary.variants[0]?.compareAtPrice?.amount).toBe("0");
    expect(summary.variants[0]?.attributes).toBeNull();
    expect(summary.media[0]?.media.alt).toBeNull();
    expect(summary.media[0]?.media.caption).toBeNull();
    expect(summary.media[0]?.media.width).toBeNull();
    expect(summary.media[0]?.media.height).toBeNull();
    expect(summary.categories[0]?.description).toBeNull();
    expect(summary.categories[0]?.displayOrder).toBeNull();
  });

  it("returns null for missing order addresses when mapping details", () => {
    const order = createOrderFixture(createProductFixture());
    const detail = mapOrderToDetail({
      ...order,
      shippingAddressId: null,
      billingAddressId: null,
      shippingAddress: null,
      billingAddress: null,
    });

    expect(detail.shippingAddress).toBeNull();
    expect(detail.billingAddress).toBeNull();
  });

  it("maps cart summaries when variant details are missing", () => {
    const product = createProductFixture();
    const baseCart = createCartFixture(product);
    const sparseCart = {
      ...baseCart,
      items: [
        {
          ...baseCart.items[0]!,
          productVariant: undefined,
        },
      ],
    } as unknown as CartWithItems;

    const summary = mapCartToSummary(sparseCart);

    expect(summary.items[0]?.productVariant).toBeUndefined();
    expect(summary.totals.total.currency).toBe("TRY");
  });

  it("maps coupons with optional constraints and defaults", () => {
    const coupon = {
      ...createCouponFixture(),
      description: " ",
      minOrderAmount: null,
      usageLimit: null,
      maxDiscountAmount: createDecimal("25"),
      expiresAt: new Date("2024-08-01T00:00:00.000Z"),
    };

    const summary = mapCouponToSummary(coupon, "TRY");

    expect(summary.description).toBeNull();
    expect(summary.minOrderAmount).toBeUndefined();
    expect(summary.usageLimit).toBeNull();
    expect(summary.maxDiscountAmount?.amount).toBe("25.00");
    expect(summary.expiresAt).toBe("2024-08-01T00:00:00.000Z");
  });
});
