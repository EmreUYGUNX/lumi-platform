import { setInterval } from "node:timers";

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

const registry = new Registry();

let metricsEnabled = false;
let metricsPrefix = "";
let defaultMetricsRegistered = false;

const METRIC_REGISTRY = new Map<string, PromCounter | PromGauge | PromHistogram>();

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
    return;
  }

  startDefaultMetrics(config);
};

configureMetrics(getConfig());

onConfigChange((change) => {
  configureMetrics(change.snapshot);
});

export const metricsRegistry = registry;

export const isMetricsCollectionEnabled = (): boolean => metricsEnabled;

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

export const getMetricsSnapshot = async (): Promise<string> => {
  if (!metricsEnabled) {
    return "";
  }

  return registry.metrics();
};

export const listRegisteredMetrics = (): string[] => [...METRIC_REGISTRY.keys()];

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

const uptimeInterval = setInterval(updateUptimeMetric, 10_000);
uptimeInterval.unref?.();

export const recordUptimeNow = () => {
  updateUptimeMetric();
};
