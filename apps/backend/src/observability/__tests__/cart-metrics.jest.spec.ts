import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import { cartMetricsInternals, recordCartOperationMetric } from "../cart-metrics.js";

const incrementMock = jest.fn();
const labelsMock = jest.fn(() => ({ inc: incrementMock }));
const createCounterMock = jest.fn(() => ({
  labels: labelsMock,
}));
const isMetricsEnabledMock = jest.fn(() => true);
const loggerDebugMock = jest.fn();

jest.mock("../metrics.js", () => ({
  createCounter: createCounterMock,
  isMetricsCollectionEnabled: isMetricsEnabledMock,
}));

jest.mock("../../lib/logger.js", () => ({
  logger: {
    debug: loggerDebugMock,
  },
}));

describe("cart metrics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    isMetricsEnabledMock.mockReturnValue(true);
  });

  it("increments counters when metrics collection is enabled", () => {
    recordCartOperationMetric("add_item", 2);

    expect(labelsMock).toHaveBeenCalledWith("add_item");
    expect(incrementMock).toHaveBeenCalledWith(2);
    expect(cartMetricsInternals.cartOperationCounter).toBeDefined();
  });

  it("skips increments when metrics collection is disabled", () => {
    isMetricsEnabledMock.mockReturnValue(false);

    recordCartOperationMetric("remove_item");

    expect(labelsMock).not.toHaveBeenCalled();
    expect(incrementMock).not.toHaveBeenCalled();
  });

  it("logs a debug message when incrementing fails", () => {
    labelsMock.mockImplementationOnce(() => {
      throw new Error("metrics unavailable");
    });

    recordCartOperationMetric("validate_cart");

    expect(loggerDebugMock).toHaveBeenCalledWith(
      "Failed to increment cart operation metric",
      expect.objectContaining({ operation: "validate_cart" }),
    );
  });
});
