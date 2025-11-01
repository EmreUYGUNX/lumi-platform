import type { Express } from "express";

import type { ApplicationConfig } from "@lumi/types";

import { createApp } from "../app.js";
import type { CreateAppOptions } from "../app.js";
import { NotFoundError } from "../lib/errors.js";
import type {
  CatalogService,
  CategoryDetailResult,
  ProductDetailResult,
} from "../modules/catalog/catalog.service.js";
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

const emptyPaginationMeta = {
  page: 1,
  pageSize: 0,
  totalItems: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false,
};

const CATALOG_STUB_ERROR = "Catalog service stub not implemented in test harness.";

const createCatalogServiceStub = () => ({
  async listPublicProducts() {
    return {
      items: [],
      meta: emptyPaginationMeta,
    };
  },
  async getProductDetail(): Promise<ProductDetailResult> {
    throw new NotFoundError(CATALOG_STUB_ERROR);
  },
  async listProductVariants() {
    return [];
  },
  async createProduct() {
    throw new NotFoundError(CATALOG_STUB_ERROR);
  },
  async updateProduct() {
    throw new NotFoundError(CATALOG_STUB_ERROR);
  },
  async archiveProduct() {
    await Promise.resolve();
  },
  async addVariant() {
    throw new NotFoundError(CATALOG_STUB_ERROR);
  },
  async updateVariant() {
    throw new NotFoundError(CATALOG_STUB_ERROR);
  },
  async deleteVariant() {
    await Promise.resolve();
  },
  async listCategories() {
    return [];
  },
  async getCategoryDetail(): Promise<CategoryDetailResult> {
    throw new NotFoundError(CATALOG_STUB_ERROR);
  },
  async createCategory() {
    throw new NotFoundError(CATALOG_STUB_ERROR);
  },
  async updateCategory() {
    throw new NotFoundError(CATALOG_STUB_ERROR);
  },
  async deleteCategory() {
    await Promise.resolve();
  },
});

export const createTestApp = (options: CreateTestAppOptions = {}): TestAppContext => {
  const overrides = resolveOverrides(options.configOverrides);
  const config = createTestConfig(overrides);
  const catalogOptionsOverrides = options.apiOptions?.catalogOptions;
  const apiOptions = {
    ...options.apiOptions,
    catalogOptions: {
      service: (catalogOptionsOverrides?.service ??
        createCatalogServiceStub()) as unknown as CatalogService,
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
