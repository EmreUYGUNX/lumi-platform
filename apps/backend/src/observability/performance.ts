import { monitorEventLoopDelay } from "node:perf_hooks";
import { clearInterval, setInterval } from "node:timers";

import { createGauge, createHistogram, isMetricsCollectionEnabled } from "./metrics.js";

type Monitor = ReturnType<typeof monitorEventLoopDelay>;

const eventLoopHistogram = createHistogram({
  name: "event_loop_delay_seconds",
  help: "Event loop delay measured via monitorEventLoopDelay in seconds.",
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2],
});

const memoryGauge = createGauge({
  name: "process_memory_usage_bytes",
  help: "Current Node.js process memory usage partitioned by segment.",
  labelNames: ["segment"],
});

let monitor: Monitor | undefined;
let samplingInterval: NodeJS.Timeout | undefined;

const recordMemoryUsage = () => {
  if (!isMetricsCollectionEnabled()) {
    return;
  }

  const usage = process.memoryUsage();

  (Object.keys(usage) as (keyof NodeJS.MemoryUsage)[]).forEach((segment) => {
    // eslint-disable-next-line security/detect-object-injection
    const value = usage[segment];
    // eslint-disable-next-line security/detect-object-injection
    memoryGauge.set({ segment }, value);
  });
};

const collectEventLoopMetrics = () => {
  if (!monitor || !isMetricsCollectionEnabled()) {
    return;
  }

  const meanInSeconds = monitor.mean / 1_000_000_000;
  eventLoopHistogram.observe(meanInSeconds);
  monitor.reset();
};

const SAMPLE_INTERVAL_MS = 10_000;

export const startPerformanceMonitoring = (): void => {
  if (monitor || samplingInterval) {
    return;
  }

  monitor = monitorEventLoopDelay({ resolution: 10 });
  monitor.enable();

  samplingInterval = setInterval(() => {
    collectEventLoopMetrics();
    recordMemoryUsage();
  }, SAMPLE_INTERVAL_MS);

  samplingInterval.unref?.();
};

export const stopPerformanceMonitoring = (): void => {
  monitor?.disable();
  monitor = undefined;

  if (samplingInterval) {
    clearInterval(samplingInterval);
    samplingInterval = undefined;
  }
};

export interface PerformanceSnapshot {
  eventLoop?: {
    meanMs: number;
    maxMs: number;
    minMs: number;
    stdDevMs: number;
  };
  memory: NodeJS.MemoryUsage;
  timestamp: string;
}

const toMilliseconds = (value: number) => value / 1_000_000;

export const getPerformanceSnapshot = (): PerformanceSnapshot => ({
  eventLoop: monitor
    ? {
        meanMs: toMilliseconds(monitor.mean),
        maxMs: toMilliseconds(monitor.max),
        minMs: toMilliseconds(monitor.min),
        stdDevMs: toMilliseconds(monitor.stddev),
      }
    : undefined,
  memory: process.memoryUsage(),
  timestamp: new Date().toISOString(),
});
