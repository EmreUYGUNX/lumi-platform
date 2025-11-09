import type { Counter as PromCounter } from "prom-client";

import { logger } from "../lib/logger.js";
import { createCounter, isMetricsCollectionEnabled } from "./metrics.js";

export interface OrderStatusTransitionLabel {
  from: string;
  to: string;
}

export interface OrderRefundLabel {
  type: string;
}

const orderCreatedCounter = createCounter({
  name: "order_created_total",
  help: "Counts the number of orders created.",
});

const orderStatusCounter = createCounter({
  name: "order_status_transitions_total",
  help: "Counts status transitions for orders.",
  labelNames: ["from", "to"],
});

const orderRefundCounter = createCounter({
  name: "order_refunds_total",
  help: "Counts refunds that have been initiated for orders grouped by refund type.",
  labelNames: ["type"],
});

const safeIncrement = <TLabels extends string>(
  counter: PromCounter<TLabels>,
  labels?: Record<TLabels, string>,
  value = 1,
): void => {
  if (!isMetricsCollectionEnabled()) {
    return;
  }

  try {
    if (labels && Object.keys(labels).length > 0) {
      counter.labels(labels).inc(value);
    } else {
      counter.inc(value);
    }
  } catch (error) {
    logger.debug("Failed to increment order metric", {
      error,
      labels,
      value,
    });
  }
};

export const recordOrderCreatedMetric = (count = 1): void => {
  safeIncrement(orderCreatedCounter, undefined, count);
};

export const recordOrderStatusTransitionMetric = (
  labels: OrderStatusTransitionLabel,
  count = 1,
): void => {
  safeIncrement(orderStatusCounter, labels, count);
};

export const recordOrderRefundMetric = (labels: OrderRefundLabel, count = 1): void => {
  safeIncrement(orderRefundCounter, labels, count);
};

export const orderMetricsInternals = {
  get orderCreatedCounter() {
    return orderCreatedCounter;
  },
  get orderStatusCounter() {
    return orderStatusCounter;
  },
  get orderRefundCounter() {
    return orderRefundCounter;
  },
};
