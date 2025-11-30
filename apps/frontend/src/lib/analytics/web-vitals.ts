import type { NextWebVitalsMetric } from "next/app";

import { emitAnalyticsEvent } from "./events";
import { captureWebVital } from "./sentry";

const TRACKED_METRICS = new Set(["LCP", "FID", "CLS", "TTFB", "INP"]);

const normaliseValue = (metric: NextWebVitalsMetric): number =>
  metric.name === "CLS" ? metric.value * 1000 : metric.value;

type ExtendedWebVital = NextWebVitalsMetric & { rating?: string; delta?: number };

export const handleWebVitals = (metric: NextWebVitalsMetric): void => {
  if (!TRACKED_METRICS.has(metric.name)) {
    return;
  }

  const extended = metric as ExtendedWebVital;
  const value = normaliseValue(metric);
  const payload = {
    metric_id: metric.id,
    metric_name: metric.name,
    metric_rating: extended.rating,
    value,
    delta: extended.delta,
    label: metric.label,
  };

  emitAnalyticsEvent("web_vital", payload);

  if (typeof window !== "undefined") {
    const { gtag } = window as {
      gtag?: (command: string, eventName: string, params?: unknown) => void;
    };
    gtag?.("event", metric.name, {
      value,
      metric_id: metric.id,
      metric_delta: extended.delta,
      metric_rating: extended.rating,
      non_interaction: true,
    });
  }

  captureWebVital(metric);
};
