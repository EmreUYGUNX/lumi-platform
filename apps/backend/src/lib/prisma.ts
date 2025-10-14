/* istanbul ignore file */
import { performance } from "node:perf_hooks";
import { setTimeout as delay } from "node:timers/promises";

import PrismaClientConstructor from "@prisma/client";

import { getConfig } from "../config/index.js";
import {
  recordDatabaseQueryMetrics,
  registerHealthCheck,
  sendAlert,
  unregisterHealthCheck,
} from "../observability/index.js";
import { logger } from "./logger.js";

interface PrismaClientBase {
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
  $on(event: string, handler: (payload: unknown) => void): void;
  $use(middleware: (...args: unknown[]) => void): void;
  $transaction<T>(fn: (client: PrismaClientBase, ...args: unknown[]) => Promise<T> | T): Promise<T>;
  $queryRaw<T = unknown>(query: TemplateStringsArray | unknown, ...params: unknown[]): Promise<T>;
  $queryRawUnsafe<T = unknown>(query: string, ...params: unknown[]): Promise<T>;
}

type PrismaClientClass = new (...args: unknown[]) => PrismaClientBase & {
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
};

const PrismaClient = PrismaClientConstructor as unknown as PrismaClientClass;

type PrismaClientInstance = PrismaClientBase;

const MAX_CONNECT_ATTEMPTS = 5;
const BASE_RETRY_DELAY_MS = 1000;
const DEFAULT_PRISMA_TARGET = "unknown";
const DEFAULT_PRISMA_MESSAGE = "No message provided";
const DATABASE_HEALTH_CHECK_ID = "database:prisma";
const SLOW_QUERY_ALERT_COOLDOWN_MS = 60 * 1e3;
const SLOW_QUERY_ALERT_SOURCE = "database.prisma";
const UNKNOWN_QUERY_MODEL = "unknown";
const UNKNOWN_QUERY_OPERATION = "unknown";

type PrismaExtensionFactory = (client: PrismaClientInstance) => PrismaClientInstance;

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

let prismaInstance: PrismaClientInstance | undefined;
let connectPromise: Promise<void> | undefined;
const extensionFactories: PrismaExtensionFactory[] = [];
const slowQueryAlertTimestamps = new Map<string, number>();
const queryPlanAnalysisTimestamps = new Map<string, number>();
let databaseHealthCheckRegistered = false;

const truncate = (value: string, maxLength: number) => {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}…`;
};

const normaliseIdentifier = (value: string | undefined, fallback: string): string => {
  if (!value) {
    return fallback;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  return trimmed;
};

const extractQueryMetadata = (query: string | undefined): { model: string; operation: string } => {
  if (!query) {
    return {
      model: UNKNOWN_QUERY_MODEL,
      operation: UNKNOWN_QUERY_OPERATION,
    };
  }

  const operationMatch = query.match(/^\s*(\w+)/i);
  const operation =
    operationMatch && operationMatch[1]
      ? normaliseIdentifier(operationMatch[1], UNKNOWN_QUERY_OPERATION)
      : UNKNOWN_QUERY_OPERATION;

  const relationMatch = query.match(/"[^"]*"\."([^"]+)"/);
  const model =
    relationMatch && relationMatch[1]
      ? normaliseIdentifier(relationMatch[1], UNKNOWN_QUERY_MODEL)
      : UNKNOWN_QUERY_MODEL;

  return {
    model,
    operation,
  };
};

const shouldThrottleAlert = (key: string): boolean => {
  const now = Date.now();
  const lastTriggered = slowQueryAlertTimestamps.get(key) ?? 0;

  if (now - lastTriggered < SLOW_QUERY_ALERT_COOLDOWN_MS) {
    return true;
  }

  slowQueryAlertTimestamps.set(key, now);
  return false;
};

const QUERY_PLAN_COOLDOWN_MS = 5 * 60 * 1e3;

const shouldAnalyseQueryPlan = (query: string): boolean => {
  const key = truncate(query, 256);
  const now = Date.now();
  const lastAnalysed = queryPlanAnalysisTimestamps.get(key) ?? 0;

  if (now - lastAnalysed < QUERY_PLAN_COOLDOWN_MS) {
    return false;
  }

  queryPlanAnalysisTimestamps.set(key, now);
  return true;
};

const parseQueryParameters = (params: string | undefined): unknown[] => {
  if (!params) {
    return [];
  }

  try {
    const parsed = JSON.parse(params);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    logger.debug("Failed to parse Prisma query parameters for plan analysis", { error, params });
    return [];
  }
};

const scheduleQueryPlanAnalysis = (
  client: PrismaClientInstance,
  query: string,
  params: string | undefined,
  metadata: { model: string; operation: string },
) => {
  const {
    app: { environment },
  } = getConfig();

  if (environment === "production" || !query.trim() || !shouldAnalyseQueryPlan(query)) {
    return;
  }

  const planQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`;
  const queryParams = parseQueryParameters(params);

  const runPlanAnalysis = async () => {
    try {
      const plan = await client.$queryRawUnsafe(planQuery, ...queryParams);
      logger.debug("Database query plan captured", {
        model: metadata.model,
        operation: metadata.operation,
        plan,
      });
    } catch (error) {
      logger.debug("Failed to capture database query plan", {
        error,
        model: metadata.model,
        operation: metadata.operation,
      });
    }
  };

  runPlanAnalysis().catch((error) => {
    logger.debug("Unhandled query plan analysis error", {
      error,
      model: metadata.model,
      operation: metadata.operation,
    });
  });
};

/* istanbul ignore next -- Prisma instrumentation exercised in integration environments */
/* istanbul ignore next -- Prisma instrumentation exercised in integration environments */
const registerEventLogging = (client: PrismaClientInstance) => {
  client.$on("query", (payload: unknown) => {
    const rawEvent = payload as PrismaClientQueryEvent | undefined;
    /* istanbul ignore if -- Prisma callback payload omitted in test environment */
    if (!rawEvent) {
      return;
    }

    const { duration = 0, target = DEFAULT_PRISMA_TARGET, query = "", params = "" } = rawEvent;
    const {
      database: { slowQueryThresholdMs, queryTimeoutMs },
      app: { environment },
    } = getConfig();
    const metadata = extractQueryMetadata(query);

    const operationLabel = metadata.operation.toLowerCase();
    const modelLabel = metadata.model.toLowerCase();

    const logPayload = {
      durationMs: duration,
      target,
      query: truncate(query, 512),
      params: truncate(params, 512),
      model: metadata.model,
      operation: metadata.operation.toUpperCase(),
    };

    const slow = duration >= slowQueryThresholdMs;
    const exceededTimeout = duration >= queryTimeoutMs;

    recordDatabaseQueryMetrics({
      model: modelLabel,
      operation: operationLabel,
      durationMs: duration,
      status: "ok",
      slow,
    });

    if (exceededTimeout) {
      const timeoutDetails = {
        ...logPayload,
        timeoutMs: queryTimeoutMs,
      };
      logger.error("Database query exceeded configured timeout", timeoutDetails);
      const alertKey = `${modelLabel}:${operationLabel}:timeout`;
      if (!shouldThrottleAlert(alertKey)) {
        sendAlert({
          severity: "error",
          message: "Database query exceeded configured timeout.",
          source: SLOW_QUERY_ALERT_SOURCE,
          details: timeoutDetails,
        }).catch((alertError) => {
          logger.warn("Failed to dispatch timeout alert", { alertError });
        });
      }
      return;
    }

    if (slow) {
      const slowDetails = {
        ...logPayload,
        thresholdMs: slowQueryThresholdMs,
      };
      logger.warn("Slow database query detected", slowDetails);
      scheduleQueryPlanAnalysis(client, query, params, {
        model: metadata.model,
        operation: operationLabel,
      });
      const alertKey = `${modelLabel}:${operationLabel}:slow`;
      if (!shouldThrottleAlert(alertKey)) {
        sendAlert({
          severity: "warn",
          message: "Slow database query detected.",
          source: SLOW_QUERY_ALERT_SOURCE,
          details: slowDetails,
        }).catch((alertError) => {
          logger.warn("Failed to dispatch slow query alert", { alertError });
        });
      }
      return;
    }

    if (environment !== "production") {
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
    const rawEvent = payload as PrismaClientLogEvent | undefined;
    const {
      app: { environment },
    } = getConfig();

    if (environment !== "production") {
      logger.info("Prisma client info", {
        target: rawEvent?.target ?? DEFAULT_PRISMA_TARGET,
        message: rawEvent?.message ?? DEFAULT_PRISMA_MESSAGE,
      });
    }
  });

  client.$on("error", (payload: unknown) => {
    const rawEvent = payload as PrismaClientLogEvent | undefined;
    const target = rawEvent?.target ?? DEFAULT_PRISMA_TARGET;
    const message = rawEvent?.message ?? DEFAULT_PRISMA_MESSAGE;

    logger.error("Prisma client error", {
      target,
      message,
    });

    const targetLabel = typeof target === "string" ? target.toLowerCase() : UNKNOWN_QUERY_MODEL;

    recordDatabaseQueryMetrics({
      model: targetLabel,
      operation: "internal",
      durationMs: 0,
      status: "error",
      slow: false,
    });

    if (message.toLowerCase().includes("timed out fetching a new connection")) {
      const alertKey = `${target}:connection-timeout`;
      if (!shouldThrottleAlert(alertKey)) {
        sendAlert({
          severity: "error",
          message: "Database connection timeout detected.",
          source: SLOW_QUERY_ALERT_SOURCE,
          details: {
            target,
            message,
          },
        }).catch((alertError) => {
          logger.warn("Failed to dispatch connection timeout alert", { alertError });
        });
      }
    }
  });
};

const applyExtensions = (client: PrismaClientInstance) => {
  let current = client;

  extensionFactories.forEach((factory) => {
    current = factory(current);
  });

  return current;
};

const registerDatabaseHealthCheck = (client: PrismaClientInstance) => {
  unregisterHealthCheck(DATABASE_HEALTH_CHECK_ID);

  registerHealthCheck(DATABASE_HEALTH_CHECK_ID, async () => {
    const startedAt = performance.now();

    try {
      await client.$queryRaw`SELECT 1`;
      const latencyMs = Number((performance.now() - startedAt).toFixed(2));

      return {
        status: "healthy" as const,
        summary: "Prisma client connectivity healthy.",
        details: { latencyMs },
      };
    } catch (error) {
      logger.error("Database health probe failed", { error });

      return {
        status: "unhealthy" as const,
        summary: "Failed to execute database health probe query.",
        severity: "error" as const,
        details: {
          error:
            error instanceof Error
              ? { name: error.name, message: error.message }
              : { message: String(error) },
        },
      };
    }
  });

  databaseHealthCheckRegistered = true;
};

const createPrismaClient = (): PrismaClientInstance => {
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

  registerEventLogging(client);
  registerDatabaseHealthCheck(client);

  return applyExtensions(client);
};

const connectWithRetry = async (client: PrismaClientInstance): Promise<void> => {
  let attempt = 0;

  const attemptConnection = async (): Promise<void> => {
    attempt += 1;

    try {
      await client.$connect();
      logger.info("Database connection established", { attempt });
    } catch (error) {
      logger.error("Database connection attempt failed", { attempt, error });
      const alertKey = `connection-attempt:${attempt}`;
      if (!shouldThrottleAlert(alertKey)) {
        sendAlert({
          severity: "error",
          message: "Database connection attempt failed.",
          source: SLOW_QUERY_ALERT_SOURCE,
          details: {
            attempt,
            error:
              error instanceof Error
                ? { name: error.name, message: error.message }
                : { message: String(error) },
          },
        }).catch((alertError) => {
          logger.warn("Failed to dispatch connection failure alert", { alertError });
        });
      }
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

export const getPrismaClient = (): PrismaClientInstance => {
  if (!prismaInstance) {
    prismaInstance = createPrismaClient();
    connectPromise = undefined;
  }

  // Trigger connection in background; callers can await waitForPrismaClient when needed.
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  ensureConnection();

  return prismaInstance;
};

export const waitForPrismaClient = async (): Promise<PrismaClientInstance> => {
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
    slowQueryAlertTimestamps.clear();
    queryPlanAnalysisTimestamps.clear();
    if (databaseHealthCheckRegistered) {
      unregisterHealthCheck(DATABASE_HEALTH_CHECK_ID);
      databaseHealthCheckRegistered = false;
    }
  }
};
