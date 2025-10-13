import { setTimeout as delay } from "node:timers/promises";

import { PrismaClient } from "@prisma/client";

import { getConfig } from "../config/index.js";
import { logger } from "./logger.js";

const MAX_CONNECT_ATTEMPTS = 5;
const BASE_RETRY_DELAY_MS = 1000;
const DEFAULT_PRISMA_TARGET = "unknown";
const DEFAULT_PRISMA_MESSAGE = "No message provided";

type PrismaExtensionFactory = (client: PrismaClient) => PrismaClient;

interface PrismaClientLogEvent {
  timestamp?: Date;
  target?: string;
  message?: string;
}

interface PrismaClientQueryEvent extends PrismaClientLogEvent {
  query?: string;
  params?: string;
  duration?: number;
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

/* istanbul ignore next -- Prisma instrumentation exercised in integration environments */
const registerEventLogging = (client: PrismaClient, slowQueryThresholdMs: number) => {
  const {
    app: { environment },
  } = getConfig();
  const verboseQueryLogging = environment !== "production";

  client.$on("query", (payload: unknown) => {
    const rawEvent = payload as PrismaClientQueryEvent | undefined;
    /* istanbul ignore if -- Prisma callback payload omitted in test environment */
    if (!rawEvent) {
      return;
    }

    const { duration = 0, target = DEFAULT_PRISMA_TARGET, query = "", params = "" } = rawEvent;
    const logPayload = {
      durationMs: duration,
      target,
      query: truncate(query, 512),
      params: truncate(params, 512),
    };

    if (duration >= slowQueryThresholdMs) {
      logger.warn("Slow database query detected", logPayload);
      return;
    }

    if (verboseQueryLogging) {
      logger.debug("Database query executed", logPayload);
    }
  });

  client.$on("warn", (payload: unknown) => {
    const rawEvent = payload as PrismaClientLogEvent | undefined;
    logger.warn("Prisma client warning", {
      target: rawEvent?.target ?? DEFAULT_PRISMA_TARGET,
      message: rawEvent?.message ?? DEFAULT_PRISMA_MESSAGE,
    });
  });

  client.$on("info", (payload: unknown) => {
    if (!verboseQueryLogging) {
      return;
    }

    const rawEvent = payload as PrismaClientLogEvent | undefined;
    logger.info("Prisma client info", {
      target: rawEvent?.target ?? DEFAULT_PRISMA_TARGET,
      message: rawEvent?.message ?? DEFAULT_PRISMA_MESSAGE,
    });
  });

  client.$on("error", (payload: unknown) => {
    const rawEvent = payload as PrismaClientLogEvent | undefined;
    logger.error("Prisma client error", {
      target: rawEvent?.target ?? DEFAULT_PRISMA_TARGET,
      message: rawEvent?.message ?? DEFAULT_PRISMA_MESSAGE,
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
