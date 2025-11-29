import type { PaginationMeta, ProductSummaryDTO } from "@lumi/shared/dto";

export { paginationMetaSchema as productListResponseMetaSchema } from "@lumi/shared/dto";

export type ProductSummary = ProductSummaryDTO;
export type ProductStatus = ProductSummary["status"];

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
}

export interface ProductListResult {
  items: ProductSummary[];
  pagination: PaginationMeta;
  cursor?: string;
}
