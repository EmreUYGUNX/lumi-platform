import { logError } from "../lib/logger.js";
import { recordUptimeNow } from "./metrics.js";
import { startPerformanceMonitoring } from "./performance.js";
import { initializeSentry } from "./sentry.js";

export {
  metricsRegistry,
  isMetricsCollectionEnabled,
  createCounter,
  createGauge,
  createHistogram,
  getMetricsSnapshot,
  listRegisteredMetrics,
  recordUptimeNow,
  trackDuration,
  trackDurationAsync,
  beginHttpRequestObservation,
  observeHttpRequest,
  type HttpMetricLabels,
} from "./metrics.js";

export {
  recordDatabaseQueryMetrics,
  measureDatabaseOperation,
  databaseMetricsInternals,
  type DatabaseQueryObservation,
} from "./database-metrics.js";

export {
  recordCartOperationMetric,
  cartMetricsInternals,
  type CartMetricOperation,
} from "./cart-metrics.js";

export {
  recordOrderCreatedMetric,
  recordOrderStatusTransitionMetric,
  recordOrderRefundMetric,
  orderMetricsInternals,
  type OrderRefundLabel,
  type OrderStatusTransitionLabel,
} from "./order-metrics.js";

export {
  evaluateHealth,
  registerHealthCheck,
  unregisterHealthCheck,
  listHealthChecks,
  type HealthStatus,
  type HealthCheckResult,
  type HealthSnapshot,
} from "./health.js";

export {
  startPerformanceMonitoring,
  stopPerformanceMonitoring,
  getPerformanceSnapshot,
  type PerformanceSnapshot,
} from "./performance.js";

export {
  sendAlert,
  registerAlertChannel,
  unregisterAlertChannel,
  listAlertChannels,
  type AlertPayload,
} from "./alerts.js";

export { getSentryInstance, isSentryEnabled, setSentryUser } from "./sentry.js";

let bootstrapComplete = false;

export const initializeObservability = () => {
  if (bootstrapComplete) {
    return;
  }

  bootstrapComplete = true;
  initializeSentry().catch((error: unknown) => {
    logError(error, "Failed to initialise Sentry telemetry during observability bootstrap");
  });
  startPerformanceMonitoring();
  recordUptimeNow();
};
