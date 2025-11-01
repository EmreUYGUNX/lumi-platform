/* eslint-disable import/order */
import { OrderStatus, Prisma, ProductStatus, ReviewStatus } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

import {
  BaseRepository,
  type CursorPaginatedResult,
  type PaginatedResult,
  type PaginationOptions,
  type RepositoryContext,
} from "@/lib/repository/base.repository.js";
import type { ProductWithRelations } from "@lumi/shared/dto";

type ProductRepositoryContext = RepositoryContext<
  Prisma.ProductDelegate,
  Prisma.ProductWhereInput,
  Prisma.ProductOrderByWithRelationInput
>;

export interface ProductSearchFilters {
  term?: string;
  statuses?: ProductStatus[];
  categoryIds?: string[];
  primaryCategoryId?: string;
  collectionIds?: string[];
  minPrice?: Prisma.Decimal | number;
  maxPrice?: Prisma.Decimal | number;
  includeDeleted?: boolean;
  attributes?: Record<string, string | string[]>;
}

const PRODUCT_DEFAULT_INCLUDE: Prisma.ProductInclude = {
  variants: true,
  productMedia: {
    include: { media: true },
  },
  categories: {
    include: { category: true },
  },
};

const PRODUCT_LISTING_SELECT = {
  id: true,
  title: true,
  slug: true,
  summary: true,
  price: true,
  compareAtPrice: true,
  currency: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  productMedia: {
    orderBy: { sortOrder: "asc" },
    take: 4,
    select: {
      sortOrder: true,
      isPrimary: true,
      media: {
        select: {
          id: true,
          url: true,
          type: true,
          provider: true,
          width: true,
          height: true,
          alt: true,
          caption: true,
        },
      },
    },
  },
  variants: {
    where: { isPrimary: true },
    select: {
      id: true,
      title: true,
      price: true,
      compareAtPrice: true,
      stock: true,
      isPrimary: true,
    },
  },
  categories: {
    select: {
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  },
} satisfies Prisma.ProductSelect;

const toDecimal = (value?: Prisma.Decimal | number): Prisma.Decimal | undefined => {
  if (value === undefined) {
    return undefined;
  }

  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
};

const buildSearchConditions = (term?: string): Prisma.ProductWhereInput["OR"] | undefined => {
  if (!term) {
    return undefined;
  }

  const normalized = term.trim();
  if (normalized.length === 0) {
    return undefined;
  }

  const lowerCase = normalized.toLowerCase();
  return [
    { title: { contains: normalized, mode: "insensitive" } },
    { slug: { contains: normalized, mode: "insensitive" } },
    { searchKeywords: { has: lowerCase } },
  ];
};

const buildStatusCondition = (
  statuses?: ProductStatus[],
): Prisma.ProductWhereInput["status"] | undefined => {
  const count = statuses?.length ?? 0;
  if (count === 0) {
    return undefined;
  }

  return count === 1 ? statuses![0] : { in: statuses };
};

const buildCategoryCondition = (
  filters: ProductSearchFilters,
): Prisma.ProductWhereInput["categories"] | undefined => {
  if (filters.primaryCategoryId) {
    return {
      some: {
        categoryId: filters.primaryCategoryId,
        isPrimary: true,
      },
    };
  }

  const categoryIds = filters.categoryIds ?? [];
  if (categoryIds.length > 0) {
    return {
      some: { categoryId: { in: categoryIds } },
    };
  }

  return undefined;
};

const buildCollectionCondition = (
  collectionIds?: string[],
): Prisma.ProductWhereInput["collections"] | undefined => {
  const ids = collectionIds ?? [];
  if (ids.length === 0) {
    return undefined;
  }

  return {
    some: { collectionId: { in: ids } },
  };
};

const buildPriceFilter = (filters: ProductSearchFilters): Prisma.DecimalFilter | undefined => {
  const gte = toDecimal(filters.minPrice);
  const lte = toDecimal(filters.maxPrice);

  if (gte === undefined && lte === undefined) {
    return undefined;
  }

  return { gte, lte };
};

const buildAttributeConditions = (
  attributes?: Record<string, string | string[]>,
): Prisma.ProductWhereInput[] => {
  if (!attributes) {
    return [];
  }

  const entries = Object.entries(attributes);
  if (entries.length === 0) {
    return [];
  }

  const conditions: Prisma.ProductWhereInput[] = [];

  entries.forEach(([attribute, rawValue]) => {
    if (Array.isArray(rawValue)) {
      const values = rawValue
        .filter((value) => typeof value === "string")
        .map((value) => value.trim())
        .filter((value) => value.length > 0);

      if (values.length === 0) {
        return;
      }

      conditions.push({
        OR: values.map((value) => ({
          attributes: {
            path: [attribute],
            equals: value,
          },
        })),
      });
      return;
    }

    if (typeof rawValue === "string") {
      const trimmed = rawValue.trim();
      if (trimmed.length > 0) {
        conditions.push({
          attributes: {
            path: [attribute],
            equals: trimmed,
          },
        });
      }
    }
  });

  return conditions;
};

export const buildProductSearchWhere = (
  filters: ProductSearchFilters,
): Prisma.ProductWhereInput => {
  const where: Prisma.ProductWhereInput = {};

  if (!filters.includeDeleted) {
    // eslint-disable-next-line unicorn/no-null -- Soft delete filters rely on null sentinel values
    where.deletedAt = null;
  }

  const searchConditions = buildSearchConditions(filters.term);
  if (searchConditions) {
    where.OR = searchConditions;
  }

  const statusCondition = buildStatusCondition(filters.statuses);
  if (statusCondition) {
    where.status = statusCondition;
  }

  const categoryCondition = buildCategoryCondition(filters);
  if (categoryCondition) {
    where.categories = categoryCondition;
  }

  const collectionCondition = buildCollectionCondition(filters.collectionIds);
  if (collectionCondition) {
    where.collections = collectionCondition;
  }

  const priceFilter = buildPriceFilter(filters);
  if (priceFilter) {
    where.price = priceFilter;
  }

  const attributeConditions = buildAttributeConditions(filters.attributes);
  if (attributeConditions.length > 0) {
    const existingAnd = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
    where.AND = [...existingAnd, ...attributeConditions];
  }

  return where;
};

type ProductListingSummary = Prisma.ProductGetPayload<{ select: typeof PRODUCT_LISTING_SELECT }>;

type ProductVariantWithRelations = Prisma.ProductVariantGetPayload<{
  include: {
    variantMedia: {
      include: {
        media: true;
      };
    };
  };
}>;

export class ProductRepository extends BaseRepository<
  Prisma.ProductDelegate,
  Prisma.ProductWhereInput,
  Prisma.ProductOrderByWithRelationInput,
  Prisma.ProductSelect,
  Prisma.ProductInclude
> {
  constructor(
    private readonly prisma: PrismaClient,
    context?: ProductRepositoryContext,
  ) {
    super(
      context ?? {
        modelName: "Product",
        delegate: prisma.product,
        getDelegate: (client) => client.product,
        runInTransaction: (callback) => prisma.$transaction(callback),
        primaryKey: "id",
        softDeleteField: "deletedAt",
        defaultSort: [{ createdAt: "desc" }],
      },
    );
  }

  // eslint-disable-next-line class-methods-use-this -- Explicit instantiation preserves Prisma dependency references
  protected createWithContext(context: ProductRepositoryContext): this {
    return new ProductRepository(this.prisma, context) as this;
  }

  async findBySlug(
    slug: string,
    options: { include?: Prisma.ProductInclude; select?: Prisma.ProductSelect } = {},
  ): Promise<ProductWithRelations | null> {
    const include = options.include ?? PRODUCT_DEFAULT_INCLUDE;

    return (await this.findFirst({
      where: { slug },
      include,
      select: options.select,
    })) as ProductWithRelations | null;
  }

  async search(
    filters: ProductSearchFilters,
    pagination: Omit<
      PaginationOptions<
        Prisma.ProductWhereInput,
        Prisma.ProductOrderByWithRelationInput,
        Prisma.ProductSelect,
        Prisma.ProductInclude
      >,
      "where"
    > = {},
  ): Promise<PaginatedResult<ProductWithRelations>> {
    const where = buildProductSearchWhere(filters);

    const include = pagination.include ?? PRODUCT_DEFAULT_INCLUDE;

    return this.paginate<Prisma.ProductFindManyArgs, ProductWithRelations>({
      ...pagination,
      where,
      include,
      orderBy: pagination.orderBy ?? [{ status: "asc" }, { createdAt: "desc" }],
    });
  }

  async listActiveProducts(limit = 20): Promise<ProductListingSummary[]> {
    const products = await this.findMany({
      where: { status: ProductStatus.ACTIVE },
      select: PRODUCT_LISTING_SELECT,
      take: limit,
    });

    return products as unknown as ProductListingSummary[];
  }

  async getReviewAggregates(
    productIds: string[],
  ): Promise<Map<string, { average: number; count: number }>> {
    if (productIds.length === 0) {
      return new Map();
    }

    const aggregates = await this.prisma.review.groupBy({
      by: ["productId"],
      where: {
        productId: { in: productIds },
        status: ReviewStatus.APPROVED,
      },
      _avg: { rating: true },
      _count: { rating: true },
    });

    const summary = new Map<string, { average: number; count: number }>();

    aggregates.forEach((entry) => {
      const { productId, _avg: avg, _count: count } = entry;
      const averageValue = avg.rating ?? 0;
      const countValue = count.rating ?? 0;

      summary.set(productId, {
        average: typeof averageValue === "number" ? averageValue : Number(averageValue),
        count: countValue,
      });
    });

    return summary;
  }

  async listForRatingSort(
    filters: ProductSearchFilters,
  ): Promise<{ id: string; createdAt: Date }[]> {
    const where = buildProductSearchWhere(filters);
    const records = await this.findMany({
      where,
      select: {
        id: true,
        createdAt: true,
      },
    });

    return records.map((record) => ({
      id: record.id,
      createdAt: record.createdAt,
    }));
  }

  async findWithRelations(ids: string[]): Promise<ProductWithRelations[]> {
    if (ids.length === 0) {
      return [];
    }

    const records = await this.findMany({
      where: { id: { in: ids } },
      include: PRODUCT_DEFAULT_INCLUDE,
    });

    return records as ProductWithRelations[];
  }

  async attachMedia(productId: string, mediaId: string, sortOrder?: number): Promise<void> {
    await this.withTransaction(async (_repo, tx) => {
      await tx.productMedia.upsert({
        where: {
          productId_mediaId: {
            productId,
            mediaId,
          },
        },
        update: {
          sortOrder,
        },
        create: {
          productId,
          mediaId,
          sortOrder,
        },
      });
    });
  }

  async detachMedia(productId: string, mediaId: string): Promise<void> {
    await this.withTransaction(async (_repo, tx) => {
      await tx.productMedia.delete({
        where: {
          productId_mediaId: {
            productId,
            mediaId,
          },
        },
      });
    });
  }

  async addToCategory(productId: string, categoryId: string, isPrimary = false): Promise<void> {
    await this.withTransaction(async (_repo, tx) => {
      await tx.productCategory.upsert({
        where: {
          productId_categoryId: {
            productId,
            categoryId,
          },
        },
        update: { isPrimary },
        create: {
          productId,
          categoryId,
          isPrimary,
        },
      });
    });
  }

  async searchWithCursor(
    filters: ProductSearchFilters,
    pagination: Omit<
      PaginationOptions<
        Prisma.ProductWhereInput,
        Prisma.ProductOrderByWithRelationInput,
        Prisma.ProductSelect,
        Prisma.ProductInclude
      >,
      "where"
    > = {},
  ): Promise<CursorPaginatedResult<ProductListingSummary>> {
    const where = buildProductSearchWhere(filters);

    const result = await this.paginateWithCursor({
      ...pagination,
      where,
      select: PRODUCT_LISTING_SELECT,
      orderBy:
        pagination.orderBy ?? ([{ status: "asc" }, { createdAt: "desc" }, { id: "asc" }] as const),
    });

    return result as unknown as CursorPaginatedResult<ProductListingSummary>;
  }

  async listVariants(
    productId: string,
    options: {
      includeOutOfStock?: boolean;
    } = {},
  ): Promise<ProductVariantWithRelations[]> {
    const where: Prisma.ProductVariantWhereInput = { productId };
    if (options.includeOutOfStock === false) {
      where.stock = { gt: 0 };
    }

    const variants = await this.prisma.productVariant.findMany({
      where,
      include: {
        variantMedia: {
          include: {
            media: true,
          },
        },
      },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    });

    return variants as ProductVariantWithRelations[];
  }

  async countActiveOrderReferences(productId: string): Promise<number> {
    const activeStatuses = [
      OrderStatus.PENDING,
      OrderStatus.PAID,
      OrderStatus.FULFILLED,
      OrderStatus.SHIPPED,
    ];

    return this.prisma.orderItem.count({
      where: {
        productId,
        order: {
          status: { in: activeStatuses },
        },
      },
    });
  }
}
