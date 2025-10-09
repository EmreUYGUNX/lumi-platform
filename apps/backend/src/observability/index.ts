import { recordUptimeNow } from "./metrics.js";
import { startPerformanceMonitoring } from "./performance.js";

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
} from "./metrics.js";

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

export { getSentryInstance, isSentryEnabled } from "./sentry.js";

let bootstrapComplete = false;

export const initializeObservability = () => {
  if (bootstrapComplete) {
    return;
  }

  bootstrapComplete = true;
  startPerformanceMonitoring();
  recordUptimeNow();
};
