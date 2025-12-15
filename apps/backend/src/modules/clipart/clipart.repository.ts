import type { ClipartAsset, Prisma, PrismaClient } from "@prisma/client";

import {
  BaseRepository,
  type PaginatedResult,
  type RepositoryContext,
} from "@/lib/repository/base.repository.js";

type ClipartRepositoryContext = RepositoryContext<
  Prisma.ClipartAssetDelegate,
  Prisma.ClipartAssetWhereInput,
  Prisma.ClipartAssetOrderByWithRelationInput
>;

export interface ClipartListFilters {
  category?: string;
  tags?: string[];
  isPaid?: boolean;
  sort?: "popularity" | "newest";
  order?: "asc" | "desc";
}

const DEFAULT_SORT: Prisma.ClipartAssetOrderByWithRelationInput[] = [{ createdAt: "desc" }];

const buildOrderBy = (
  filters: ClipartListFilters,
): Prisma.ClipartAssetOrderByWithRelationInput[] => {
  const direction = filters.order ?? "desc";

  if (filters.sort === "popularity") {
    return [{ usageCount: direction }, { createdAt: "desc" }];
  }

  return [{ createdAt: direction }];
};

export class ClipartRepository extends BaseRepository<
  Prisma.ClipartAssetDelegate,
  Prisma.ClipartAssetWhereInput,
  Prisma.ClipartAssetOrderByWithRelationInput,
  Prisma.ClipartAssetSelect,
  never
> {
  constructor(
    private readonly prisma: PrismaClient,
    context?: ClipartRepositoryContext,
  ) {
    super(
      context ?? {
        modelName: "ClipartAsset",
        delegate: prisma.clipartAsset,
        getDelegate: (client) => client.clipartAsset,
        runInTransaction: (callback) => prisma.$transaction(callback),
        primaryKey: "id",
        softDeleteField: "deletedAt",
        defaultSort: DEFAULT_SORT,
      },
    );
  }

  // eslint-disable-next-line class-methods-use-this -- Repository factories preserve Prisma dependency injection
  protected createWithContext(context: ClipartRepositoryContext): this {
    return new ClipartRepository(this.prisma, context) as this;
  }

  async findAll(
    filters: ClipartListFilters = {},
    pagination: { page?: number; pageSize?: number } = {},
  ): Promise<PaginatedResult<ClipartAsset>> {
    const tags = filters.tags?.filter(Boolean) ?? [];
    const category = filters.category?.trim();

    const where: Prisma.ClipartAssetWhereInput = {
      ...(category ? { category } : {}),
      ...(tags.length > 0 ? { tags: { hasEvery: tags } } : {}),
      ...(typeof filters.isPaid === "boolean" ? { isPaid: filters.isPaid } : {}),
    };

    return (await this.paginate({
      where,
      orderBy: buildOrderBy(filters),
      page: pagination.page,
      pageSize: pagination.pageSize,
    })) as PaginatedResult<ClipartAsset>;
  }

  async findByIdOrThrow(id: string): Promise<ClipartAsset> {
    return (await this.findById(id)) as ClipartAsset;
  }

  async createClipart(data: Prisma.ClipartAssetCreateInput): Promise<ClipartAsset> {
    return (await this.create({ data })) as ClipartAsset;
  }

  async updateClipart(id: string, data: Prisma.ClipartAssetUpdateInput): Promise<ClipartAsset> {
    return (await this.update({ where: { id }, data })) as ClipartAsset;
  }

  async incrementUsage(id: string): Promise<ClipartAsset> {
    return (await this.update({
      where: { id },
      data: { usageCount: { increment: 1 } },
    })) as ClipartAsset;
  }

  async softDeleteClipart(id: string): Promise<ClipartAsset> {
    return (await this.update({
      where: { id },
      data: { deletedAt: new Date() },
    })) as ClipartAsset;
  }
}
