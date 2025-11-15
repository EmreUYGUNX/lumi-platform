import type { MediaAsset, Prisma, PrismaClient } from "@prisma/client";

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
}

const buildWhereClause = (filters: MediaListFilters = {}): Prisma.MediaAssetWhereInput => {
  const { uploadedById, folder, productId, productVariantId, tag, tags, resourceType, search } =
    filters;
  const where: Prisma.MediaAssetWhereInput = {};

  if (uploadedById) {
    where.uploadedById = uploadedById;
  }

  if (folder) {
    where.folder = { equals: folder, mode: "insensitive" };
  }

  if (resourceType) {
    where.resourceType = { equals: resourceType, mode: "insensitive" };
  }

  if (productId) {
    where.products = {
      some: {
        id: productId,
      },
    };
  }

  if (productVariantId) {
    where.productVariants = {
      some: {
        id: productVariantId,
      },
    };
  }

  const resolvedTags = [...new Set([...(tags ?? []), ...(tag ? [tag] : [])])].filter(
    (entry) => entry && entry.length > 0,
  );

  if (resolvedTags.length > 0) {
    where.tags = {
      hasEvery: resolvedTags,
    };
  }

  if (search) {
    const normalized = search.trim();
    if (normalized.length > 0) {
      where.OR = [
        { publicId: { contains: normalized, mode: "insensitive" } },
        { folder: { contains: normalized, mode: "insensitive" } },
        { tags: { has: normalized } },
      ];
    }
  }

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
