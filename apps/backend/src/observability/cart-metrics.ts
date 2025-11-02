import type { Counter as PromCounter } from "prom-client";

import { logger } from "../lib/logger.js";
import { createCounter, isMetricsCollectionEnabled } from "./metrics.js";

export type CartMetricOperation =
  | "add_item"
  | "update_item"
  | "remove_item"
  | "clear_cart"
  | "merge_cart"
  | "validate_cart";

const cartOperationCounter = createCounter({
  name: "cart_operations_total",
  help: "Counts cart operations grouped by operation type.",
  labelNames: ["operation"],
});

const safeIncrement = (
  counter: PromCounter<string>,
  operation: CartMetricOperation,
  value = 1,
): void => {
  if (!isMetricsCollectionEnabled()) {
    return;
  }

  try {
    counter.labels(operation).inc(value);
  } catch (error) {
    logger.debug("Failed to increment cart operation metric", {
      operation,
      value,
      error,
    });
  }
};

export const recordCartOperationMetric = (operation: CartMetricOperation, value = 1): void => {
  safeIncrement(cartOperationCounter, operation, value);
};

export const cartMetricsInternals = {
  get cartOperationCounter() {
    return cartOperationCounter;
  },
};
