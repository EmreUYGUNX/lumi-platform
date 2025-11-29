import type { PaginationMeta, ProductSummaryDTO } from "@lumi/shared/dto";

export { paginationMetaSchema as productListResponseMetaSchema } from "@lumi/shared/dto";

export type ProductSummary = ProductSummaryDTO;
export type ProductStatus = ProductSummary["status"];

export type InventoryAvailability = "in_stock" | "low_stock" | "out_of_stock";

export interface ProductPriceRangeFilter {
  min?: number;
  max?: number;
}

export type ProductAttributeFilters = Record<string, string[] | undefined>;

export interface ProductCursorMeta {
  hasMore: boolean;
  next?: string;
}

export interface ProductListFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  tags?: string[];
  categoryId?: string;
  categorySlug?: string;
  sort?:
    | "relevance"
    | "newest"
    | "oldest"
    | "price_asc"
    | "price_desc"
    | "title_asc"
    | "title_desc"
    | "rating";
  statuses?: ProductStatus[];
  cursor?: string;
  priceRange?: ProductPriceRangeFilter;
  attributes?: ProductAttributeFilters;
  inventoryAvailability?: InventoryAvailability;
  brands?: string[];
  rating?: number;
}

export interface ProductListResult {
  items: ProductSummary[];
  pagination: PaginationMeta;
  cursor?: ProductCursorMeta;
}
