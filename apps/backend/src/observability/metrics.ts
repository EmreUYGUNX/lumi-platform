import { clearInterval, setInterval } from "node:timers";

import type {
  CounterConfiguration,
  GaugeConfiguration,
  HistogramConfiguration,
  LabelValues,
  Counter as PromCounter,
  Gauge as PromGauge,
  Histogram as PromHistogram,
} from "prom-client";
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from "prom-client";

import type { ApplicationConfig } from "@lumi/types";

import { getConfig, onConfigChange } from "../config/index.js";
import { logger } from "../lib/logger.js";

type HistogramLabels<T extends string> = LabelValues<T>;

const DEFAULT_UPTIME_COLLECTION_INTERVAL_MS = 10_000;
const HTTP_METRIC_LABELS = ["method", "route", "status"] as const;

export interface HttpMetricLabels {
  method: string;
  route: string;
  status: string;
}

type HttpMetricTimer = (status: string) => void;

const registry = new Registry();

let metricsEnabled = false;
let metricsPrefix = "";
let defaultMetricsRegistered = false;
let uptimeInterval: NodeJS.Timeout | undefined;
let uptimeCollectionIntervalMs = DEFAULT_UPTIME_COLLECTION_INTERVAL_MS;

const METRIC_REGISTRY = new Map<string, PromCounter | PromGauge | PromHistogram>();

const UNKNOWN_LABEL = "unknown";

const normaliseLabel = (value: unknown): string => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : UNKNOWN_LABEL;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return UNKNOWN_LABEL;
};

const normaliseMethod = (value: string): string => normaliseLabel(value).toUpperCase();

const normaliseRoute = (value: string): string => {
  const label = normaliseLabel(value);
  if (label === UNKNOWN_LABEL) {
    return label;
  }

  return label.startsWith("/") ? label : `/${label}`;
};

const normaliseStatus = (value: string | number): string => normaliseLabel(value);

const normaliseDuration = (value: number): number => {
  if (Number.isFinite(value) && value >= 0) {
    return value;
  }

  return 0;
};

const initialConfig = getConfig();
metricsEnabled = initialConfig.observability.metrics.enabled;
metricsPrefix = initialConfig.observability.metrics.prefix ?? "";

const stopUptimeInterval = () => {
  if (uptimeInterval) {
    clearInterval(uptimeInterval);
    uptimeInterval = undefined;
  }
};

const applyPrefix = (name: string): string => {
  if (!metricsPrefix) {
    return name;
  }

  return name.startsWith(metricsPrefix) ? name : `${metricsPrefix}${name}`;
};

const registerMetric = <TMetric extends PromCounter | PromGauge | PromHistogram>(
  name: string,
  metric: TMetric,
): TMetric => {
  METRIC_REGISTRY.set(name, metric);
  return metric;
};

const ensureMetric = (name: string) => registry.getSingleMetric(applyPrefix(name));

export const createCounter = <TLabels extends string = string>(
  configuration: CounterConfiguration<TLabels>,
): PromCounter<TLabels> => {
  const name = applyPrefix(configuration.name);
  const existing = ensureMetric(configuration.name);
  if (existing) {
    return existing as PromCounter<TLabels>;
  }

  const counter = new Counter<TLabels>({
    ...configuration,
    name,
    registers: [registry],
  });

  return registerMetric(name, counter) as PromCounter<TLabels>;
};

export const createGauge = <TLabels extends string = string>(
  configuration: GaugeConfiguration<TLabels>,
): PromGauge<TLabels> => {
  const name = applyPrefix(configuration.name);
  const existing = ensureMetric(configuration.name);
  if (existing) {
    return existing as PromGauge<TLabels>;
  }

  const gauge = new Gauge<TLabels>({
    ...configuration,
    name,
    registers: [registry],
  });

  return registerMetric(name, gauge) as PromGauge<TLabels>;
};

export const createHistogram = <TLabels extends string = string>(
  configuration: HistogramConfiguration<TLabels>,
): PromHistogram<TLabels> => {
  const name = applyPrefix(configuration.name);
  const existing = ensureMetric(configuration.name);
  if (existing) {
    return existing as PromHistogram<TLabels>;
  }

  const histogram = new Histogram<TLabels>({
    ...configuration,
    name,
    registers: [registry],
  });

  return registerMetric(name, histogram) as PromHistogram<TLabels>;
};

export const trackDuration = <TLabels extends string = string>(
  histogram: PromHistogram<TLabels>,
  labels: HistogramLabels<TLabels> | undefined,
  execute: () => void,
) => {
  if (!metricsEnabled) {
    execute();
    return;
  }

  const end = histogram.startTimer(labels);
  try {
    execute();
  } finally {
    end();
  }
};

export const trackDurationAsync = async <TLabels extends string = string, TResult = unknown>(
  histogram: PromHistogram<TLabels>,
  labels: HistogramLabels<TLabels> | undefined,
  execute: () => Promise<TResult>,
): Promise<TResult> => {
  if (!metricsEnabled) {
    return execute();
  }

  const end = histogram.startTimer(labels);
  try {
    const result = await execute();
    end();
    return result;
  } catch (error) {
    end();
    throw error;
  }
};

const uptimeGauge = createGauge({
  name: "uptime_seconds",
  help: "Tracks the service uptime in seconds.",
});

const updateUptimeMetric = () => {
  if (!metricsEnabled) {
    return;
  }

  uptimeGauge.set(process.uptime());
};

const scheduleUptimeInterval = (intervalMs: number) => {
  const effectiveInterval =
    intervalMs && Number.isFinite(intervalMs) && intervalMs > 0
      ? Math.floor(intervalMs)
      : DEFAULT_UPTIME_COLLECTION_INTERVAL_MS;

  if (uptimeInterval && effectiveInterval === uptimeCollectionIntervalMs) {
    return;
  }

  stopUptimeInterval();
  uptimeCollectionIntervalMs = effectiveInterval;
  uptimeInterval = setInterval(updateUptimeMetric, effectiveInterval);
  uptimeInterval.unref?.();
};

export const recordUptimeNow = () => {
  updateUptimeMetric();
};

const startDefaultMetrics = (config: ApplicationConfig) => {
  if (!metricsEnabled || !config.observability.metrics.collectDefaultMetrics) {
    defaultMetricsRegistered = false;
    return;
  }

  if (defaultMetricsRegistered) {
    return;
  }

  collectDefaultMetrics({
    register: registry,
    prefix: metricsPrefix,
  });

  defaultMetricsRegistered = true;
};

const configureMetrics = (config: ApplicationConfig) => {
  metricsEnabled = config.observability.metrics.enabled;
  metricsPrefix = config.observability.metrics.prefix ?? "";

  registry.setDefaultLabels({
    service: config.app.name,
    environment: config.app.environment,
  });

  if (!metricsEnabled) {
    logger.debug("Metrics collection disabled by configuration");
    defaultMetricsRegistered = false;
    stopUptimeInterval();
    return;
  }

  scheduleUptimeInterval(config.observability.metrics.defaultMetricsInterval);
  updateUptimeMetric();
  startDefaultMetrics(config);
};

configureMetrics(initialConfig);

const httpRequestDurationHistogram = createHistogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds.",
  labelNames: HTTP_METRIC_LABELS,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
});

const httpRequestsTotal = createCounter({
  name: "http_requests_total",
  help: "Total number of HTTP requests processed.",
  labelNames: HTTP_METRIC_LABELS,
});

onConfigChange((change) => {
  configureMetrics(change.snapshot);
});

export const metricsRegistry = registry;

export const isMetricsCollectionEnabled = (): boolean => metricsEnabled;

export const getMetricsSnapshot = async (): Promise<string> => {
  if (!metricsEnabled) {
    return "";
  }

  return registry.metrics();
};

export const listRegisteredMetrics = (): string[] => [...METRIC_REGISTRY.keys()];

const noopHttpMetricTimer: HttpMetricTimer = () => {};

const logHttpMetricFailure = (
  phase: "counter" | "histogram",
  labels: HttpMetricLabels,
  error: unknown,
) => {
  logger.debug(`Failed to record HTTP ${phase} metric`, {
    error,
    labels,
  });
};

export const beginHttpRequestObservation = (method: string, route: string): HttpMetricTimer => {
  if (!metricsEnabled) {
    return noopHttpMetricTimer;
  }

  const normalisedMethod = normaliseMethod(method);
  const normalisedRoute = normaliseRoute(route);
  const endTimer = httpRequestDurationHistogram.startTimer({
    method: normalisedMethod,
    route: normalisedRoute,
  });

  return (status: string) => {
    const normalisedStatus = normaliseStatus(status);
    const labels: HttpMetricLabels = {
      method: normalisedMethod,
      route: normalisedRoute,
      status: normalisedStatus,
    };

    try {
      endTimer({ status: normalisedStatus });
    } catch (error) {
      logHttpMetricFailure("histogram", labels, error);
    }

    try {
      httpRequestsTotal.labels(normalisedMethod, normalisedRoute, normalisedStatus).inc();
    } catch (error) {
      logHttpMetricFailure("counter", labels, error);
    }
  };
};

export const observeHttpRequest = (labels: HttpMetricLabels, durationSeconds: number): void => {
  if (!metricsEnabled) {
    return;
  }

  const normalisedLabels: HttpMetricLabels = {
    method: normaliseMethod(labels.method),
    route: normaliseRoute(labels.route),
    status: normaliseStatus(labels.status),
  };

  const duration = normaliseDuration(durationSeconds);

  try {
    httpRequestsTotal
      .labels(normalisedLabels.method, normalisedLabels.route, normalisedLabels.status)
      .inc();
  } catch (error) {
    logHttpMetricFailure("counter", normalisedLabels, error);
  }

  try {
    httpRequestDurationHistogram
      .labels(normalisedLabels.method, normalisedLabels.route, normalisedLabels.status)
      .observe(duration);
  } catch (error) {
    logHttpMetricFailure("histogram", normalisedLabels, { error, duration });
  }
};

export const metricsInternals = {
  resetForTest: () => {
    defaultMetricsRegistered = false;
    metricsEnabled = false;
    metricsPrefix = "";
    METRIC_REGISTRY.clear();
    registry.clear();
    stopUptimeInterval();
    uptimeCollectionIntervalMs = DEFAULT_UPTIME_COLLECTION_INTERVAL_MS;
    registry.registerMetric(httpRequestDurationHistogram);
    registry.registerMetric(httpRequestsTotal);
    registry.registerMetric(uptimeGauge);
    const histogramName = (httpRequestDurationHistogram as unknown as { name: string }).name;
    const counterName = (httpRequestsTotal as unknown as { name: string }).name;
    const uptimeName = (uptimeGauge as unknown as { name: string }).name;
    METRIC_REGISTRY.set(histogramName, httpRequestDurationHistogram);
    METRIC_REGISTRY.set(counterName, httpRequestsTotal);
    METRIC_REGISTRY.set(uptimeName, uptimeGauge);
  },
  isDefaultCollectorActive: () => defaultMetricsRegistered,
  getUptimeIntervalMs: () => uptimeCollectionIntervalMs,
};
