import { logger } from "../lib/logger.js";
import {
  createCounter,
  createHistogram,
  isMetricsCollectionEnabled,
  listRegisteredMetrics,
  trackDurationAsync,
} from "./metrics.js";

const DATABASE_QUERY_LABELS = ["model", "operation", "status"] as const;
const DATABASE_SLOW_QUERY_LABELS = ["model", "operation"] as const;

const queryDurationHistogram = createHistogram({
  name: "db_query_duration_seconds",
  help: "Duration of database queries measured in seconds.",
  labelNames: DATABASE_QUERY_LABELS,
  buckets: [0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
});

const queryCounter = createCounter({
  name: "db_queries_total",
  help: "Total number of database queries executed partitioned by model, operation and status.",
  labelNames: DATABASE_QUERY_LABELS,
});

const slowQueryCounter = createCounter({
  name: "db_slow_queries_total",
  help: "Number of database queries exceeding the configured slow query threshold.",
  labelNames: DATABASE_SLOW_QUERY_LABELS,
});

const normaliseLabel = (value: string | undefined): string => {
  if (!value) {
    return "unknown";
  }

  const trimmed = value.trim().toLowerCase();
  if (trimmed.length === 0) {
    return "unknown";
  }

  return trimmed;
};

const toSeconds = (durationMs: number): number => {
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return 0;
  }

  return durationMs / 1000;
};

export interface DatabaseQueryObservation {
  model?: string;
  operation?: string;
  durationMs: number;
  status: "ok" | "error";
  slow: boolean;
}

const recordHistogram = (
  model: string,
  operation: string,
  status: string,
  durationSeconds: number,
) => {
  try {
    queryDurationHistogram.labels(model, operation, status).observe(durationSeconds);
  } catch (error) {
    logger.debug("Failed to record database query duration metric", {
      model,
      operation,
      status,
      durationSeconds,
      error,
    });
  }
};

const incrementQueryCounter = (model: string, operation: string, status: string) => {
  try {
    queryCounter.labels(model, operation, status).inc();
  } catch (error) {
    logger.debug("Failed to increment database query counter", { model, operation, status, error });
  }
};

const incrementSlowQueryCounter = (model: string, operation: string) => {
  try {
    slowQueryCounter.labels(model, operation).inc();
  } catch (error) {
    logger.debug("Failed to increment slow query counter", { model, operation, error });
  }
};

export const recordDatabaseQueryMetrics = (observation: DatabaseQueryObservation): void => {
  if (!isMetricsCollectionEnabled()) {
    return;
  }

  const modelLabel = normaliseLabel(observation.model);
  const operationLabel = normaliseLabel(observation.operation);
  const statusLabel = observation.status;

  incrementQueryCounter(modelLabel, operationLabel, statusLabel);
  recordHistogram(modelLabel, operationLabel, statusLabel, toSeconds(observation.durationMs));

  if (observation.slow) {
    incrementSlowQueryCounter(modelLabel, operationLabel);
  }
};

export const measureDatabaseOperation = async <TResult>(
  labels: Pick<DatabaseQueryObservation, "model" | "operation">,
  execute: () => Promise<TResult>,
): Promise<TResult> => {
  if (!isMetricsCollectionEnabled()) {
    return execute();
  }

  const modelLabel = normaliseLabel(labels.model);
  const operationLabel = normaliseLabel(labels.operation);

  return trackDurationAsync(
    queryDurationHistogram,
    {
      model: modelLabel,
      operation: operationLabel,
      status: "ok",
    },
    execute,
  );
};

export const databaseMetricsInternals = {
  getRegisteredMetricNames: () => listRegisteredMetrics(),
};
