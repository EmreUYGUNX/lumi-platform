import type { Express } from "express";

import type { ApplicationConfig } from "@lumi/types";

import { createApp } from "../app.js";
import type { CreateAppOptions } from "../app.js";
import { NotFoundError } from "../lib/errors.js";
import type {
  ProductSearchResult,
  ProductServiceContract,
} from "../modules/product/product.service.js";
import type { DeepPartial } from "./config.js";
import { createTestConfig, mergeTestOverrides } from "./config.js";

const resetMetrics = async () => {
  const { metricsInternals } = await import("../observability/metrics.js");
  metricsInternals.resetForTest();
};

const DEFAULT_OVERRIDES: DeepPartial<ApplicationConfig> = {
  observability: {
    logs: {
      consoleEnabled: false,
      request: {
        sampleRate: 0,
      },
    },
  },
};

export interface CreateTestAppOptions {
  /**
   * Optional configuration overrides applied on top of the deterministic baseline.
   */
  configOverrides?: DeepPartial<ApplicationConfig>;
  apiOptions?: CreateAppOptions["apiOptions"];
}

export interface TestAppContext {
  app: Express;
  config: ApplicationConfig;
  cleanup: () => Promise<void>;
}

const resolveOverrides = (
  overrides: DeepPartial<ApplicationConfig> | undefined,
): DeepPartial<ApplicationConfig> =>
  mergeTestOverrides<ApplicationConfig>(DEFAULT_OVERRIDES, overrides ?? {});

const createProductServiceStub = (): ProductServiceContract => ({
  async search(): Promise<ProductSearchResult> {
    return {
      items: [],
      meta: {
        page: 1,
        pageSize: 0,
        totalItems: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };
  },
  async getBySlug() {
    throw new NotFoundError("Product service stub not implemented in test harness.");
  },
});

export const createTestApp = (options: CreateTestAppOptions = {}): TestAppContext => {
  const overrides = resolveOverrides(options.configOverrides);
  const config = createTestConfig(overrides);
  const catalogServicesOverrides = options.apiOptions?.catalogServices;
  const apiOptions = {
    ...options.apiOptions,
    catalogServices: {
      productService: createProductServiceStub(),
      ...catalogServicesOverrides,
    },
  } satisfies CreateAppOptions["apiOptions"];
  const app = createApp({ config, apiOptions });

  const cleanup = async () => {
    const rateLimiterCleanup = app.get("rateLimiterCleanup") as (() => Promise<void>) | undefined;
    if (rateLimiterCleanup) {
      await rateLimiterCleanup();
    }
    await resetMetrics();
  };

  return { app, config, cleanup };
};

export const withTestApp = async (
  callback: (context: TestAppContext) => Promise<void>,
  options: CreateTestAppOptions = {},
): Promise<void> => {
  const context = createTestApp(options);

  try {
    await callback(context);
  } finally {
    await context.cleanup();
  }
};
