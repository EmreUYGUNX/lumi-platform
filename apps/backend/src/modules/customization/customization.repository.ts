import type { Prisma, PrismaClient, ProductCustomization } from "@prisma/client";

import { BaseRepository, type RepositoryContext } from "@/lib/repository/base.repository.js";

type ProductCustomizationRepositoryContext = RepositoryContext<
  Prisma.ProductCustomizationDelegate,
  Prisma.ProductCustomizationWhereInput,
  Prisma.ProductCustomizationOrderByWithRelationInput
>;

const DEFAULT_SORT: Prisma.ProductCustomizationOrderByWithRelationInput[] = [{ updatedAt: "desc" }];

export class CustomizationRepository extends BaseRepository<
  Prisma.ProductCustomizationDelegate,
  Prisma.ProductCustomizationWhereInput,
  Prisma.ProductCustomizationOrderByWithRelationInput,
  Prisma.ProductCustomizationSelect,
  Prisma.ProductCustomizationInclude
> {
  constructor(
    private readonly prisma: PrismaClient,
    context?: ProductCustomizationRepositoryContext,
  ) {
    super(
      context ?? {
        modelName: "ProductCustomization",
        delegate: prisma.productCustomization,
        getDelegate: (client) => client.productCustomization,
        runInTransaction: (callback) => prisma.$transaction(callback),
        primaryKey: "id",
        defaultSort: DEFAULT_SORT,
      },
    );
  }

  // eslint-disable-next-line class-methods-use-this -- Repository factories preserve Prisma dependency injection
  protected createWithContext(context: ProductCustomizationRepositoryContext): this {
    return new CustomizationRepository(this.prisma, context) as this;
  }

  async findByProductId(productId: string): Promise<ProductCustomization | null> {
    return (await this.findFirst({
      where: { productId },
    })) as ProductCustomization | null;
  }

  async createConfig(data: Prisma.ProductCustomizationCreateInput): Promise<ProductCustomization> {
    return (await this.create({ data })) as ProductCustomization;
  }

  async updateConfig(
    productId: string,
    data: Prisma.ProductCustomizationUpdateInput,
  ): Promise<ProductCustomization> {
    return (await this.update({ where: { productId }, data })) as ProductCustomization;
  }

  async deleteConfig(productId: string): Promise<ProductCustomization> {
    return (await this.delete({ where: { productId } })) as ProductCustomization;
  }
}
