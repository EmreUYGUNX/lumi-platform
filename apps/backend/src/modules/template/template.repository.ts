import type { DesignTemplate, Prisma, PrismaClient } from "@prisma/client";

import {
  BaseRepository,
  type PaginatedResult,
  type RepositoryContext,
} from "@/lib/repository/base.repository.js";

type TemplateRepositoryContext = RepositoryContext<
  Prisma.DesignTemplateDelegate,
  Prisma.DesignTemplateWhereInput,
  Prisma.DesignTemplateOrderByWithRelationInput
>;

export interface TemplateListFilters {
  category?: string;
  tags?: string[];
  isPaid?: boolean;
  isPublished?: boolean;
  isFeatured?: boolean;
  sort?: "popularity" | "newest";
  order?: "asc" | "desc";
}

const DEFAULT_SORT: Prisma.DesignTemplateOrderByWithRelationInput[] = [{ createdAt: "desc" }];

const buildOrderBy = (
  filters: TemplateListFilters,
): Prisma.DesignTemplateOrderByWithRelationInput[] => {
  const direction = filters.order ?? "desc";

  if (filters.sort === "popularity") {
    return [{ usageCount: direction }, { createdAt: "desc" }];
  }

  return [{ createdAt: direction }];
};

export class TemplateRepository extends BaseRepository<
  Prisma.DesignTemplateDelegate,
  Prisma.DesignTemplateWhereInput,
  Prisma.DesignTemplateOrderByWithRelationInput,
  Prisma.DesignTemplateSelect,
  never
> {
  constructor(
    private readonly prisma: PrismaClient,
    context?: TemplateRepositoryContext,
  ) {
    super(
      context ?? {
        modelName: "DesignTemplate",
        delegate: prisma.designTemplate,
        getDelegate: (client) => client.designTemplate,
        runInTransaction: (callback) => prisma.$transaction(callback),
        primaryKey: "id",
        softDeleteField: "deletedAt",
        defaultSort: DEFAULT_SORT,
      },
    );
  }

  // eslint-disable-next-line class-methods-use-this -- Repository factories preserve Prisma dependency injection
  protected createWithContext(context: TemplateRepositoryContext): this {
    return new TemplateRepository(this.prisma, context) as this;
  }

  async findAll(
    filters: TemplateListFilters = {},
    pagination: { page?: number; pageSize?: number } = {},
  ): Promise<PaginatedResult<DesignTemplate>> {
    const tags = filters.tags?.filter(Boolean) ?? [];
    const category = filters.category?.trim();

    const where: Prisma.DesignTemplateWhereInput = {
      ...(category ? { category } : {}),
      ...(tags.length > 0 ? { tags: { hasEvery: tags } } : {}),
      ...(typeof filters.isPaid === "boolean" ? { isPaid: filters.isPaid } : {}),
      ...(typeof filters.isPublished === "boolean" ? { isPublished: filters.isPublished } : {}),
      ...(typeof filters.isFeatured === "boolean" ? { isFeatured: filters.isFeatured } : {}),
    };

    return (await this.paginate({
      where,
      orderBy: buildOrderBy(filters),
      page: pagination.page,
      pageSize: pagination.pageSize,
    })) as PaginatedResult<DesignTemplate>;
  }

  async findByIdOrThrow(id: string): Promise<DesignTemplate> {
    return (await this.findById(id)) as DesignTemplate;
  }

  async createTemplate(data: Prisma.DesignTemplateCreateInput): Promise<DesignTemplate> {
    return (await this.create({ data })) as DesignTemplate;
  }

  async updateTemplate(
    id: string,
    data: Prisma.DesignTemplateUpdateInput,
  ): Promise<DesignTemplate> {
    return (await this.update({ where: { id }, data })) as DesignTemplate;
  }

  async incrementUsage(id: string): Promise<DesignTemplate> {
    return (await this.update({
      where: { id },
      data: { usageCount: { increment: 1 } },
    })) as DesignTemplate;
  }

  async softDeleteTemplate(id: string): Promise<DesignTemplate> {
    return (await this.update({
      where: { id },
      data: { deletedAt: new Date() },
    })) as DesignTemplate;
  }
}
