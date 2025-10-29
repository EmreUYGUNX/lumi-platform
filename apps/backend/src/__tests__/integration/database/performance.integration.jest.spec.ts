import { performance } from "node:perf_hooks";

import { beforeAll, describe, expect, it } from "@jest/globals";
import type { Prisma, PrismaClient } from "@prisma/client";

import { ProductRepository } from "@/modules/product/product.repository.js";

import { createProductBundle } from "../../fixtures/index.js";
import { getTestDatabaseManager } from "../../helpers/db.js";

describe("Database performance characteristics", () => {
  const testDatabase = getTestDatabaseManager();
  let prisma: PrismaClient;
  let productRepository: ProductRepository;
  const queryLog: Prisma.QueryEvent[] = [];

  beforeAll(async () => {
    prisma = await testDatabase.getPrismaClient();
    productRepository = new ProductRepository(prisma);

    (
      prisma as unknown as {
        $on: (event: "query", cb: (queryEvent: Prisma.QueryEvent) => void) => void;
      }
    ).$on("query", (queryEvent: Prisma.QueryEvent) => {
      queryLog.push(queryEvent);
    });
  });

  const seedProducts = async (count: number) => {
    await Promise.all(Array.from({ length: count }).map(() => createProductBundle(prisma)));
  };

  it("executes catalogue search queries under 200ms", async () => {
    await seedProducts(25);

    const start = performance.now();
    await productRepository.search(
      {
        statuses: ["ACTIVE"],
      },
      { page: 1, pageSize: 20 },
    );
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(200);
  });

  it("prevents N+1 queries when loading product listings", async () => {
    await seedProducts(12);

    const baseline = queryLog.length;
    await productRepository.search({ statuses: ["ACTIVE"] }, { page: 1, pageSize: 6 });

    const productQueries = queryLog
      .slice(baseline)
      .filter((queryEvent) => /"Product"/.test(queryEvent.query));
    expect(productQueries.length).toBeLessThanOrEqual(2);
  });

  it("maintains connection pool stability under parallel load", async () => {
    await seedProducts(10);

    const parallelQueries = Array.from({ length: 10 }).map(() =>
      prisma.product.findMany({ take: 5 }),
    );

    const results = await Promise.all(parallelQueries);
    expect(results).toHaveLength(10);
  });

  it("handles concurrent inventory transactions safely", async () => {
    const { primaryVariant } = await createProductBundle(prisma, {
      primaryVariantStock: 50,
    });

    await prisma.inventory.update({
      where: { productVariantId: primaryVariant.id },
      data: {
        quantityAvailable: 50,
        quantityOnHand: 50,
      },
    });

    const operations = Array.from({ length: 5 }).map(() =>
      prisma.$transaction(async (tx) => {
        await tx.inventory.update({
          where: { productVariantId: primaryVariant.id },
          data: {
            quantityAvailable: { decrement: 1 },
          },
        });
      }),
    );

    await Promise.all(operations);

    const inventory = await prisma.inventory.findUniqueOrThrow({
      where: { productVariantId: primaryVariant.id },
    });
    expect(inventory.quantityAvailable).toBe(45);
  });

  it("keeps average catalogue query times within SLA", async () => {
    await seedProducts(30);

    const iterations = 5;
    const durations = await Promise.all(
      Array.from({ length: iterations }, async () => {
        const start = performance.now();
        await productRepository.search({ statuses: ["ACTIVE"] }, { page: 1, pageSize: 12 });
        return performance.now() - start;
      }),
    );

    let totalDuration = 0;
    durations.forEach((duration) => {
      totalDuration += duration;
    });
    const average = totalDuration / iterations;
    expect(average).toBeLessThan(120);
  });
});
