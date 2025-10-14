import type { Media, Prisma, PrismaClient } from "@prisma/client";

import { BaseRepository, type RepositoryContext } from "@/lib/repository/base.repository.js";

type MediaRepositoryContext = RepositoryContext<
  Prisma.MediaDelegate,
  Prisma.MediaWhereInput,
  Prisma.MediaOrderByWithRelationInput
>;

export class MediaRepository extends BaseRepository<
  Prisma.MediaDelegate,
  Prisma.MediaWhereInput,
  Prisma.MediaOrderByWithRelationInput,
  Prisma.MediaSelect,
  Prisma.MediaInclude
> {
  constructor(
    private readonly prisma: PrismaClient,
    context?: MediaRepositoryContext,
  ) {
    super(
      context ?? {
        modelName: "Media",
        delegate: prisma.media,
        getDelegate: (client) => client.media,
        runInTransaction: (callback) => prisma.$transaction(callback),
        primaryKey: "id",
        defaultSort: [{ createdAt: "desc" }],
      },
    );
  }

  // eslint-disable-next-line class-methods-use-this -- Direct instantiation maintains Prisma dependency references
  protected createWithContext(context: MediaRepositoryContext): this {
    return new MediaRepository(this.prisma, context) as this;
  }

  async findByAssetId(assetId: string) {
    return this.findFirst({
      where: { assetId },
    });
  }

  async upsertMedia(data: Prisma.MediaCreateInput): Promise<Media> {
    return this.withTransaction(async (_repo, tx) => {
      const existing = await tx.media.findFirst({
        where: { assetId: data.assetId },
      });

      if (existing) {
        return tx.media.update({
          where: { id: existing.id },
          data,
        });
      }

      return tx.media.create({
        data,
      });
    });
  }

  async listByIds(ids: string[]): Promise<Media[]> {
    if (ids.length === 0) {
      return [];
    }

    return this.findMany({
      where: { id: { in: ids } },
    }) as Promise<Media[]>;
  }
}
