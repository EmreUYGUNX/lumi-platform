import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import { logger } from "../../lib/logger.js";
import { cartMetricsInternals, recordCartOperationMetric } from "../cart-metrics.js";

jest.mock("../metrics.js", () => {
  const state: {
    incrementMock: jest.Mock;
    labelsMock: jest.Mock;
    createCounterMock: jest.Mock;
    isMetricsEnabledMock: jest.Mock;
    counterInstance: { labels: (...args: unknown[]) => unknown };
  } = {
    incrementMock: jest.fn(),
    labelsMock: jest.fn(),
    createCounterMock: jest.fn(),
    isMetricsEnabledMock: jest.fn(),
    counterInstance: { labels: () => {} },
  };

  state.counterInstance.labels = (...args: unknown[]) => state.labelsMock(...args);

  const reset = () => {
    state.incrementMock.mockReset();
    state.labelsMock.mockReset();
    state.createCounterMock.mockReset();
    state.isMetricsEnabledMock.mockReset();

    state.labelsMock.mockImplementation(() => ({
      inc: state.incrementMock,
    }));

    state.counterInstance.labels = (...args: unknown[]) => state.labelsMock(...args);

    state.createCounterMock.mockImplementation(() => state.counterInstance);

    state.isMetricsEnabledMock.mockImplementation(() => true);
  };

  reset();

  return {
    createCounter: (...args: unknown[]) => state.createCounterMock(...args),
    isMetricsCollectionEnabled: (...args: unknown[]) => state.isMetricsEnabledMock(...args),
    mockState: state,
    resetMocks: reset,
  };
});

jest.mock("../../lib/logger.js", () => ({
  logger: {
    debug: jest.fn(),
  },
}));

const metricsModuleMock = jest.requireMock("../metrics.js") as {
  mockState: {
    incrementMock: jest.Mock;
    labelsMock: jest.Mock;
    createCounterMock: jest.Mock;
    isMetricsEnabledMock: jest.Mock;
  };
  resetMocks: () => void;
};

const metricsMockState = metricsModuleMock.mockState;
const resetMetricsMocks = metricsModuleMock.resetMocks;

describe("cart metrics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetMetricsMocks();
    (logger.debug as jest.Mock).mockReset();
    metricsMockState.isMetricsEnabledMock.mockReturnValue(true);
  });

  it("increments counters when metrics collection is enabled", () => {
    recordCartOperationMetric("add_item", 2);

    expect(metricsMockState.labelsMock).toHaveBeenCalledWith("add_item");
    expect(metricsMockState.incrementMock).toHaveBeenCalledWith(2);
    expect(cartMetricsInternals.cartOperationCounter).toBeDefined();
  });

  it("skips increments when metrics collection is disabled", () => {
    metricsMockState.isMetricsEnabledMock.mockReturnValue(false);

    recordCartOperationMetric("remove_item");

    expect(metricsMockState.labelsMock).not.toHaveBeenCalled();
    expect(metricsMockState.incrementMock).not.toHaveBeenCalled();
  });

  it("logs a debug message when incrementing fails", () => {
    metricsMockState.labelsMock.mockImplementationOnce(() => {
      throw new Error("metrics unavailable");
    });

    recordCartOperationMetric("validate_cart");

    expect(logger.debug).toHaveBeenCalledWith(
      "Failed to increment cart operation metric",
      expect.objectContaining({ operation: "validate_cart" }),
    );
  });
});
