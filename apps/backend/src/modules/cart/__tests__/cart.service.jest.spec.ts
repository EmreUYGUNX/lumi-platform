/* eslint-disable unicorn/no-null */
import { describe, expect, it, jest } from "@jest/globals";
import { InventoryPolicy, InventoryReservationStatus, Prisma, ProductStatus } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

import type { EmailService } from "@/lib/email/email.service.js";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors.js";

import type { CartCache, CartCacheScope } from "../cart.cache.js";
import type { CartRepository, CartWithRelations } from "../cart.repository.js";
import { CartService, cartServiceInternals } from "../cart.service.js";
import type { CartContext } from "../cart.service.js";
import type { CartSummaryView, CartValidationReport } from "../cart.types.js";
import { type AddCartItemInput, CART_ITEM_MAX_QUANTITY } from "../cart.validators.js";

const CUID_PATTERN = /^c[\da-z]{24}$/;

const ensureCuid = (value: string): string => {
  if (CUID_PATTERN.test(value)) {
    return value.toLowerCase();
  }

  const normalized = value.replaceAll(/[^\da-z]/gi, "").toLowerCase() || "fixture";
  const repeatCount = Math.ceil(24 / normalized.length) + 1;
  const repeated = normalized.repeat(repeatCount);
  return `c${repeated.slice(0, 24)}`;
};

type CartVariantEntity = NonNullable<CartWithRelations["items"][number]["productVariant"]>;
type CartProductEntity = NonNullable<CartVariantEntity["product"]>;

const DEFAULT_USER_ID = ensureCuid("user-fixture");
const DEFAULT_SESSION_ID = "session-fixture";
const CLAIM_USER_ID = ensureCuid("user-claim");

const createCartFixture = (): CartWithRelations => {
  const timestamp = new Date("2025-03-01T10:00:00.000Z");
  const cartId = ensureCuid("ckcartfixture000000000000001");
  const cartItemId = ensureCuid("ckitemfixture000000000000001");
  const variantId = ensureCuid("ckvariantfixture00000000001");
  const productId = ensureCuid("ckproductfixture00000000001");

  return {
    id: cartId,
    userId: DEFAULT_USER_ID,
    sessionId: "cksessionfixture00000000001",
    status: "ACTIVE",
    expiresAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    items: [
      {
        id: cartItemId,
        cartId,
        productVariantId: variantId,
        quantity: 5,
        unitPrice: new Prisma.Decimal("199.00"),
        createdAt: timestamp,
        updatedAt: timestamp,
        productVariant: {
          id: variantId,
          title: "Aurora Lamp Variant",
          sku: "SKU-FIXTURE",
          price: new Prisma.Decimal("199.00"),
          compareAtPrice: null,
          stock: 2,
          attributes: null,
          weightGrams: null,
          isPrimary: true,
          createdAt: timestamp,
          updatedAt: timestamp,
          product: {
            id: productId,
            title: "Aurora Lamp",
            slug: "aurora-lamp",
            price: new Prisma.Decimal("199.00"),
            compareAtPrice: null,
            currency: "TRY",
            status: ProductStatus.ACTIVE,
            inventoryPolicy: InventoryPolicy.TRACK,
          },
        },
      },
    ],
    user: {
      id: "ckuserfixture0000000000001",
      email: "user@example.com",
      firstName: "Test",
      lastName: "User",
    },
  } as unknown as CartWithRelations;
};

type RepositoryWithTransaction = (
  callback: (repo: CartRepository, tx: Prisma.TransactionClient) => Promise<unknown>,
) => Promise<unknown>;

interface CartRepositoryMock {
  findActiveCartByUser: jest.MockedFunction<CartRepository["findActiveCartByUser"]>;
  findActiveCartBySession: jest.MockedFunction<CartRepository["findActiveCartBySession"]>;
  findById: jest.MockedFunction<CartRepository["findById"]>;
  withTransaction: jest.MockedFunction<RepositoryWithTransaction>;
  create: jest.MockedFunction<CartRepository["create"]>;
}

interface ServiceOverrides {
  cart?: CartWithRelations;
  repository?: Partial<CartRepositoryMock>;
}

type ApplyAddItemFn = (
  tx: Prisma.TransactionClient,
  cart: CartWithRelations,
  ctx: CartContext,
  input: AddCartItemInput,
) => Promise<{
  itemId: string;
  variantId: string;
  previousQuantity: number;
  newQuantity: number;
}>;

type ApplyUpdateItemFn = (
  tx: Prisma.TransactionClient,
  cart: CartWithRelations,
  ctx: CartContext,
  itemId: string,
  quantity: number,
) => Promise<{
  itemId: string;
  variantId: string;
  previousQuantity: number;
  newQuantity: number;
}>;

type ApplyClearCartFn = (tx: Prisma.TransactionClient, cart: CartWithRelations) => Promise<number>;

type ApplyMergeCartsFn = (
  tx: Prisma.TransactionClient,
  guest: CartWithRelations,
  user: CartWithRelations,
  strategy: "sum" | "replace",
) => Promise<{ mergedItems: number }>;

interface CartServiceInternals {
  applyAddItem: ApplyAddItemFn;
  applyUpdateItem: ApplyUpdateItemFn;
  applyClearCart: ApplyClearCartFn;
  applyMergeCarts: ApplyMergeCartsFn;
}

const spyOnCartInternal = <Method extends keyof CartServiceInternals>(
  internals: CartServiceInternals,
  method: Method,
): jest.SpiedFunction<CartServiceInternals[Method]> =>
  jest.spyOn(internals, method) as jest.SpiedFunction<CartServiceInternals[Method]>;

interface TransactionMockOptions {
  reservation?: {
    id?: string;
    cartId?: string;
    userId?: string;
    status?: InventoryReservationStatus;
    expiresAt?: Date;
    createdAt?: Date;
    updatedAt?: Date;
    items?: {
      id: string;
      reservationId: string;
      productVariantId: string;
      quantity: number;
      createdAt: Date;
      updatedAt: Date;
    }[];
  };
}

const createTransactionClientMock = (
  options: TransactionMockOptions = {},
): Prisma.TransactionClient => {
  const timestamp = new Date("2025-03-01T11:00:00.000Z");
  const reservation = {
    id: options.reservation?.id ?? ensureCuid("reservation"),
    cartId: options.reservation?.cartId ?? ensureCuid("cart"),
    userId: options.reservation?.userId ?? DEFAULT_USER_ID,
    status: options.reservation?.status ?? InventoryReservationStatus.ACTIVE,
    expiresAt: options.reservation?.expiresAt ?? timestamp,
    createdAt: options.reservation?.createdAt ?? timestamp,
    updatedAt: options.reservation?.updatedAt ?? timestamp,
    items: options.reservation?.items ?? [],
  };

  return {
    cart: {
      update: jest.fn(async () => ({})),
    },
    cartItem: {
      create: jest.fn(async () => ({})),
      update: jest.fn(async () => ({})),
      deleteMany: jest.fn(async () => ({})),
      findUnique: jest.fn(async () => null),
    },
    productVariant: {
      findUnique: jest.fn(async () => null),
      findMany: jest.fn(async () => []),
    },
    inventoryReservation: {
      updateMany: jest.fn(async () => ({})),
      create: jest.fn(async () => reservation),
    },
    inventoryReservationItem: {
      aggregate: jest.fn(async () => ({ _sum: { quantity: 0 } })),
      groupBy: jest.fn(async () => []),
    },
  } as unknown as Prisma.TransactionClient;
};

const createService = (overrides: ServiceOverrides = {}) => {
  const cart = overrides.cart ?? createCartFixture();
  const repository: CartRepositoryMock = {
    findActiveCartByUser: jest.fn<CartRepository["findActiveCartByUser"]>(async () => cart),
    findActiveCartBySession: jest.fn<CartRepository["findActiveCartBySession"]>(async () => cart),
    create: jest.fn<CartRepository["create"]>(async () => cart),
    findById: jest.fn<CartRepository["findById"]>(async () => cart),
    withTransaction: jest.fn<RepositoryWithTransaction>(),
  };

  repository.withTransaction.mockImplementation(async (callback) =>
    callback(repository as unknown as CartRepository, createTransactionClientMock()),
  );

  if (overrides.repository) {
    Object.assign(repository, overrides.repository);
  }

  const cacheGetMock = jest.fn(
    async (_scope: CartCacheScope, _key: string) => undefined as CartSummaryView | undefined,
  );
  const cacheSetMock = jest.fn(async () => {});
  const cacheInvalidateMock = jest.fn(async () => {});
  const cacheInvalidateByCartIdMock = jest.fn(async () => {});
  const cacheShutdownMock = jest.fn(async () => {});
  const cache: CartCache = {
    get: cacheGetMock as CartCache["get"],
    set: cacheSetMock as CartCache["set"],
    invalidate: cacheInvalidateMock as CartCache["invalidate"],
    invalidateByCartId: cacheInvalidateByCartIdMock as CartCache["invalidateByCartId"],
    shutdown: cacheShutdownMock as CartCache["shutdown"],
  };

  const emailService = {
    sendCartRecoveryEmail: jest.fn(async () => {}),
  } as unknown as EmailService;

  const service = new CartService({
    repository: repository as unknown as CartRepository,
    cache,
    prisma: {} as PrismaClient,
    disableCleanupJob: true,
    now: () => new Date("2025-03-01T10:00:00.000Z"),
    emailService,
  });

  return {
    service,
    repository,
    cache,
    cacheMocks: {
      get: cacheGetMock,
      set: cacheSetMock,
    },
    cart,
  };
};

const createVariant = (overrides: Partial<CartVariantEntity> = {}): CartVariantEntity => {
  const timestamp = new Date("2025-03-01T10:00:00.000Z");
  const { product: productOverride, inventory: inventoryOverride, ...variantOverride } = overrides;
  const resolvedProductOverride: Partial<CartProductEntity> = productOverride ?? {};

  const baseProduct: CartProductEntity = {
    id: ensureCuid("product-base"),
    title: "Aurora Lamp",
    slug: "aurora-lamp",
    sku: "SKU-P1",
    summary: null,
    description: null,
    price: new Prisma.Decimal("199.00"),
    compareAtPrice: null,
    currency: "TRY",
    status: ProductStatus.ACTIVE,
    inventoryPolicy: InventoryPolicy.TRACK,
    attributes: null,
    searchKeywords: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  };

  const baseVariant: Omit<CartVariantEntity, "product" | "inventory"> = {
    id: ensureCuid("variant-base"),
    title: "Aurora Variant",
    sku: "SKU-V1",
    price: new Prisma.Decimal("199.00"),
    compareAtPrice: null,
    stock: 10,
    attributes: null,
    weightGrams: null,
    isPrimary: true,
    productId: baseProduct.id,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const product: CartProductEntity = {
    ...baseProduct,
    ...resolvedProductOverride,
  };
  product.id = ensureCuid(resolvedProductOverride.id ?? baseProduct.id);

  const variantId = ensureCuid(variantOverride.id ?? baseVariant.id);

  const resolvedInventory =
    (inventoryOverride as CartVariantEntity["inventory"]) ??
    ({
      id: ensureCuid(`inventory-${variantId}`),
      productVariantId: variantId,
      quantityAvailable: variantOverride.stock ?? baseVariant.stock,
      quantityReserved: 0,
      quantityOnHand: variantOverride.stock ?? baseVariant.stock,
      lowStockThreshold: 5,
      createdAt: timestamp,
      updatedAt: timestamp,
    } satisfies CartVariantEntity["inventory"]);

  return {
    ...baseVariant,
    ...variantOverride,
    id: variantId,
    productId: product.id,
    product,
    inventory: resolvedInventory
      ? {
          ...resolvedInventory,
          id: resolvedInventory.id ?? ensureCuid(`inventory-${variantId}`),
          productVariantId: variantId,
          createdAt: resolvedInventory.createdAt ?? timestamp,
          updatedAt: resolvedInventory.updatedAt ?? timestamp,
        }
      : null,
  };
};

const createCartWithItems = ({
  id,
  variant,
  quantity,
  sessionId,
  userId = DEFAULT_USER_ID,
}: {
  id: string;
  variant: NonNullable<CartWithRelations["items"][number]["productVariant"]>;
  quantity: number;
  sessionId?: string | null;
  userId?: string;
}): CartWithRelations => {
  const timestamp = new Date("2025-03-01T10:00:00.000Z");
  const cartId = ensureCuid(id);
  const itemId = ensureCuid(`${id}-item`);
  return {
    id: cartId,
    userId,
    sessionId: sessionId ?? null,
    status: "ACTIVE",
    expiresAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    items: [
      {
        id: itemId,
        cartId,
        productVariantId: variant.id,
        quantity,
        unitPrice: variant.price,
        createdAt: timestamp,
        updatedAt: timestamp,
        productVariant: variant,
      },
    ],
    user: {
      id: userId,
      email: "user@example.com",
      firstName: "Cart",
      lastName: "User",
    },
  } as unknown as CartWithRelations;
};

const createMergeTransaction = (
  variants: NonNullable<CartWithRelations["items"][number]["productVariant"]>[],
) => {
  const variantMap = new Map(variants.map((variant) => [variant.id, variant]));
  return {
    productVariant: {
      findUnique: jest.fn(
        async ({ where: { id } }: { where: { id: string } }) => variantMap.get(id) ?? null,
      ),
      findMany: jest.fn(
        async ({
          where: {
            id: { in: variantIds },
          },
        }) => variants.filter((variant) => variantIds.includes(variant.id)),
      ),
    },
    cartItem: {
      update: jest.fn(async () => {}),
      create: jest.fn(async () => {}),
      deleteMany: jest.fn(async () => {}),
    },
    cart: {
      update: jest.fn(async () => {}),
    },
    inventoryReservation: {
      updateMany: jest.fn(async () => ({})),
    },
    inventoryReservationItem: {
      aggregate: jest.fn(async () => ({ _sum: { quantity: 0 } })),
      groupBy: jest.fn(async () => []),
    },
  };
};

const createCartForVariant = (
  variant: NonNullable<CartWithRelations["items"][number]["productVariant"]>,
  sessionId: string | undefined,
) => {
  const cart = createCartWithItems({
    id: `cart-${variant.id}`,
    variant,
    quantity: 0,
    sessionId,
  });
  cart.items = [];
  return cart;
};

const createContext = () => ({
  userId: DEFAULT_USER_ID,
  sessionId: DEFAULT_SESSION_ID,
});

const createAddItemMutation = (): Awaited<ReturnType<ApplyAddItemFn>> => ({
  itemId: ensureCuid("item-new"),
  variantId: ensureCuid("variant-new"),
  previousQuantity: 1,
  newQuantity: 3,
});

interface MaintenanceServiceOptions {
  staleCarts?: {
    id: string;
    user?: {
      id: string;
      email?: string | null;
      firstName?: string | null;
      lastName?: string | null;
    } | null;
  }[];
  detailedCart?: CartWithRelations | null;
}

const createMaintenanceService = (options: MaintenanceServiceOptions = {}) => {
  const cacheMocks = {
    get: jest.fn(async () => undefined as CartSummaryView | undefined),
    set: jest.fn(async () => {}),
    invalidate: jest.fn(async () => {}),
    invalidateByCartId: jest.fn(async () => {}),
    shutdown: jest.fn(async () => {}),
  };
  const cache: CartCache = {
    get: cacheMocks.get as CartCache["get"],
    set: cacheMocks.set as CartCache["set"],
    invalidate: cacheMocks.invalidate as CartCache["invalidate"],
    invalidateByCartId: cacheMocks.invalidateByCartId as CartCache["invalidateByCartId"],
    shutdown: cacheMocks.shutdown as CartCache["shutdown"],
  };
  const emailServiceMock = {
    sendCartRecoveryEmail: jest.fn(async () => {}),
  };
  const repositoryMock = {
    findById: jest.fn(async () => options.detailedCart ?? null),
  };
  const prismaMock = {
    cart: {
      findMany: jest.fn(async () => options.staleCarts ?? []),
      update: jest.fn(async () => {}),
    },
    inventoryReservation: {
      updateMany: jest.fn(async () => ({})),
    },
  };

  const service = new CartService({
    repository: repositoryMock as unknown as CartRepository,
    cache,
    prisma: prismaMock as unknown as PrismaClient,
    emailService: emailServiceMock as unknown as EmailService,
    disableCleanupJob: true,
    now: () => new Date("2025-03-01T10:00:00.000Z"),
  });

  return {
    service,
    cacheMocks,
    emailServiceMock,
    repositoryMock,
    prismaMock,
  };
};

interface AddItemTransactionOptions {
  variant: NonNullable<CartWithRelations["items"][number]["productVariant"]>;
  cart: CartWithRelations;
  inputQuantity: number;
  existingQuantity?: number;
  stock?: number;
  inventoryPolicy?: InventoryPolicy;
  productStatus?: ProductStatus;
  findVariant?: boolean;
}

const createAddItemTransaction = ({
  variant,
  cart,
  inputQuantity,
  existingQuantity = 0,
  stock,
  inventoryPolicy,
  productStatus,
  findVariant = true,
}: AddItemTransactionOptions): Prisma.TransactionClient => {
  const resolvedInventoryPolicy = inventoryPolicy ?? variant.product.inventoryPolicy;
  const resolvedProductStatus = productStatus ?? variant.product.status;
  const variantEntity = {
    ...variant,
    stock: stock ?? variant.stock,
    product: {
      ...variant.product,
      inventoryPolicy: resolvedInventoryPolicy,
      status: resolvedProductStatus,
    },
    inventory: variant.inventory,
  };

  const existing =
    existingQuantity > 0
      ? {
          id: ensureCuid(`${cart.id}-existing`),
          cartId: cart.id,
          productVariantId: variant.id,
          quantity: existingQuantity,
        }
      : null;

  const upsertResult = {
    id: existing?.id ?? ensureCuid(`${cart.id}-item`),
    cartId: cart.id,
    productVariantId: variant.id,
    quantity: (existing?.quantity ?? 0) + inputQuantity,
    unitPrice: variantEntity.price,
    createdAt: cart.createdAt,
    updatedAt: cart.updatedAt,
  };

  return {
    productVariant: {
      findUnique: jest.fn(async () => (findVariant ? variantEntity : null)),
    },
    cartItem: {
      findUnique: jest.fn(async () => existing),
      upsert: jest.fn(async () => upsertResult),
    },
    cart: {
      update: jest.fn(async () => {}),
    },
    inventoryReservation: {
      updateMany: jest.fn(async () => ({})),
    },
    inventoryReservationItem: {
      aggregate: jest.fn(async () => ({ _sum: { quantity: 0 } })),
      groupBy: jest.fn(async () => []),
    },
  } as unknown as Prisma.TransactionClient;
};

interface UpdateItemEntityOverrides {
  quantity?: number;
  userId?: string;
  stock?: number;
  inventoryPolicy?: InventoryPolicy;
  includeVariant?: boolean;
}

const createUpdateItemEntity = (
  cart: CartWithRelations,
  variant: NonNullable<CartWithRelations["items"][number]["productVariant"]>,
  overrides: UpdateItemEntityOverrides = {},
) => {
  const quantity = overrides.quantity ?? cart.items[0]?.quantity ?? 2;
  const stock = overrides.stock ?? variant.stock;

  const product = {
    ...variant.product,
    inventoryPolicy: overrides.inventoryPolicy ?? variant.product.inventoryPolicy,
    status: variant.product.status,
  };

  const variantEntity =
    overrides.includeVariant === false
      ? null
      : {
          ...variant,
          stock,
          product,
          inventory: variant.inventory,
        };

  return {
    id: ensureCuid(`${cart.id}-item`),
    cartId: cart.id,
    productVariantId: variant.id,
    quantity,
    unitPrice: variant.price,
    createdAt: cart.createdAt,
    updatedAt: cart.updatedAt,
    cart: {
      id: cart.id,
      userId: overrides.userId ?? cart.userId,
    },
    productVariant: variantEntity,
  };
};

const createUpdateTransaction = (
  item: ReturnType<typeof createUpdateItemEntity>,
): Prisma.TransactionClient =>
  ({
    cartItem: {
      findUnique: jest.fn(async () => item),
      update: jest.fn(async () => item),
    },
    cart: {
      update: jest.fn(async () => {}),
    },
    inventoryReservation: {
      updateMany: jest.fn(async () => ({})),
    },
    inventoryReservationItem: {
      aggregate: jest.fn(async () => ({ _sum: { quantity: 0 } })),
      groupBy: jest.fn(async () => []),
    },
  }) as unknown as Prisma.TransactionClient;

describe("CartService", () => {
  it("evaluates stock shortages during cart validation", async () => {
    const { service, cart } = createService();
    const expectedVariantId = cart.items[0]?.productVariantId ?? "unknown";

    const report = await service.validateCart({ userId: DEFAULT_USER_ID });

    expect(report.valid).toBe(false);
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "out_of_stock", variantId: expectedVariantId }),
      ]),
    );
  });

  it("caches cart responses for subsequent requests", async () => {
    const {
      service,
      cart,
      cacheMocks: { get: cacheGet, set: cacheSet },
    } = createService();

    const first = await service.getCart({ userId: DEFAULT_USER_ID, sessionId: DEFAULT_SESSION_ID });
    expect(first.cart.id).toBe(cart.id);
    expect(cacheSet).toHaveBeenCalledTimes(2); // user+session scopes

    cacheGet.mockResolvedValueOnce(first);

    const second = await service.getCart({
      userId: DEFAULT_USER_ID,
      sessionId: DEFAULT_SESSION_ID,
    });
    expect(cacheGet).toHaveBeenCalled();
    expect(second).toBe(first);
  });

  it("creates an inventory reservation when requested during validation", async () => {
    const variant = createVariant({ id: "variant-reserve", stock: 10 });
    const reservableCart = createCartWithItems({
      id: "cart-reserve",
      variant,
      quantity: 2,
    });
    const reservationId = ensureCuid("reservation-ctx");
    const expiresAt = new Date("2025-03-01T12:00:00.000Z");
    const tx = createTransactionClientMock({
      reservation: {
        id: reservationId,
        cartId: reservableCart.id,
        userId: reservableCart.userId ?? DEFAULT_USER_ID,
        status: InventoryReservationStatus.ACTIVE,
        expiresAt,
        createdAt: expiresAt,
        updatedAt: expiresAt,
        items: [
          {
            id: ensureCuid("reservation-item"),
            reservationId,
            productVariantId: reservableCart.items[0]!.productVariantId,
            quantity: reservableCart.items[0]!.quantity,
            createdAt: expiresAt,
            updatedAt: expiresAt,
          },
        ],
      },
    });
    const { service, repository } = createService({ cart: reservableCart });

    repository.withTransaction.mockImplementation(async (callback) =>
      callback(repository as unknown as CartRepository, tx),
    );

    const report = await service.validateCart(createContext(), { reserveInventory: true });

    expect(report.reservation).toEqual(
      expect.objectContaining({
        id: reservationId,
        cartId: reservableCart.id,
        status: "active",
      }),
    );
    expect(tx.inventoryReservation.create).toHaveBeenCalled();
  });

  it("creates a cart when no active cart exists for the user", async () => {
    const variant = createVariant({ id: "variant-new-cart" });
    const createdCart = createCartWithItems({
      id: "cart-new",
      variant,
      quantity: 0,
      sessionId: null,
      userId: DEFAULT_USER_ID,
    });
    createdCart.items = [];

    const overrides: ServiceOverrides = {
      repository: {
        findActiveCartByUser: jest
          .fn<CartRepository["findActiveCartByUser"]>()
          .mockResolvedValueOnce(null)
          .mockResolvedValue(createdCart as CartWithRelations),
        create: jest.fn<CartRepository["create"]>(async () => createdCart as never),
        findById: jest.fn<CartRepository["findById"]>(async () => createdCart as CartWithRelations),
      },
    };

    const {
      service,
      cacheMocks: { set: cacheSet },
    } = createService(overrides);

    const view = await service.getCart({ userId: DEFAULT_USER_ID });

    expect(overrides.repository?.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: DEFAULT_USER_ID,
        sessionId: null,
        status: "ACTIVE",
      }),
    });
    expect(cacheSet).toHaveBeenCalledTimes(1); // only user cache due to missing session
    expect(view.cart.id).toBe(createdCart.id);
  });

  it("computes stock warnings when inventory is running low", () => {
    const lowStockCart = createCartFixture();
    const item = lowStockCart.items[0];
    if (!item) {
      throw new Error("Cart item fixture missing");
    }

    const variant = item.productVariant;
    if (!variant) {
      throw new Error("Variant fixture missing");
    }

    variant.stock = 4;
    item.quantity = 3;

    const { service } = createService({ cart: lowStockCart });
    const internals = service as unknown as {
      computeStockStatus: (cart: CartWithRelations) => CartSummaryView["stock"];
    };

    const stock = internals.computeStockStatus(lowStockCart);
    expect(stock.status).toBe("warning");
    expect(stock.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "low_stock",
          availableQuantity: 4,
          requestedQuantity: 3,
        }),
      ]),
    );
  });

  it("flags unavailable variants and returns backorder delivery estimates", () => {
    const variantMissing = createCartFixture();
    const item = variantMissing.items[0];
    if (!item) {
      throw new Error("Cart item fixture missing");
    }
    // eslint-disable-next-line unicorn/no-null -- emulate variant removal
    item.productVariant = null as unknown as typeof item.productVariant;

    const { service } = createService({ cart: variantMissing });
    const internals = service as unknown as {
      computeStockStatus: (cart: CartWithRelations) => CartSummaryView["stock"];
      estimateDelivery: (
        stock: CartSummaryView["stock"],
        cart: CartWithRelations,
      ) => CartSummaryView["delivery"];
    };

    const stock = internals.computeStockStatus(variantMissing);
    expect(stock.status).toBe("error");
    const delivery = internals.estimateDelivery(stock, variantMissing);
    expect(delivery.status).toBe("backorder");
  });

  it("detects price mismatches during cart evaluation", () => {
    const mismatchCart = createCartFixture();
    const item = mismatchCart.items[0];
    if (!item) {
      throw new Error("Cart item fixture missing");
    }

    const variant = item.productVariant;
    if (!variant) {
      throw new Error("Variant fixture missing");
    }
    variant.stock = 10;
    variant.product.status = ProductStatus.ACTIVE;
    item.unitPrice = new Prisma.Decimal("209.00");

    const { service } = createService({ cart: mismatchCart });
    const internals = service as unknown as {
      evaluateCart: (cart: CartWithRelations) => CartValidationReport;
    };

    const report = internals.evaluateCart(mismatchCart);
    expect(report.valid).toBe(true);
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "price_mismatch",
          expectedUnitPrice: { amount: "199.00", currency: "TRY" },
        }),
      ]),
    );
  });
});

describe("CartService.applyAddItem", () => {
  const context = {
    userId: DEFAULT_USER_ID,
    sessionId: "session-fixture",
  };

  it("creates a new cart item when the variant is available", async () => {
    const { service } = createService();
    const internals = service as unknown as {
      applyAddItem: (
        tx: Prisma.TransactionClient,
        cart: CartWithRelations,
        ctx: { userId: string; sessionId?: string },
        input: { productVariantId: string; quantity: number },
      ) => Promise<{ newQuantity: number }>;
    };

    const variant = createVariant({ id: "variant-add-new" });
    const cart = createCartForVariant(variant, context.sessionId);
    const input = { productVariantId: variant.id, quantity: 2 };
    const tx = createAddItemTransaction({
      variant,
      cart,
      inputQuantity: input.quantity,
    });

    const result = await internals.applyAddItem(tx, cart, context, input);

    expect(result.newQuantity).toBe(2);
    const txInternals = tx as unknown as {
      cartItem: { upsert: jest.Mock };
      cart: { update: jest.Mock };
    };
    expect(txInternals.cartItem.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ quantity: 2 }),
      }),
    );
    expect(txInternals.cart.update).toHaveBeenCalledWith({
      where: { id: cart.id },
      data: expect.objectContaining({ sessionId: context.sessionId }),
    });
  });

  it("increments quantity when the item already exists", async () => {
    const { service } = createService();
    const internals = service as unknown as {
      applyAddItem: (
        tx: Prisma.TransactionClient,
        cart: CartWithRelations,
        ctx: { userId: string; sessionId?: string },
        input: { productVariantId: string; quantity: number },
      ) => Promise<{ newQuantity: number; previousQuantity: number }>;
    };

    const variant = createVariant({ id: "variant-add-existing" });
    const cart = createCartForVariant(variant, context.sessionId);
    const input = { productVariantId: variant.id, quantity: 2 };
    const tx = createAddItemTransaction({
      variant,
      cart,
      existingQuantity: 3,
      inputQuantity: input.quantity,
    });

    const result = await internals.applyAddItem(tx, cart, context, input);
    expect(result.previousQuantity).toBe(3);
    expect(result.newQuantity).toBe(5);
  });

  it("enforces maximum per-item quantity", async () => {
    const { service } = createService();
    const internals = service as unknown as {
      applyAddItem: (
        tx: Prisma.TransactionClient,
        cart: CartWithRelations,
        ctx: { userId: string; sessionId?: string },
        input: { productVariantId: string; quantity: number },
      ) => Promise<unknown>;
    };

    const variant = createVariant({ id: "variant-add-max" });
    const cart = createCartForVariant(variant, context.sessionId);
    const input = { productVariantId: variant.id, quantity: 2 };
    const tx = createAddItemTransaction({
      variant,
      cart,
      existingQuantity: CART_ITEM_MAX_QUANTITY - 1,
      inputQuantity: input.quantity,
    });

    await expect(internals.applyAddItem(tx, cart, context, input)).rejects.toThrow(ValidationError);
    const txInternals = tx as unknown as { cartItem: { upsert: jest.Mock } };
    expect(txInternals.cartItem.upsert).not.toHaveBeenCalled();
  });

  it("rejects when stock is insufficient under restrictive inventory policy", async () => {
    const { service } = createService();
    const internals = service as unknown as {
      applyAddItem: (
        tx: Prisma.TransactionClient,
        cart: CartWithRelations,
        ctx: { userId: string; sessionId?: string },
        input: { productVariantId: string; quantity: number },
      ) => Promise<unknown>;
    };

    const variant = createVariant({ id: "variant-add-conflict" });
    const cart = createCartForVariant(variant, context.sessionId);
    const input = { productVariantId: variant.id, quantity: 3 };
    const tx = createAddItemTransaction({
      variant,
      cart,
      inputQuantity: input.quantity,
      stock: 1,
    });

    await expect(internals.applyAddItem(tx, cart, context, input)).rejects.toThrow(ConflictError);
  });

  it("allows overselling when inventory policy is CONTINUE", async () => {
    const { service } = createService();
    const internals = service as unknown as {
      applyAddItem: (
        tx: Prisma.TransactionClient,
        cart: CartWithRelations,
        ctx: { userId: string; sessionId?: string },
        input: { productVariantId: string; quantity: number },
      ) => Promise<{ newQuantity: number }>;
    };

    const variant = createVariant({ id: "variant-add-continue" });
    variant.product.inventoryPolicy = InventoryPolicy.CONTINUE;
    const cart = createCartForVariant(variant, context.sessionId);
    const input = { productVariantId: variant.id, quantity: 4 };
    const tx = createAddItemTransaction({
      variant,
      cart,
      inputQuantity: input.quantity,
      stock: 0,
      inventoryPolicy: InventoryPolicy.CONTINUE,
    });

    const result = await internals.applyAddItem(tx, cart, context, input);
    expect(result.newQuantity).toBe(4);
  });

  it("rejects when the product is not active", async () => {
    const { service } = createService();
    const internals = service as unknown as {
      applyAddItem: (
        tx: Prisma.TransactionClient,
        cart: CartWithRelations,
        ctx: { userId: string; sessionId?: string },
        input: { productVariantId: string; quantity: number },
      ) => Promise<unknown>;
    };

    const variant = createVariant({ id: "variant-add-inactive" });
    variant.product.status = ProductStatus.ARCHIVED;
    const cart = createCartForVariant(variant, context.sessionId);
    const input = { productVariantId: variant.id, quantity: 1 };
    const tx = createAddItemTransaction({
      variant,
      cart,
      inputQuantity: input.quantity,
      productStatus: ProductStatus.ARCHIVED,
    });

    await expect(internals.applyAddItem(tx, cart, context, input)).rejects.toThrow(ValidationError);
  });

  it("rejects when the product variant cannot be found", async () => {
    const { service } = createService();
    const internals = service as unknown as {
      applyAddItem: (
        tx: Prisma.TransactionClient,
        cart: CartWithRelations,
        ctx: { userId: string; sessionId?: string },
        input: { productVariantId: string; quantity: number },
      ) => Promise<unknown>;
    };

    const variant = createVariant({ id: "variant-add-missing" });
    const cart = createCartForVariant(variant, context.sessionId);
    const input = { productVariantId: variant.id, quantity: 1 };
    const tx = createAddItemTransaction({
      variant,
      cart,
      inputQuantity: input.quantity,
      findVariant: false,
    });

    await expect(internals.applyAddItem(tx, cart, context, input)).rejects.toThrow(ValidationError);
  });
});

describe("CartService.applyUpdateItem", () => {
  const context = {
    userId: DEFAULT_USER_ID,
    sessionId: "session-update",
  };

  const createCartAndVariant = (quantity = 2) => {
    const variant = createVariant({ id: `variant-update-${quantity}` });
    const cart = createCartWithItems({
      id: `cart-update-${quantity}`,
      variant,
      quantity,
      sessionId: context.sessionId,
    });
    return { cart, variant };
  };

  it("updates the quantity of an item", async () => {
    const { service } = createService();
    const internals = service as unknown as {
      applyUpdateItem: (
        tx: Prisma.TransactionClient,
        cart: CartWithRelations,
        ctx: { userId: string; sessionId?: string },
        itemId: string,
        quantity: number,
      ) => Promise<{ previousQuantity: number; newQuantity: number }>;
    };

    const { cart, variant } = createCartAndVariant(2);
    const item = createUpdateItemEntity(cart, variant, { quantity: 2 });
    const tx = createUpdateTransaction(item);
    const itemId = item.id;

    const result = await internals.applyUpdateItem(tx, cart, context, itemId, 4);
    const txInternals = tx as unknown as {
      cartItem: { update: jest.Mock };
    };

    expect(result.previousQuantity).toBe(2);
    expect(result.newQuantity).toBe(4);
    expect(txInternals.cartItem.update).toHaveBeenCalledWith({
      where: { id: itemId },
      data: expect.objectContaining({
        quantity: { set: 4 },
        unitPrice: variant.price,
      }),
    });
  });

  it("sets quantity to zero when removing an item", async () => {
    const { service } = createService();
    const internals = service as unknown as {
      applyUpdateItem: (
        tx: Prisma.TransactionClient,
        cart: CartWithRelations,
        ctx: { userId: string; sessionId?: string },
        itemId: string,
        quantity: number,
      ) => Promise<{ newQuantity: number }>;
    };

    const { cart, variant } = createCartAndVariant(1);
    const item = createUpdateItemEntity(cart, variant, { quantity: 1 });
    const tx = createUpdateTransaction(item);

    const result = await internals.applyUpdateItem(tx, cart, context, item.id, 0);
    const txInternals = tx as unknown as { cartItem: { update: jest.Mock } };

    expect(result.newQuantity).toBe(0);
    expect(txInternals.cartItem.update).toHaveBeenCalledWith({
      where: { id: item.id },
      data: expect.objectContaining({
        quantity: { set: 0 },
      }),
    });
  });

  it("validates maximum quantity for updates", async () => {
    const { service } = createService();
    const internals = service as unknown as {
      applyUpdateItem: (
        tx: Prisma.TransactionClient,
        cart: CartWithRelations,
        ctx: { userId: string; sessionId?: string },
        itemId: string,
        quantity: number,
      ) => Promise<unknown>;
    };

    const { cart, variant } = createCartAndVariant(9);
    const item = createUpdateItemEntity(cart, variant, { quantity: 9 });
    const tx = createUpdateTransaction(item);

    await expect(
      internals.applyUpdateItem(tx, cart, context, item.id, CART_ITEM_MAX_QUANTITY + 1),
    ).rejects.toThrow(ValidationError);
  });

  it("rejects when requested quantity exceeds available stock", async () => {
    const { service } = createService();
    const internals = service as unknown as {
      applyUpdateItem: (
        tx: Prisma.TransactionClient,
        cart: CartWithRelations,
        ctx: { userId: string; sessionId?: string },
        itemId: string,
        quantity: number,
      ) => Promise<unknown>;
    };

    const { cart, variant } = createCartAndVariant(1);
    const item = createUpdateItemEntity(cart, variant, { quantity: 1, stock: 1 });
    const tx = createUpdateTransaction(item);

    await expect(internals.applyUpdateItem(tx, cart, context, item.id, 3)).rejects.toThrow(
      ConflictError,
    );
  });

  it("rejects when the variant is unavailable", async () => {
    const { service } = createService();
    const internals = service as unknown as {
      applyUpdateItem: (
        tx: Prisma.TransactionClient,
        cart: CartWithRelations,
        ctx: { userId: string; sessionId?: string },
        itemId: string,
        quantity: number,
      ) => Promise<unknown>;
    };

    const { cart, variant } = createCartAndVariant(1);
    const item = createUpdateItemEntity(cart, variant, { includeVariant: false });
    const tx = createUpdateTransaction(item);

    await expect(internals.applyUpdateItem(tx, cart, context, item.id, 1)).rejects.toThrow(
      ValidationError,
    );
  });

  it("rejects when the cart item belongs to a different user", async () => {
    const { service } = createService();
    const internals = service as unknown as {
      applyUpdateItem: (
        tx: Prisma.TransactionClient,
        cart: CartWithRelations,
        ctx: { userId: string; sessionId?: string },
        itemId: string,
        quantity: number,
      ) => Promise<unknown>;
    };

    const { cart, variant } = createCartAndVariant(1);
    const item = createUpdateItemEntity(cart, variant, { userId: "other-user" });
    const tx = createUpdateTransaction(item);

    await expect(internals.applyUpdateItem(tx, cart, context, item.id, 2)).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe("CartService.applyMergeCarts", () => {
  it("reconciles existing items when merging with sum strategy", async () => {
    const baseVariant = createVariant({ id: "variant-sum" });
    const guestCart = createCartWithItems({
      id: "guest-cart",
      variant: baseVariant,
      quantity: 3,
    });
    guestCart.items.push({
      id: "guest-item-2",
      cartId: guestCart.id,
      productVariantId: baseVariant.id,
      quantity: 4,
      unitPrice: baseVariant.price,
      createdAt: guestCart.createdAt,
      updatedAt: guestCart.updatedAt,
      productVariant: baseVariant,
    } as unknown as (typeof guestCart.items)[number]);

    const userCart = createCartWithItems({
      id: "user-cart",
      variant: baseVariant,
      quantity: 2,
    });

    const transaction = createMergeTransaction([baseVariant]);
    const { service } = createService();
    const internals = service as unknown as {
      applyMergeCarts: (
        tx: Prisma.TransactionClient,
        guest: CartWithRelations,
        user: CartWithRelations,
        strategy: "sum" | "replace",
      ) => Promise<{ mergedItems: number }>;
    };

    const result = await internals.applyMergeCarts(
      transaction as unknown as Prisma.TransactionClient,
      guestCart,
      userCart,
      "sum",
    );

    const userItem = userCart.items[0];
    if (!userItem) {
      throw new Error("User cart item missing");
    }

    expect(transaction.cartItem.update).toHaveBeenCalledWith({
      where: { id: userItem.id },
      data: expect.objectContaining({
        quantity: { set: Math.min(2 + 3 + 4, CART_ITEM_MAX_QUANTITY) },
      }),
    });
    expect(transaction.cart.update).toHaveBeenCalledWith({
      where: { id: guestCart.id },
      data: expect.objectContaining({ status: "ABANDONED" }),
    });
    expect(transaction.cartItem.deleteMany).toHaveBeenCalledWith({
      where: { cartId: guestCart.id },
    });
    expect(result.mergedItems).toBe(2);
  });

  it("creates new cart items when merging distinct variants", async () => {
    const userVariant = createVariant({ id: "variant-existing" });
    const guestVariant = createVariant({ id: "variant-new" });

    const userCart = createCartWithItems({
      id: "user-cart",
      variant: userVariant,
      quantity: 1,
    });
    const guestCart = createCartWithItems({
      id: "guest-cart",
      variant: guestVariant,
      quantity: 2,
    });

    const txDistinct = createMergeTransaction([userVariant, guestVariant]);
    const { service } = createService();
    const internals = service as unknown as {
      applyMergeCarts: (
        tx: Prisma.TransactionClient,
        guest: CartWithRelations,
        user: CartWithRelations,
        strategy: "sum" | "replace",
      ) => Promise<{ mergedItems: number }>;
    };

    const result = await internals.applyMergeCarts(
      txDistinct as unknown as Prisma.TransactionClient,
      guestCart,
      userCart,
      "sum",
    );

    expect(txDistinct.cartItem.create).toHaveBeenCalledWith({
      data: {
        cartId: userCart.id,
        productVariantId: guestVariant.id,
        quantity: 2,
        unitPrice: guestVariant.price,
      },
    });
    expect(result.mergedItems).toBe(1);
  });

  it("replaces quantities when using replace strategy", async () => {
    const variant = createVariant({ id: "variant-replace" });
    const userCart = createCartWithItems({
      id: "user-cart",
      variant,
      quantity: 9,
    });
    const guestCart = createCartWithItems({
      id: "guest-cart",
      variant,
      quantity: 4,
    });

    const txReplace = createMergeTransaction([variant]);
    const { service } = createService();
    const internals = service as unknown as {
      applyMergeCarts: (
        tx: Prisma.TransactionClient,
        guest: CartWithRelations,
        user: CartWithRelations,
        strategy: "sum" | "replace",
      ) => Promise<{ mergedItems: number }>;
    };

    await internals.applyMergeCarts(
      txReplace as unknown as Prisma.TransactionClient,
      guestCart,
      userCart,
      "replace",
    );

    const userItem = userCart.items[0];
    if (!userItem) {
      throw new Error("User cart item missing");
    }

    expect(txReplace.cartItem.update).toHaveBeenCalledWith({
      where: { id: userItem.id },
      data: expect.objectContaining({
        quantity: { set: 4 },
        unitPrice: variant.price,
      }),
    });
  });
});

describe("CartService public operations", () => {
  it("adds an item through repository transaction and refreshes the cache", async () => {
    const { service, repository, cart } = createService();
    const context = createContext();
    const input = {
      productVariantId: cart.items[0]?.productVariantId ?? "variant-fallback",
      quantity: 2,
    };

    const internal = service as unknown as CartServiceInternals;
    const mutation = createAddItemMutation();
    const applySpy = spyOnCartInternal(internal, "applyAddItem");
    applySpy.mockResolvedValue(mutation);

    cart.items[0]!.quantity = mutation.newQuantity;

    const view = await service.addItem(context, input);

    expect(repository.withTransaction).toHaveBeenCalled();
    expect(applySpy).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), context, input);
    expect(view.cart.items[0]?.quantity).toBe(mutation.newQuantity);

    applySpy.mockRestore();
  });

  it("throws when refreshed cart cannot be found after addItem", async () => {
    const { service, repository, cart } = createService();
    const context = createContext();
    const input = {
      productVariantId: cart.items[0]?.productVariantId ?? "variant-missing",
      quantity: 1,
    };

    const internal = service as unknown as CartServiceInternals;
    const applySpy = spyOnCartInternal(internal, "applyAddItem");
    applySpy.mockResolvedValue(createAddItemMutation());

    repository.findById.mockResolvedValueOnce(null);

    await expect(service.addItem(context, input)).rejects.toThrow(NotFoundError);

    applySpy.mockRestore();
  });

  it("updates item quantity and emits removal when quantity becomes zero", async () => {
    const { service, repository, cart } = createService();
    const context = createContext();
    const item = cart.items[0];
    if (!item) {
      throw new Error("cart fixture missing item");
    }

    const internal = service as unknown as CartServiceInternals;
    const applySpy = spyOnCartInternal(internal, "applyUpdateItem");
    applySpy.mockResolvedValue({
      itemId: item.id,
      variantId: item.productVariantId,
      previousQuantity: 2,
      newQuantity: 0,
    });

    const view = await service.updateItem(context, item.id, { quantity: 0 });

    expect(repository.withTransaction).toHaveBeenCalled();
    expect(applySpy).toHaveBeenCalled();
    expect(view.cart.id).toBe(cart.id);

    applySpy.mockRestore();
  });

  it("clears the cart and returns refreshed state", async () => {
    const { service, repository, cart } = createService();
    const context = createContext();

    const internal = service as unknown as CartServiceInternals;
    const clearSpy = spyOnCartInternal(internal, "applyClearCart");
    clearSpy.mockResolvedValue(1);

    const view = await service.clearCart(context);

    expect(repository.withTransaction).toHaveBeenCalled();
    expect(clearSpy).toHaveBeenCalled();
    expect(view.cart.id).toBe(cart.id);

    clearSpy.mockRestore();
  });

  it("claims guest cart when no user cart exists during merge", async () => {
    const guestVariant = createVariant({ id: "variant-guest" });
    const guestCart = createCartWithItems({
      id: "guest-cart-1",
      variant: guestVariant,
      quantity: 1,
      sessionId: "guest-session",
    });
    guestCart.userId = null;

    const claimedCart = {
      ...guestCart,
      userId: CLAIM_USER_ID,
    } as CartWithRelations;

    const overrides: ServiceOverrides = {
      repository: {
        findActiveCartBySession: jest.fn<CartRepository["findActiveCartBySession"]>(
          async () => guestCart as CartWithRelations,
        ),
        findActiveCartByUser: jest.fn<CartRepository["findActiveCartByUser"]>(async () => null),
        findById: jest.fn<CartRepository["findById"]>().mockResolvedValue(claimedCart),
      },
    };

    const { service, repository } = createService(overrides);

    const view = await service.mergeCart(CLAIM_USER_ID, {
      sessionId: "guest-session",
      strategy: "sum",
    });

    expect(repository.withTransaction).toHaveBeenCalled();
    expect(view.cart.id).toBe(guestCart.id);
    expect(view.cart.userId).toBe(CLAIM_USER_ID);
  });

  it("merges into existing user cart and tracks merged item count", async () => {
    const guestVariant = createVariant({ id: "variant-guest-merge" });
    const userVariant = createVariant({ id: "variant-user-merge" });
    const guestCart = createCartWithItems({
      id: "guest-cart-merge",
      variant: guestVariant,
      quantity: 1,
      sessionId: "guest-session-merge",
    });
    guestCart.userId = null;

    const userCart = createCartWithItems({
      id: "user-cart-merge",
      variant: userVariant,
      quantity: 2,
      sessionId: null,
    });

    const overrides: ServiceOverrides = {
      repository: {
        findActiveCartBySession: jest.fn<CartRepository["findActiveCartBySession"]>(
          async () => guestCart as CartWithRelations,
        ),
        findActiveCartByUser: jest.fn<CartRepository["findActiveCartByUser"]>(
          async () => userCart as CartWithRelations,
        ),
        findById: jest
          .fn<CartRepository["findById"]>()
          .mockResolvedValueOnce(userCart as CartWithRelations)
          .mockResolvedValue(userCart as CartWithRelations),
      },
    };

    const { service, repository } = createService(overrides);
    const internal = service as unknown as CartServiceInternals;
    const mergeSpy = spyOnCartInternal(internal, "applyMergeCarts");
    mergeSpy.mockResolvedValue({
      mergedItems: 2,
    });

    const view = await service.mergeCart(DEFAULT_USER_ID, {
      sessionId: "guest-session-merge",
      strategy: "sum",
    });

    expect(repository.withTransaction).toHaveBeenCalled();
    expect(mergeSpy).toHaveBeenCalled();
    expect(view.cart.id).toBe(userCart.id);

    mergeSpy.mockRestore();
  });

  describe("maintenance operations", () => {
    it("skips cleanup when there are no stale carts", async () => {
      const { service, cacheMocks, prismaMock } = createMaintenanceService();

      await service.cleanupExpiredCarts();

      expect(prismaMock.cart.update).not.toHaveBeenCalled();
      expect(cacheMocks.invalidateByCartId).not.toHaveBeenCalled();
    });

    it("abandons stale carts and triggers recovery emails", async () => {
      const variant = createVariant({ id: "variant-stale" });
      const detailedCart = createCartWithItems({
        id: "stale-cart",
        variant,
        quantity: 1,
        sessionId: null,
      });

      const { service, cacheMocks, prismaMock, emailServiceMock, repositoryMock } =
        createMaintenanceService({
          staleCarts: [
            {
              id: detailedCart.id,
              user: {
                id: DEFAULT_USER_ID,
                email: "user@example.com",
                firstName: "Cart",
                lastName: "User",
              },
            },
          ],
          detailedCart,
        });

      repositoryMock.findById.mockResolvedValueOnce(detailedCart as CartWithRelations);

      await service.cleanupExpiredCarts();

      expect(prismaMock.cart.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: detailedCart.id },
          data: expect.objectContaining({
            status: "ABANDONED",
          }),
        }),
      );
      expect(cacheMocks.invalidateByCartId).toHaveBeenCalledWith(detailedCart.id);
      expect(emailServiceMock.sendCartRecoveryEmail).toHaveBeenCalledWith(
        expect.objectContaining({ cartId: detailedCart.id }),
      );
    });
  });
});

describe("cartServiceInternals", () => {
  it("converts numeric money values to DTO format", () => {
    const numeric = cartServiceInternals.toMoney(19.987, "USD");
    expect(numeric).toEqual({ amount: "19.99", currency: "USD" });

    const fromString = cartServiceInternals.toMoney("42", "USD");
    expect(fromString.amount).toBe("42.00");
  });

  it("compares Prisma decimals for equality", () => {
    const left = new Prisma.Decimal("1.00");
    const right = new Prisma.Decimal("1");
    const different = new Prisma.Decimal("2");
    expect(cartServiceInternals.compareMoney(left, right)).toBe(true);
    expect(cartServiceInternals.compareMoney(left, different)).toBe(false);
  });
});
