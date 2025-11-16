import type { MediaAsset, MediaVisibility, Prisma, PrismaClient } from "@prisma/client";

import {
  BaseRepository,
  type PaginatedResult,
  type PaginationOptions,
  type RepositoryContext,
} from "@/lib/repository/base.repository.js";

type MediaRepositoryContext = RepositoryContext<
  Prisma.MediaAssetDelegate,
  Prisma.MediaAssetWhereInput,
  Prisma.MediaAssetOrderByWithRelationInput
>;

export interface MediaAccessFilter {
  ownerId?: string;
  visibilities?: MediaVisibility[];
}

export interface MediaListFilters {
  uploadedById?: string;
  folder?: string;
  productId?: string;
  productVariantId?: string;
  tag?: string;
  tags?: string[];
  resourceType?: string;
  search?: string;
  includeDeleted?: boolean;
  access?: MediaAccessFilter;
}

const createInsensitiveEquals = (value?: string) =>
  value ? ({ equals: value, mode: "insensitive" } as const) : undefined;

const normaliseTagFilters = (tag?: string, tags?: string[]): string[] =>
  [...new Set([...(tags ?? []), ...(tag ? [tag] : [])])].filter((entry) => entry?.length);

const appendAccessFilters = (
  where: Prisma.MediaAssetWhereInput,
  access?: MediaAccessFilter,
): Prisma.MediaAssetWhereInput => {
  if (!access) {
    return where;
  }

  const clauses: Prisma.MediaAssetWhereInput[] = [];
  if (access.ownerId) {
    clauses.push({ uploadedById: access.ownerId });
  }

  if (access.visibilities?.length) {
    clauses.push({ visibility: { in: access.visibilities } });
  }

  if (clauses.length === 0) {
    return where;
  }

  const existing = where.AND ? (Array.isArray(where.AND) ? [...where.AND] : [where.AND]) : [];
  existing.push({ OR: clauses });
  return {
    ...where,
    AND: existing,
  };
};

const appendSearchFilters = (
  where: Prisma.MediaAssetWhereInput,
  search?: string,
): Prisma.MediaAssetWhereInput => {
  const normalized = search?.trim();
  if (!normalized) {
    return where;
  }

  return {
    ...where,
    OR: [
      { publicId: { contains: normalized, mode: "insensitive" } },
      { folder: { contains: normalized, mode: "insensitive" } },
      { tags: { has: normalized } },
    ],
  };
};

const buildWhereClause = (filters: MediaListFilters = {}): Prisma.MediaAssetWhereInput => {
  let where: Prisma.MediaAssetWhereInput = {};

  if (filters.uploadedById) {
    where = { ...where, uploadedById: filters.uploadedById };
  }

  const folderFilter = createInsensitiveEquals(filters.folder);
  if (folderFilter) {
    where = { ...where, folder: folderFilter };
  }

  const resourceFilter = createInsensitiveEquals(filters.resourceType);
  if (resourceFilter) {
    where = { ...where, resourceType: resourceFilter };
  }

  if (filters.productId) {
    where = { ...where, products: { some: { id: filters.productId } } };
  }

  if (filters.productVariantId) {
    where = { ...where, productVariants: { some: { id: filters.productVariantId } } };
  }

  const resolvedTags = normaliseTagFilters(filters.tag, filters.tags);
  if (resolvedTags.length > 0) {
    where = { ...where, tags: { hasEvery: resolvedTags } };
  }

  where = appendSearchFilters(where, filters.search);
  where = appendAccessFilters(where, filters.access);

  return where;
};

export const mediaRepositoryInternals = {
  buildWhereClause,
};

export class MediaRepository extends BaseRepository<
  Prisma.MediaAssetDelegate,
  Prisma.MediaAssetWhereInput,
  Prisma.MediaAssetOrderByWithRelationInput,
  Prisma.MediaAssetSelect,
  Prisma.MediaAssetInclude
> {
  constructor(
    private readonly prisma: PrismaClient,
    context?: MediaRepositoryContext,
  ) {
    super(
      context ?? {
        modelName: "MediaAsset",
        delegate: prisma.mediaAsset,
        getDelegate: (client) => client.mediaAsset,
        runInTransaction: (callback) => prisma.$transaction(callback),
        primaryKey: "id",
        softDeleteField: "deletedAt",
        defaultSort: [{ createdAt: "desc" }],
      },
    );
  }

  // eslint-disable-next-line class-methods-use-this -- Direct instantiation maintains Prisma dependency references
  protected createWithContext(context: MediaRepositoryContext): this {
    return new MediaRepository(this.prisma, context) as this;
  }

  async createAsset(data: Prisma.MediaAssetCreateInput): Promise<MediaAsset> {
    return this.create({
      data,
    }) as Promise<MediaAsset>;
  }

  async getById(
    id: string,
    args?: Omit<Prisma.MediaAssetFindFirstArgs, "where">,
  ): Promise<MediaAsset | null> {
    return (await this.findById(id, args)) as MediaAsset | null;
  }

  async getByIdIncludingDeleted(
    id: string,
    args?: Omit<Prisma.MediaAssetFindFirstArgs, "where">,
  ): Promise<MediaAsset | null> {
    const baseArgs = args ? { ...(args as Record<string, unknown>) } : {};
    return (await this.executeOperation("findByIdIncludingDeleted", () =>
      this.delegate.findFirst({
        ...baseArgs,
        where: { id },
      }),
    )) as MediaAsset | null;
  }

  async findByPublicId(publicId: string): Promise<MediaAsset | null> {
    return (await this.findFirst({
      where: { publicId },
    })) as MediaAsset | null;
  }

  async list(
    filters: MediaListFilters = {},
    pagination: Omit<
      PaginationOptions<
        Prisma.MediaAssetWhereInput,
        Prisma.MediaAssetOrderByWithRelationInput,
        Prisma.MediaAssetSelect,
        Prisma.MediaAssetInclude
      >,
      "where"
    > = {},
  ): Promise<PaginatedResult<MediaAsset>> {
    const where = buildWhereClause(filters);

    if (filters.includeDeleted) {
      const page = Math.max(pagination.page ?? 1, 1);
      const pageSize = Math.max(pagination.pageSize ?? 25, 1);
      const skip = pagination.skip ?? (page - 1) * pageSize;
      const take = pagination.take ?? pageSize;
      const cursor = pagination.cursor as Prisma.MediaAssetWhereUniqueInput | undefined;

      const findManyArgs: Prisma.MediaAssetFindManyArgs = {
        where,
        orderBy: (pagination.orderBy ??
          this.context.defaultSort ??
          ({ createdAt: "desc" } satisfies Prisma.MediaAssetOrderByWithRelationInput)) as
          | Prisma.MediaAssetOrderByWithRelationInput
          | Prisma.MediaAssetOrderByWithRelationInput[],
        select: pagination.select,
        include: pagination.include,
        take,
      };
      if (cursor) {
        findManyArgs.cursor = cursor;
        findManyArgs.skip = 1;
      } else if (skip > 0) {
        findManyArgs.skip = skip;
      }

      const [totalItems, records] = await Promise.all([
        this.delegate.count({ where }),
        this.delegate.findMany(findManyArgs),
      ]);

      const totalPages = Math.max(Math.ceil(totalItems / pageSize), 1);

      return {
        items: records as MediaAsset[],
        meta: {
          page,
          pageSize,
          totalItems,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      };
    }

    return (await this.paginate({
      ...pagination,
      where,
    })) as unknown as PaginatedResult<MediaAsset>;
  }

  async updateMetadata(id: string, data: Prisma.MediaAssetUpdateInput): Promise<MediaAsset> {
    return this.update({
      where: { id },
      data,
    }) as Promise<MediaAsset>;
  }

  async softDeleteAsset(id: string): Promise<MediaAsset> {
    return (await super.softDelete(id)) as MediaAsset;
  }

  async restoreAsset(id: string): Promise<MediaAsset> {
    return (await super.restore(id)) as MediaAsset;
  }

  async findOrphans(limit = 50): Promise<MediaAsset[]> {
    return (await this.findMany({
      where: {
        products: { none: {} },
        productVariants: { none: {} },
      },
      take: Math.max(1, Math.min(limit, 200)),
    })) as MediaAsset[];
  }

  async forceDeleteAsset(id: string): Promise<MediaAsset> {
    return (await this.executeOperation("forceDelete", () =>
      this.prisma.mediaAsset.delete({ where: { id } }),
    )) as MediaAsset;
  }
}
