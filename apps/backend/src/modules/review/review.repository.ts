import type { Prisma, PrismaClient } from "@prisma/client";
import { ReviewStatus } from "@prisma/client";

import { NotFoundError } from "@/lib/errors.js";
import {
  BaseRepository,
  type PaginatedResult,
  type PaginationOptions,
  type RepositoryContext,
} from "@/lib/repository/base.repository.js";

type ReviewRepositoryContext = RepositoryContext<
  Prisma.ReviewDelegate,
  Prisma.ReviewWhereInput,
  Prisma.ReviewOrderByWithRelationInput
>;

const REVIEW_DEFAULT_INCLUDE: Prisma.ReviewInclude = {
  user: true,
  product: true,
  media: {
    include: { media: true },
  },
};

export class ReviewRepository extends BaseRepository<
  Prisma.ReviewDelegate,
  Prisma.ReviewWhereInput,
  Prisma.ReviewOrderByWithRelationInput,
  Prisma.ReviewSelect,
  Prisma.ReviewInclude
> {
  constructor(
    private readonly prisma: PrismaClient,
    context?: ReviewRepositoryContext,
  ) {
    super(
      context ?? {
        modelName: "Review",
        delegate: prisma.review,
        getDelegate: (client) => client.review,
        runInTransaction: (callback) => prisma.$transaction(callback),
        primaryKey: "id",
        defaultSort: [{ createdAt: "desc" }],
      },
    );
  }

  // eslint-disable-next-line class-methods-use-this -- Explicit instantiation keeps Prisma dependency intact
  protected createWithContext(context: ReviewRepositoryContext): this {
    return new ReviewRepository(this.prisma, context) as this;
  }

  async listForProduct(
    productId: string,
    pagination: Omit<
      PaginationOptions<
        Prisma.ReviewWhereInput,
        Prisma.ReviewOrderByWithRelationInput,
        Prisma.ReviewSelect,
        Prisma.ReviewInclude
      >,
      "where"
    > & { status?: ReviewStatus } = {},
  ): Promise<PaginatedResult<Prisma.ReviewGetPayload<{ include: Prisma.ReviewInclude }>>> {
    const status = pagination.status ?? ReviewStatus.APPROVED;

    return this.paginate({
      ...pagination,
      where: { productId, status },
      include: pagination.include ?? REVIEW_DEFAULT_INCLUDE,
      orderBy: pagination.orderBy ?? [{ createdAt: "desc" }],
    }) as Promise<PaginatedResult<Prisma.ReviewGetPayload<{ include: Prisma.ReviewInclude }>>>;
  }

  async submitReview(
    data: Prisma.ReviewCreateInput,
  ): Promise<Prisma.ReviewGetPayload<{ include: Prisma.ReviewInclude }>> {
    return this.withTransaction(async (_repo, tx) =>
      tx.review.create({
        data,
        include: REVIEW_DEFAULT_INCLUDE,
      }),
    );
  }

  async moderateReview(id: string, status: ReviewStatus, reason?: string): Promise<void> {
    const review = await this.findById(id);
    if (!review) {
      throw new NotFoundError("Review not found.", { details: { id } });
    }

    const baseContent = review.content ?? "";
    const contentWithReason = reason
      ? `${baseContent}
---
Moderation note: ${reason}`.trim()
      : baseContent;

    await this.update({
      where: { id },
      data: {
        status,
        content: contentWithReason || review.content,
      },
    });
  }
}
