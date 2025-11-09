import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import {
  cacheMetricsInternals,
  recordCatalogCacheHit,
  recordCatalogCacheInvalidation,
  recordCatalogCacheMiss,
} from "../cache-metrics.js";

jest.mock("../metrics.js", () => {
  const state = {
    createCounterMock: jest.fn(),
    labelsMock: jest.fn(),
    incrementMock: jest.fn(),
    isMetricsEnabledMock: jest.fn(),
  };

  const counterInstance = {
    labels: (...args: unknown[]) => state.labelsMock(...args),
  };

  const reset = () => {
    state.createCounterMock.mockReset().mockReturnValue(counterInstance);
    state.labelsMock.mockReset().mockReturnValue({
      inc: state.incrementMock,
    });
    state.incrementMock.mockReset();
    state.isMetricsEnabledMock.mockReset().mockReturnValue(true);
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

const metricsModule = jest.requireMock("../metrics.js") as {
  mockState: {
    createCounterMock: jest.Mock;
    labelsMock: jest.Mock;
    incrementMock: jest.Mock;
    isMetricsEnabledMock: jest.Mock;
  };
  resetMocks: () => void;
};

const getMetricsState = () => metricsModule.mockState;

describe("cache metrics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    metricsModule.resetMocks();
  });

  it("records cache hits", () => {
    recordCatalogCacheHit("products");

    expect(getMetricsState().labelsMock).toHaveBeenCalledWith("products");
    expect(getMetricsState().incrementMock).toHaveBeenCalled();
    expect(cacheMetricsInternals.hitCounter).toBeDefined();
  });

  it("records cache misses", () => {
    recordCatalogCacheMiss("categories");

    expect(getMetricsState().labelsMock).toHaveBeenCalledWith("categories");
    expect(getMetricsState().incrementMock).toHaveBeenCalled();
    expect(cacheMetricsInternals.missCounter).toBeDefined();
  });

  it("records cache invalidations", () => {
    recordCatalogCacheInvalidation("popular");

    expect(getMetricsState().labelsMock).toHaveBeenCalledWith("popular");
    expect(getMetricsState().incrementMock).toHaveBeenCalled();
    expect(cacheMetricsInternals.invalidationCounter).toBeDefined();
  });

  it("skips increments when metrics are disabled", () => {
    getMetricsState().isMetricsEnabledMock.mockReturnValue(false);

    recordCatalogCacheHit("products");
    recordCatalogCacheMiss("products");
    recordCatalogCacheInvalidation("products");

    expect(getMetricsState().labelsMock).not.toHaveBeenCalled();
    expect(getMetricsState().incrementMock).not.toHaveBeenCalled();
  });
});
