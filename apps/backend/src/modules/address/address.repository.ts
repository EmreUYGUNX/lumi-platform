import type { Address, Prisma, PrismaClient } from "@prisma/client";

import { NotFoundError } from "@/lib/errors.js";
import { BaseRepository, type RepositoryContext } from "@/lib/repository/base.repository.js";

type AddressRepositoryContext = RepositoryContext<
  Prisma.AddressDelegate,
  Prisma.AddressWhereInput,
  Prisma.AddressOrderByWithRelationInput
>;

export class AddressRepository extends BaseRepository<
  Prisma.AddressDelegate,
  Prisma.AddressWhereInput,
  Prisma.AddressOrderByWithRelationInput,
  Prisma.AddressSelect,
  Prisma.AddressInclude
> {
  constructor(
    private readonly prisma: PrismaClient,
    context?: AddressRepositoryContext,
  ) {
    super(
      context ?? {
        modelName: "Address",
        delegate: prisma.address,
        getDelegate: (client) => client.address,
        runInTransaction: (callback) => prisma.$transaction(callback),
        primaryKey: "id",
        defaultSort: [{ createdAt: "desc" }],
      },
    );
  }

  // eslint-disable-next-line class-methods-use-this -- Explicit creation ensures shared Prisma client usage
  protected createWithContext(context: AddressRepositoryContext): this {
    return new AddressRepository(this.prisma, context) as this;
  }

  async listByUser(userId: string): Promise<Address[]> {
    return this.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
  }

  async getDefaultAddress(userId: string): Promise<Address | null> {
    return this.findFirst({
      where: {
        userId,
        isDefault: true,
      },
    });
  }

  async setDefaultAddress(userId: string, addressId: string): Promise<void> {
    await this.withTransaction(async (_repo, tx) => {
      const address = await tx.address.findFirst({
        where: { id: addressId, userId },
      });

      if (!address) {
        throw new NotFoundError("Address not found.", { details: { userId, addressId } });
      }

      await tx.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });

      await tx.address.update({
        where: { id: addressId },
        data: { isDefault: true },
      });
    });
  }
}
