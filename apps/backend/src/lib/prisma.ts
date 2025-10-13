import { setTimeout as delay } from "node:timers/promises";

import { PrismaClient } from "@prisma/client";

import { getConfig } from "../config/index.js";
import { logger } from "./logger.js";

const MAX_CONNECT_ATTEMPTS = 5;
const BASE_RETRY_DELAY_MS = 1000;

type PrismaExtensionFactory = (client: PrismaClient) => PrismaClient;

interface PrismaClientLogEvent {
  timestamp: Date;
  target: string;
  message: string;
}

interface PrismaClientQueryEvent extends PrismaClientLogEvent {
  query: string;
  params: string;
  duration: number;
}

let prismaInstance: PrismaClient | undefined;
let connectPromise: Promise<void> | undefined;
const extensionFactories: PrismaExtensionFactory[] = [];

const truncate = (value: string, maxLength: number) => {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}…`;
};

const registerEventLogging = (client: PrismaClient, slowQueryThresholdMs: number) => {
  const {
    app: { environment },
  } = getConfig();
  const verboseQueryLogging = environment !== "production";

  client.$on("query", ({ duration, target, query, params }: PrismaClientQueryEvent) => {
    const payload = {
      durationMs: duration,
      target,
      query: truncate(query, 512),
      params: truncate(params, 512),
    };

    if (duration >= slowQueryThresholdMs) {
      logger.warn("Slow database query detected", payload);
      return;
    }

    if (verboseQueryLogging) {
      logger.debug("Database query executed", payload);
    }
  });

  client.$on("warn", ({ target, message }: PrismaClientLogEvent) => {
    logger.warn("Prisma client warning", {
      target,
      message,
    });
  });

  client.$on("info", ({ target, message }: PrismaClientLogEvent) => {
    if (verboseQueryLogging) {
      logger.info("Prisma client info", {
        target,
        message,
      });
    }
  });

  client.$on("error", ({ target, message }: PrismaClientLogEvent) => {
    logger.error("Prisma client error", {
      target,
      message,
    });
  });
};

const applyExtensions = (client: PrismaClient) => {
  let current = client;

  extensionFactories.forEach((factory) => {
    current = factory(current);
  });

  return current;
};

const createPrismaClient = (): PrismaClient => {
  const {
    database: {
      url,
      pool: { minConnections, maxConnections, idleTimeoutMs, connectionTimeoutMs, maxLifetimeMs },
      queryTimeoutMs,
    },
    app: { environment },
  } = getConfig();

  const client = new PrismaClient({
    datasources: {
      db: {
        url,
      },
    },
    pooling: {
      minConnections,
      maxConnections,
      idleTimeout: idleTimeoutMs,
      connectionTimeout: connectionTimeoutMs,
      maxLifetime: maxLifetimeMs,
    },
    errorFormat: environment === "production" ? "minimal" : "pretty",
    log: [
      { emit: "event", level: "warn" },
      { emit: "event", level: "error" },
      { emit: "event", level: "info" },
      { emit: "event", level: "query" },
    ],
    transactionOptions: {
      maxWait: queryTimeoutMs,
      timeout: queryTimeoutMs,
    },
  });

  registerEventLogging(client, queryTimeoutMs);

  return applyExtensions(client);
};

const connectWithRetry = async (client: PrismaClient): Promise<void> => {
  let attempt = 0;

  const attemptConnection = async (): Promise<void> => {
    attempt += 1;

    try {
      await client.$connect();
      logger.info("Database connection established", { attempt });
    } catch (error) {
      logger.error("Database connection attempt failed", { attempt, error });
      if (attempt >= MAX_CONNECT_ATTEMPTS) {
        throw error;
      }

      const backoff = BASE_RETRY_DELAY_MS * attempt;
      logger.warn("Retrying database connection with backoff", { attempt, backoff });
      await delay(backoff);
      await attemptConnection();
    }
  };

  await attemptConnection();
};

const ensureConnection = (): Promise<void> => {
  if (!prismaInstance) {
    prismaInstance = createPrismaClient();
  }

  if (!connectPromise) {
    connectPromise = connectWithRetry(prismaInstance).catch((error) => {
      connectPromise = undefined;
      throw error;
    });
  }

  return connectPromise;
};

export const getPrismaClient = (): PrismaClient => {
  if (!prismaInstance) {
    prismaInstance = createPrismaClient();
    connectPromise = undefined;
  }

  // Trigger connection in background; callers can await waitForPrismaClient when needed.
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  ensureConnection();

  return prismaInstance;
};

export const waitForPrismaClient = async (): Promise<PrismaClient> => {
  const client = getPrismaClient();
  await ensureConnection();
  return client;
};

export const registerPrismaExtension = (factory: PrismaExtensionFactory): (() => void) => {
  extensionFactories.push(factory);

  if (prismaInstance) {
    prismaInstance = factory(prismaInstance);
  }

  return () => {
    const index = extensionFactories.indexOf(factory);
    if (index >= 0) {
      extensionFactories.splice(index, 1);
    }
  };
};

export const disconnectPrismaClient = async () => {
  if (!prismaInstance) {
    return;
  }

  try {
    await prismaInstance.$disconnect();
    logger.info("Database connection closed");
  } catch (error) {
    logger.error("Failed to close Prisma client cleanly", { error });
  } finally {
    prismaInstance = undefined;
    connectPromise = undefined;
  }
};
