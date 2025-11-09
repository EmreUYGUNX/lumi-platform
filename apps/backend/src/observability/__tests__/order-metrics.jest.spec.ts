import { describe, expect, it, jest } from "@jest/globals";

import { logger } from "../../lib/logger.js";
import * as metricsModule from "../metrics.js";
import {
  orderMetricsInternals,
  recordOrderCreatedMetric,
  recordOrderRefundMetric,
  recordOrderStatusTransitionMetric,
} from "../order-metrics.js";

interface MockCounter {
  inc: jest.Mock;
  labels: jest.Mock;
  labelledInc: jest.Mock;
}

jest.mock("../metrics.js", () => {
  const mockCounter = (): MockCounter => {
    const labelledInc = jest.fn();
    return {
      inc: jest.fn(),
      labels: jest.fn(() => ({ inc: labelledInc })),
      labelledInc,
    };
  };

  const mockCounters: MockCounter[] = [];

  return {
    __esModule: true,
    createCounter: jest.fn(() => {
      const counter = mockCounter();
      mockCounters.push(counter);
      return counter;
    }),
    isMetricsCollectionEnabled: jest.fn(() => true),
    mockCounters,
  };
});

jest.mock("../../lib/logger.js", () => ({
  __esModule: true,
  logger: {
    debug: jest.fn(),
  },
}));

const metricsMock = jest.requireMock("../metrics.js") as typeof metricsModule & {
  mockCounters: MockCounter[];
};

const mockedMetrics = metricsModule as unknown as {
  isMetricsCollectionEnabled: jest.Mock;
};

const [createdCounter, statusCounter, refundCounter] = metricsMock.mockCounters;

if (!createdCounter || !statusCounter || !refundCounter) {
  throw new Error("Order metric counters failed to initialize in tests.");
}

describe("order metrics helpers", () => {
  it("increments counters without labels when metrics are enabled", () => {
    recordOrderCreatedMetric(3);

    expect(createdCounter.inc).toHaveBeenCalledWith(3);
    expect(orderMetricsInternals.orderCreatedCounter).toBe(createdCounter);
  });

  it("routes labeled metrics through the label helper", () => {
    recordOrderStatusTransitionMetric({ from: "pending", to: "paid" }, 2);

    expect(statusCounter.labels).toHaveBeenCalledWith({ from: "pending", to: "paid" });
    expect(statusCounter.labelledInc).toHaveBeenCalledWith(2);
  });

  it("skips recording when metrics are disabled", () => {
    mockedMetrics.isMetricsCollectionEnabled.mockReturnValueOnce(false);

    recordOrderRefundMetric({ type: "full" }, 5);

    expect(refundCounter.inc).not.toHaveBeenCalledWith(5);
  });

  it("logs debug output when counter operations throw", () => {
    const error = new Error("increment failed");
    createdCounter.inc.mockImplementationOnce(() => {
      throw error;
    });

    recordOrderCreatedMetric(1);

    expect(logger.debug).toHaveBeenCalledWith(
      "Failed to increment order metric",
      expect.objectContaining({ error }),
    );
  });
});
