import type { DesignSession, Prisma, PrismaClient } from "@prisma/client";

import {
  BaseRepository,
  type PaginatedResult,
  type RepositoryContext,
} from "@/lib/repository/base.repository.js";

type DesignSessionRepositoryContext = RepositoryContext<
  Prisma.DesignSessionDelegate,
  Prisma.DesignSessionWhereInput,
  Prisma.DesignSessionOrderByWithRelationInput
>;

export interface SessionListFilters {
  productId?: string;
  order?: "asc" | "desc";
}

const DEFAULT_SORT: Prisma.DesignSessionOrderByWithRelationInput[] = [{ lastEditedAt: "desc" }];

const buildOrderBy = (
  filters: SessionListFilters,
): Prisma.DesignSessionOrderByWithRelationInput[] => {
  const direction = filters.order ?? "desc";
  return [{ lastEditedAt: direction }, { createdAt: "desc" }];
};

export class SessionRepository extends BaseRepository<
  Prisma.DesignSessionDelegate,
  Prisma.DesignSessionWhereInput,
  Prisma.DesignSessionOrderByWithRelationInput,
  Prisma.DesignSessionSelect,
  Prisma.DesignSessionInclude
> {
  constructor(
    private readonly prisma: PrismaClient,
    context?: DesignSessionRepositoryContext,
  ) {
    super(
      context ?? {
        modelName: "DesignSession",
        delegate: prisma.designSession,
        getDelegate: (client) => client.designSession,
        runInTransaction: (callback) => prisma.$transaction(callback),
        primaryKey: "id",
        softDeleteField: "deletedAt",
        defaultSort: DEFAULT_SORT,
      },
    );
  }

  // eslint-disable-next-line class-methods-use-this -- Repository factories preserve Prisma dependency injection
  protected createWithContext(context: DesignSessionRepositoryContext): this {
    return new SessionRepository(this.prisma, context) as this;
  }

  async createSession(data: Prisma.DesignSessionCreateInput): Promise<DesignSession> {
    return (await this.create({ data })) as DesignSession;
  }

  async getById(id: string): Promise<DesignSession | null> {
    return (await this.findById(id)) as DesignSession | null;
  }

  async findByUserId(
    userId: string,
    filters: SessionListFilters = {},
    pagination: { page?: number; pageSize?: number } = {},
    options: { now?: Date; includeExpired?: boolean } = {},
  ): Promise<PaginatedResult<DesignSession>> {
    const now = options.now ?? new Date();
    const includeExpired = options.includeExpired ?? false;

    const where: Prisma.DesignSessionWhereInput = {
      userId,
      ...(filters.productId ? { productId: filters.productId } : {}),
      ...(includeExpired ? {} : { expiresAt: { gt: now } }),
    };

    return (await this.paginate({
      where,
      orderBy: buildOrderBy(filters),
      page: pagination.page,
      pageSize: pagination.pageSize,
    })) as PaginatedResult<DesignSession>;
  }

  async findByShareToken(token: string): Promise<DesignSession | null> {
    return (await this.findFirst({
      where: { shareToken: token, isPublic: true },
    })) as DesignSession | null;
  }

  async updateSession(id: string, data: Prisma.DesignSessionUpdateInput): Promise<DesignSession> {
    return (await this.update({ where: { id }, data })) as DesignSession;
  }

  async incrementViewCount(id: string): Promise<DesignSession> {
    return (await this.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    })) as DesignSession;
  }

  async softDeleteSession(id: string, options: { purgeAt?: Date | null } = {}): Promise<void> {
    const purgeAt = options.purgeAt ?? undefined;
    await this.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        purgeAt,
      },
    });
  }

  async cleanupExpired(now: Date = new Date()): Promise<{ deleted: number }> {
    const result = await this.prisma.designSession.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: now } }, { purgeAt: { lt: now } }],
      },
    });

    return { deleted: result.count };
  }
}
