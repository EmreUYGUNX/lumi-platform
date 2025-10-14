import type { Prisma, PrismaClient, User } from "@prisma/client";

import { NotFoundError } from "@/lib/errors.js";
import { BaseRepository, type RepositoryContext } from "@/lib/repository/base.repository.js";

type UserRepositoryContext = RepositoryContext<
  Prisma.UserDelegate,
  Prisma.UserWhereInput,
  Prisma.UserOrderByWithRelationInput
>;

export interface AuthenticationQueryOptions {
  includeRoles?: boolean;
  includePermissions?: boolean;
  requireActive?: boolean;
}

export class UserRepository extends BaseRepository<
  Prisma.UserDelegate,
  Prisma.UserWhereInput,
  Prisma.UserOrderByWithRelationInput,
  Prisma.UserSelect,
  Prisma.UserInclude
> {
  constructor(
    private readonly prisma: PrismaClient,
    context?: UserRepositoryContext,
  ) {
    super(
      context ?? {
        modelName: "User",
        delegate: prisma.user,
        getDelegate: (client) => client.user,
        runInTransaction: (callback) => prisma.$transaction(callback),
        primaryKey: "id",
        defaultSort: [{ createdAt: "desc" }],
      },
    );
  }

  // eslint-disable-next-line class-methods-use-this -- Explicit factory reuses Prisma client dependency
  protected createWithContext(context: UserRepositoryContext): this {
    return new UserRepository(this.prisma, context) as this;
  }

  async findByEmail(
    email: string,
    options: AuthenticationQueryOptions & {
      select?: Prisma.UserSelect;
      include?: Prisma.UserInclude;
    } = {},
  ): Promise<Prisma.UserGetPayload<{
    include?: Prisma.UserInclude;
    select?: Prisma.UserSelect;
  }> | null> {
    const normalisedEmail = email.trim().toLowerCase();
    const baseInclude: Prisma.UserInclude = {};

    if (options.includeRoles) {
      baseInclude.roles = { include: { role: true } };
    }

    if (options.includePermissions) {
      baseInclude.permissions = { include: { permission: true } };
    }

    const include = options.include
      ? { ...baseInclude, ...options.include }
      : Object.keys(baseInclude).length > 0
        ? baseInclude
        : undefined;

    const where: Prisma.UserWhereInput = {
      email: normalisedEmail,
    };

    if (options.requireActive) {
      where.status = "ACTIVE";
    }

    return this.findFirst({
      where,
      include,
      select: options.select,
    });
  }

  async requireById(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundError("User not found.", { details: { id } });
    }

    return user;
  }

  async incrementFailedLoginAttempts(id: string): Promise<void> {
    await this.update({
      where: { id },
      data: {
        failedLoginCount: { increment: 1 },
        // eslint-disable-next-line unicorn/no-null -- Prisma field requires explicit null to clear lockout
        lockoutUntil: null,
      },
    });
  }

  async resetFailedLoginState(id: string): Promise<void> {
    await this.update({
      where: { id },
      data: {
        failedLoginCount: 0,
        // eslint-disable-next-line unicorn/no-null -- Prisma field requires explicit null to clear lockout
        lockoutUntil: null,
      },
    });
  }

  async setLockout(id: string, lockoutUntil: Date | null): Promise<void> {
    await this.update({
      where: { id },
      data: { lockoutUntil },
    });
  }

  async markEmailVerified(id: string): Promise<void> {
    await this.update({
      where: { id },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });
  }

  async enableTwoFactor(id: string, secret: string): Promise<void> {
    await this.update({
      where: { id },
      data: {
        twoFactorEnabled: true,
        twoFactorSecret: secret,
      },
    });
  }

  async disableTwoFactor(id: string): Promise<void> {
    await this.update({
      where: { id },
      data: {
        twoFactorEnabled: false,
        // eslint-disable-next-line unicorn/no-null -- Prisma field requires explicit null to remove secret
        twoFactorSecret: null,
      },
    });
  }
}
