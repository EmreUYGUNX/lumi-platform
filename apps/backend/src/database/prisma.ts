import { Prisma, PrismaClient } from "@prisma/client";

import { getConfig } from "../config/index.js";
import { logger } from "../lib/logger.js";

let prismaInstance: PrismaClient | undefined;

const createPrismaClient = (): PrismaClient => {
  const config = getConfig();

  const client = new PrismaClient({
    datasources: {
      db: {
        url: config.database.url,
      },
    },
    log:
      config.app.environment === "development"
        ? ["query", "info", "warn", "error"]
        : ["warn", "error"],
  });

  return client.$extends(
    Prisma.defineExtension({
      name: "error-logging",
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            try {
              return await query(args);
            } catch (error) {
              logger.debug("Prisma middleware captured error", {
                model,
                action: operation,
                error,
              });
              throw error;
            }
          },
        },
      },
    }),
  ) as PrismaClient;
};

export const prisma = (() => {
  if (!prismaInstance) {
    prismaInstance = createPrismaClient();
  }

  return prismaInstance;
})();

export type PrismaTransaction = Parameters<PrismaClient["$transaction"]>[0];
