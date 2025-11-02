import type { Express } from "express";

import type { ApplicationConfig } from "@lumi/types";

import { createApp } from "../app.js";
import type { CreateAppOptions } from "../app.js";
import { NotFoundError } from "../lib/errors.js";
import type { CartService } from "../modules/cart/cart.service.js";
import type { CartSummaryView, CartValidationReport } from "../modules/cart/cart.types.js";
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

const createCartServiceStub = () => {
  const nowIso = new Date("2025-01-01T00:00:00.000Z").toISOString();
  const emptyCart: CartSummaryView = {
    cart: {
      id: "cart_test",
      userId: "user_test",
      // eslint-disable-next-line unicorn/no-null -- Test stub mirrors API shape with explicit null sentinel
      sessionId: null,
      status: "ACTIVE",
      // eslint-disable-next-line unicorn/no-null -- Test stub mirrors API shape with explicit null sentinel
      expiresAt: null,
      items: [],
      totals: {
        subtotal: { amount: "0.00", currency: "TRY" },
        tax: { amount: "0.00", currency: "TRY" },
        discount: { amount: "0.00", currency: "TRY" },
        total: { amount: "0.00", currency: "TRY" },
      },
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    stock: {
      status: "ok",
      issues: [],
      checkedAt: nowIso,
    },
    delivery: {
      status: "standard",
      minHours: 24,
      maxHours: 72,
      estimatedDeliveryDate: new Date("2025-01-04T00:00:00.000Z").toISOString(),
      message: "Standard delivery",
    },
  } satisfies CartSummaryView;

  const validationReport: CartValidationReport = {
    cartId: emptyCart.cart.id,
    valid: true,
    issues: [],
    stock: emptyCart.stock,
    totals: emptyCart.cart.totals,
    checkedAt: nowIso,
  };

  return {
    getCart: async () => emptyCart,
    addItem: async () => emptyCart,
    updateItem: async () => emptyCart,
    removeItem: async () => emptyCart,
    clearCart: async () => emptyCart,
    mergeCart: async () => emptyCart,
    validateCart: async () => validationReport,
    cleanupExpiredCarts: async () => {},
    shutdown: async () => {},
  } as unknown as CartService;
};

export const createTestApp = (options: CreateTestAppOptions = {}): TestAppContext => {
  const overrides = resolveOverrides(options.configOverrides);
  const config = createTestConfig(overrides);
  const catalogOptionsOverrides = options.apiOptions?.catalogOptions;
  const cartOptionsOverrides = options.apiOptions?.cartOptions;
  const apiOptions = {
    ...options.apiOptions,
    catalogOptions: {
      service: (catalogOptionsOverrides?.service ??
        createCatalogServiceStub()) as unknown as CatalogService,
    },
    cartOptions: {
      service: (cartOptionsOverrides?.service ?? createCartServiceStub()) as unknown as CartService,
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
