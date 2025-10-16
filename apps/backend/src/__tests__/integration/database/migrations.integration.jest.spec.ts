import { describe, expect, it } from "@jest/globals";
import type { PrismaClient } from "@prisma/client";

import { TEST_PASSWORD_HASH, createProductBundle, createUser } from "../../fixtures/index.js";
import { TestDatabaseManager } from "../../helpers/db.js";

const createIsolatedManager = async (): Promise<{
  manager: TestDatabaseManager;
  prisma: PrismaClient;
}> => {
  const manager = new TestDatabaseManager();
  const prisma = await manager.getPrismaClient();
  return { manager, prisma };
};

describe("Prisma migrations and seeding", () => {
  it("applies migrations cleanly", async () => {
    const { manager, prisma } = await createIsolatedManager();
    try {
      const status = await manager.runPrismaCommand(["migrate", "status"]);
      expect(status.stdout.toLowerCase()).toContain("database schema is up to date");

      const migrations = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint AS count FROM "_prisma_migrations"
      `;
      expect(Number(migrations[0]?.count ?? 0)).toBeGreaterThan(0);
    } finally {
      await manager.stop();
    }
  });

  it("supports resetting migrations for rollback scenarios", async () => {
    const { manager } = await createIsolatedManager();
    try {
      await manager.runPrismaCommand(["migrate", "deploy"]);
      await manager.runPrismaCommand(["migrate", "reset", "--force", "--skip-seed"]);

      const status = await manager.runPrismaCommand(["migrate", "status"]);
      expect(status.stdout.toLowerCase()).toContain("database schema is up to date");
    } finally {
      await manager.stop();
    }
  });

  it("ensures seed scripts are idempotent", async () => {
    const { manager, prisma } = await createIsolatedManager();
    try {
      await manager.seedDatabase({ SEED_PROFILE: "development" });
      const baseline = await prisma.role.count();

      await manager.seedDatabase({ SEED_PROFILE: "development" });
      const secondRun = await prisma.role.count();

      expect(secondRun).toBe(baseline);
      expect(baseline).toBeGreaterThan(0);
    } finally {
      await manager.stop();
    }
  });

  it("validates schema consistency with Prisma", async () => {
    const { manager } = await createIsolatedManager();
    try {
      const validate = await manager.runPrismaCommand(["validate"]);
      expect(validate.stdout.toLowerCase()).toContain("is valid");
    } finally {
      await manager.stop();
    }
  });

  it("enforces database constraints", async () => {
    const { manager, prisma } = await createIsolatedManager();
    try {
      const user = await createUser(prisma, {
        email: "duplicate@test.com",
        passwordHash: TEST_PASSWORD_HASH,
      });
      const { product } = await createProductBundle(prisma);

      await prisma.review.create({
        data: {
          productId: product.id,
          userId: user.id,
          rating: 5,
          title: "Great product",
        },
      });

      await expect(
        prisma.review.create({
          data: {
            productId: product.id,
            userId: user.id,
            rating: 4,
            title: "Duplicate review",
          },
        }),
      ).rejects.toMatchObject({ code: "P2002" });
    } finally {
      await manager.stop();
    }
  });
});
