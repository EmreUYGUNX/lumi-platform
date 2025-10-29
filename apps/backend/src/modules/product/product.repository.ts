/* eslint-disable import/order */
import { Prisma, ProductStatus } from "@prisma/client";
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

const buildProductSearchWhere = (filters: ProductSearchFilters): Prisma.ProductWhereInput => {
  const where: Prisma.ProductWhereInput = {};

  if (!filters.includeDeleted) {
    // eslint-disable-next-line unicorn/no-null -- Soft delete filters rely on null sentinel values
    where.deletedAt = null;
  }

  if (filters.term) {
    const normalized = filters.term.trim();
    where.OR = [
      { title: { contains: normalized, mode: "insensitive" } },
      { slug: { contains: normalized, mode: "insensitive" } },
      { searchKeywords: { has: normalized.toLowerCase() } },
    ];
  }

  if (filters.statuses?.length) {
    where.status = filters.statuses.length === 1 ? filters.statuses[0] : { in: filters.statuses };
  }

  if (filters.primaryCategoryId) {
    where.categories = {
      some: {
        categoryId: filters.primaryCategoryId,
        isPrimary: true,
      },
    };
  } else if (filters.categoryIds?.length) {
    where.categories = {
      some: { categoryId: { in: filters.categoryIds } },
    };
  }

  if (filters.collectionIds?.length) {
    where.collections = {
      some: { collectionId: { in: filters.collectionIds } },
    };
  }

  const priceFilter = {
    gte: toDecimal(filters.minPrice),
    lte: toDecimal(filters.maxPrice),
  } as Prisma.DecimalFilter;

  if (priceFilter.gte !== undefined || priceFilter.lte !== undefined) {
    where.price = priceFilter;
  }

  return where;
};

type ProductListingSummary = Prisma.ProductGetPayload<{ select: typeof PRODUCT_LISTING_SELECT }>;

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
}
