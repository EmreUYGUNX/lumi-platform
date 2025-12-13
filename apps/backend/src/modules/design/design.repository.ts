import type { CustomerDesign, Prisma, PrismaClient } from "@prisma/client";

import {
  BaseRepository,
  type PaginatedResult,
  type RepositoryContext,
} from "@/lib/repository/base.repository.js";

type CustomerDesignRepositoryContext = RepositoryContext<
  Prisma.CustomerDesignDelegate,
  Prisma.CustomerDesignWhereInput,
  Prisma.CustomerDesignOrderByWithRelationInput
>;

export interface DesignListFilters {
  tags?: string[];
  isPublic?: boolean;
  sort?: "createdAt" | "usageCount";
  order?: "asc" | "desc";
}

const DEFAULT_SORT: Prisma.CustomerDesignOrderByWithRelationInput[] = [{ createdAt: "desc" }];

const buildOrderBy = (
  filters: DesignListFilters,
): Prisma.CustomerDesignOrderByWithRelationInput[] => {
  const direction = filters.order ?? "desc";

  if (filters.sort === "usageCount") {
    return [{ usageCount: direction }, { createdAt: "desc" }];
  }

  return [{ createdAt: direction }];
};

export class DesignRepository extends BaseRepository<
  Prisma.CustomerDesignDelegate,
  Prisma.CustomerDesignWhereInput,
  Prisma.CustomerDesignOrderByWithRelationInput,
  Prisma.CustomerDesignSelect,
  Prisma.CustomerDesignInclude
> {
  constructor(
    private readonly prisma: PrismaClient,
    context?: CustomerDesignRepositoryContext,
  ) {
    super(
      context ?? {
        modelName: "CustomerDesign",
        delegate: prisma.customerDesign,
        getDelegate: (client) => client.customerDesign,
        runInTransaction: (callback) => prisma.$transaction(callback),
        primaryKey: "id",
        softDeleteField: "deletedAt",
        defaultSort: DEFAULT_SORT,
      },
    );
  }

  // eslint-disable-next-line class-methods-use-this -- Repository factories preserve Prisma dependency injection
  protected createWithContext(context: CustomerDesignRepositoryContext): this {
    return new DesignRepository(this.prisma, context) as this;
  }

  async createDesign(data: Prisma.CustomerDesignCreateInput): Promise<CustomerDesign> {
    return (await this.create({ data })) as CustomerDesign;
  }

  async getById(id: string): Promise<CustomerDesign | null> {
    return (await this.findById(id)) as CustomerDesign | null;
  }

  async findByUserId(
    userId: string,
    filters: DesignListFilters = {},
    pagination: { page?: number; pageSize?: number } = {},
  ): Promise<PaginatedResult<CustomerDesign>> {
    const tags = filters.tags?.filter(Boolean) ?? [];

    const where: Prisma.CustomerDesignWhereInput = {
      userId,
      ...(tags.length > 0 ? { tags: { hasEvery: tags } } : {}),
      ...(typeof filters.isPublic === "boolean" ? { isPublic: filters.isPublic } : {}),
    };

    return (await this.paginate({
      where,
      orderBy: buildOrderBy(filters),
      page: pagination.page,
      pageSize: pagination.pageSize,
    })) as PaginatedResult<CustomerDesign>;
  }

  async findPublic(
    filters: Omit<DesignListFilters, "isPublic"> = {},
    pagination: { page?: number; pageSize?: number } = {},
  ): Promise<PaginatedResult<CustomerDesign>> {
    const tags = filters.tags?.filter(Boolean) ?? [];

    const where: Prisma.CustomerDesignWhereInput = {
      isPublic: true,
      ...(tags.length > 0 ? { tags: { hasEvery: tags } } : {}),
    };

    return (await this.paginate({
      where,
      orderBy: buildOrderBy(filters),
      page: pagination.page,
      pageSize: pagination.pageSize,
    })) as PaginatedResult<CustomerDesign>;
  }

  async updateUsageCount(id: string): Promise<CustomerDesign> {
    return (await this.update({
      where: { id },
      data: { usageCount: { increment: 1 } },
    })) as CustomerDesign;
  }

  async incrementViewCount(id: string): Promise<CustomerDesign> {
    return (await this.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    })) as CustomerDesign;
  }

  async updateDesign(id: string, data: Prisma.CustomerDesignUpdateInput): Promise<CustomerDesign> {
    return (await this.update({ where: { id }, data })) as CustomerDesign;
  }

  async softDeleteDesign(id: string, options: { purgeAt?: Date | null } = {}): Promise<void> {
    const purgeAt = options.purgeAt ?? undefined;
    await this.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        purgeAt,
      },
    });
  }
}
