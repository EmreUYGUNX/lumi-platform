import type { ProductionOrdersQuery } from "./useProductionOrders";

export const productionKeys = {
  all: () => ["production"] as const,
  orders: (query: ProductionOrdersQuery) =>
    [...productionKeys.all(), "orders", JSON.stringify(query)] as const,
  order: (orderId: string) => [...productionKeys.all(), "order", orderId] as const,
  generate: () => [...productionKeys.all(), "generate"] as const,
  download: () => [...productionKeys.all(), "download"] as const,
  batchDownload: () => [...productionKeys.all(), "batch-download"] as const,
};
