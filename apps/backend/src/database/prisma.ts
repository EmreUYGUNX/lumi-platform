import { PrismaClient } from "@prisma/client";

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

  client.$use(async (params, next) => {
    try {
      return await next(params);
    } catch (error) {
      logger.debug("Prisma middleware captured error", {
        model: params.model,
        action: params.action,
        error,
      });
      throw error;
    }
  });

  return client;
};

export const prisma = (() => {
  if (!prismaInstance) {
    prismaInstance = createPrismaClient();
  }

  return prismaInstance;
})();

export type PrismaTransaction = Parameters<PrismaClient["$transaction"]>[0];
