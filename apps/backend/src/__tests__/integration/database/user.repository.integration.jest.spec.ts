import { beforeAll, beforeEach, describe, expect, it } from "@jest/globals";
import type { Prisma, PrismaClient } from "@prisma/client";
import { UserStatus } from "@prisma/client";

import { ConflictError, NotFoundError } from "@/lib/errors.js";
import { UserRepository } from "@/modules/user/user.repository.js";

import { TEST_PASSWORD_HASH, createUser } from "../../fixtures/index.js";
import { getTestDatabaseManager } from "../../helpers/db.js";

describe("UserRepository (database)", () => {
  const testDatabase = getTestDatabaseManager();
  let prisma: PrismaClient;
  let repository: UserRepository;

  beforeAll(async () => {
    prisma = await testDatabase.getPrismaClient();
  });

  beforeEach(() => {
    repository = new UserRepository(prisma);
  });

  it("normalises email lookups and hydrates relations when requested", async () => {
    const user = await repository.create({
      data: {
        email: "customer@example.com",
        passwordHash: TEST_PASSWORD_HASH,
        firstName: "Customer",
        lastName: "Example",
      },
    });

    const role = await prisma.role.create({
      data: { name: "customer", description: "Customer role" },
    });

    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: role.id,
      },
    });

    const found = (await repository.findByEmail("  CUSTOMER@example.com  ", {
      includeRoles: true,
      requireActive: true,
    })) as Prisma.UserGetPayload<{
      include: { roles: { include: { role: true } } };
    }> | null;

    expect(found).not.toBeNull();
    expect(found?.email).toBe("customer@example.com");
    expect(found?.roles).toHaveLength(1);
    expect(found?.roles?.[0]?.role.name).toBe("customer");
  });

  it("throws ConflictError when creating duplicate emails (P2002)", async () => {
    const email = "duplicate@example.com";
    await repository.create({
      data: {
        email,
        passwordHash: TEST_PASSWORD_HASH,
      },
    });

    await expect(
      repository.create({
        data: {
          email,
          passwordHash: TEST_PASSWORD_HASH,
        },
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("throws NotFoundError when requiring a missing user (P2025)", async () => {
    await expect(repository.requireById("missing-user-id")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("tracks authentication state transitions", async () => {
    const user = await createUser(prisma, { status: UserStatus.ACTIVE });

    await repository.incrementFailedLoginAttempts(user.id);
    await repository.setLockout(user.id, new Date("2030-01-01T00:00:00Z"));
    await repository.resetFailedLoginState(user.id);
    await repository.markEmailVerified(user.id);

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

    expect(updated.failedLoginCount).toBe(0);
    expect(updated.lockoutUntil).toBeNull();
    expect(updated.emailVerified).toBe(true);
    expect(updated.emailVerifiedAt).toBeInstanceOf(Date);
  });
});
