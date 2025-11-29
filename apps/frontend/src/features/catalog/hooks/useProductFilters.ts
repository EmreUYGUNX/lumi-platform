import { create } from "zustand";

import type {
  InventoryAvailability,
  ProductAttributeFilters,
  ProductListFilters,
} from "@/features/products/types/product.types";
import { normalizeProductFilters } from "@/features/products/hooks/product-query";

export type CatalogSortOption =
  | "featured"
  | "price_low_high"
  | "price_high_low"
  | "newest"
  | "best_selling"
  | "rating";

export type CatalogViewMode = "paged" | "infinite";

export interface CatalogFilterState {
  search: string;
  categorySlug?: string;
  categoryLabel?: string;
  sort: CatalogSortOption;
  page: number;
  pageSize: number;
  viewMode: CatalogViewMode;
  priceRange: { min?: number; max?: number };
  attributes: ProductAttributeFilters;
  availability?: InventoryAvailability;
  brands: string[];
  rating?: number;
}

export interface CatalogFilterActions {
  setSearch: (value: string) => void;
  setCategory: (slug?: string, label?: string) => void;
  clearCategory: () => void;
  setSort: (sort: CatalogSortOption) => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setViewMode: (mode: CatalogViewMode) => void;
  setPriceRange: (range: { min?: number; max?: number }) => void;
  clearPriceRange: () => void;
  toggleAttribute: (attribute: string, value: string) => void;
  clearAttribute: (attribute: string) => void;
  setAvailability: (availability?: InventoryAvailability) => void;
  toggleBrand: (brand: string) => void;
  setRating: (rating?: number) => void;
  resetFilters: () => void;
  hydrateFromSearchParams: (params: URLSearchParams) => void;
  toProductQuery: () => ProductListFilters;
}

export type CatalogFilterStore = CatalogFilterState & CatalogFilterActions;

const DEFAULT_PAGE_SIZE = 24;
const sanitizeSearch = (value: string): string =>
  value.replaceAll(/[<>]/gu, "").replaceAll(/\s+/gu, " ").trim().slice(0, 120);

const clampPage = (page: number): number => (Number.isFinite(page) && page > 0 ? page : 1);

const isCatalogSort = (value: string | null): value is CatalogSortOption =>
  value !== null &&
  ["featured", "price_low_high", "price_high_low", "newest", "best_selling", "rating"].includes(
    value,
  );

const mapSortToApi = (sort: CatalogSortOption): ProductListFilters["sort"] => {
  switch (sort) {
    case "price_low_high": {
      return "price_asc";
    }
    case "price_high_low": {
      return "price_desc";
    }
    case "newest": {
      return "newest";
    }
    case "rating": {
      return "rating";
    }
    case "best_selling": {
      return "rating";
    }
    default: {
      return "relevance";
    }
  }
};

const toNumber = (value?: string | null): number | undefined => {
  if (!value) return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseDelimitedValues = (value: string | null): string[] =>
  value
    ? value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];

const parseAvailabilityParam = (
  availabilityParam: string | null,
): InventoryAvailability | undefined => {
  if (!availabilityParam) return undefined;

  const allowed: InventoryAvailability[] = ["in_stock", "low_stock", "out_of_stock"];
  return allowed.includes(availabilityParam as InventoryAvailability)
    ? (availabilityParam as InventoryAvailability)
    : undefined;
};

const extractAttributeFilters = (params: URLSearchParams) => {
  const attributeEntries = [...params.entries()].filter(([key]) => key.startsWith("attr_"));
  const attributeFilterMap = new Map<string, string[]>();

  attributeEntries.forEach(([key, attributeValue]) => {
    const attributeKey = key.replace(/^attr_/u, "");
    const currentValues = attributeFilterMap.get(attributeKey) ?? [];
    if (!currentValues.includes(attributeValue)) {
      attributeFilterMap.set(attributeKey, [...currentValues, attributeValue]);
    }
  });

  const attributes = Object.fromEntries(attributeFilterMap) as ProductAttributeFilters;
  return { attributes, hasAttributes: attributeFilterMap.size > 0 };
};

// eslint-disable-next-line sonarjs/cognitive-complexity
const mapParamsToState = (params: URLSearchParams, state: CatalogFilterState) => {
  const nextSearch = sanitizeSearch(params.get("search") ?? params.get("q") ?? state.search);
  const categorySlug = params.get("category") ?? params.get("categorySlug") ?? state.categorySlug;
  const sortParam = params.get("sort");
  const nextSort = isCatalogSort(sortParam) ? sortParam : state.sort;
  const viewMode = params.get("view") === "infinite" ? "infinite" : state.viewMode;

  const page = clampPage(Number.parseInt(params.get("page") ?? "", 10));
  const pageSize = Number.parseInt(params.get("pageSize") ?? params.get("perPage") ?? "", 10);

  const priceMin = toNumber(params.get("priceMin"));
  const priceMax = toNumber(params.get("priceMax"));

  const brands = params.getAll("brand");
  const brandFallback = parseDelimitedValues(params.get("brands"));
  const allBrands = [...new Set([...brands, ...brandFallback])];

  const rating = toNumber(params.get("rating"));
  const availability = parseAvailabilityParam(
    params.get("availability") ?? params.get("inventory"),
  );
  const { attributes, hasAttributes } = extractAttributeFilters(params);

  return {
    search: nextSearch,
    categorySlug: categorySlug ?? undefined,
    sort: nextSort,
    page: page || state.page,
    pageSize: pageSize > 0 ? pageSize : state.pageSize,
    viewMode,
    priceRange: {
      min: priceMin ?? state.priceRange.min,
      max: priceMax ?? state.priceRange.max,
    },
    availability: availability ?? state.availability,
    brands: allBrands.length > 0 ? allBrands : state.brands,
    rating: rating ?? state.rating,
    attributes: hasAttributes ? attributes : state.attributes,
  } satisfies Partial<CatalogFilterState>;
};

export const useProductFilters = create<CatalogFilterStore>((set, get) => ({
  search: "",
  categorySlug: undefined,
  categoryLabel: undefined,
  sort: "featured",
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  viewMode: "paged",
  priceRange: {},
  attributes: {},
  availability: undefined,
  brands: [],
  rating: undefined,

  setSearch: (value) =>
    set((state) => ({
      ...state,
      search: sanitizeSearch(value),
      page: 1,
    })),

  setCategory: (slug, label) =>
    set((state) => ({
      ...state,
      categorySlug: slug,
      categoryLabel: label,
      page: 1,
    })),

  clearCategory: () =>
    set((state) => ({
      ...state,
      categorySlug: undefined,
      categoryLabel: undefined,
      page: 1,
    })),

  setSort: (sort) =>
    set((state) => ({
      ...state,
      sort,
      page: 1,
    })),

  setPage: (page) =>
    set((state) => ({
      ...state,
      page: clampPage(page),
    })),

  setPageSize: (pageSize) =>
    set((state) => ({
      ...state,
      pageSize: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : state.pageSize,
      page: 1,
    })),

  setViewMode: (mode) =>
    set((state) => ({
      ...state,
      viewMode: mode,
      page: 1,
    })),

  setPriceRange: (range) =>
    set((state) => ({
      ...state,
      priceRange: {
        min: range.min ?? undefined,
        max: range.max ?? undefined,
      },
      page: 1,
    })),

  clearPriceRange: () =>
    set((state) => ({
      ...state,
      priceRange: {},
      page: 1,
    })),

  toggleAttribute: (attribute, value) =>
    set((state) => {
      const normalized = attribute.toLowerCase();
      // eslint-disable-next-line security/detect-object-injection
      const current = state.attributes[normalized] ?? [];
      const exists = current.includes(value);
      const nextValues = exists ? current.filter((entry) => entry !== value) : [...current, value];

      const nextAttributes: ProductAttributeFilters = { ...state.attributes };
      if (nextValues.length === 0) {
        // eslint-disable-next-line security/detect-object-injection
        delete nextAttributes[normalized];
      } else {
        // eslint-disable-next-line security/detect-object-injection
        nextAttributes[normalized] = nextValues;
      }

      return {
        ...state,
        attributes: nextAttributes,
        page: 1,
      };
    }),

  clearAttribute: (attribute) =>
    set((state) => {
      const nextAttributes: ProductAttributeFilters = { ...state.attributes };
      // eslint-disable-next-line security/detect-object-injection
      delete nextAttributes[attribute];
      return { ...state, attributes: nextAttributes, page: 1 };
    }),

  setAvailability: (availability) =>
    set((state) => ({
      ...state,
      availability,
      page: 1,
    })),

  toggleBrand: (brand) =>
    set((state) => {
      const nextBrands = state.brands.includes(brand)
        ? state.brands.filter((entry) => entry !== brand)
        : [...state.brands, brand];
      return {
        ...state,
        brands: nextBrands,
        page: 1,
      };
    }),

  setRating: (rating) =>
    set((state) => ({
      ...state,
      rating,
      page: 1,
    })),

  resetFilters: () =>
    set((state) => ({
      ...state,
      search: "",
      categorySlug: undefined,
      categoryLabel: undefined,
      priceRange: {},
      attributes: {},
      availability: undefined,
      brands: [],
      rating: undefined,
      page: 1,
    })),

  hydrateFromSearchParams: (params) =>
    set((state) => ({
      ...state,
      ...mapParamsToState(params, state),
    })),

  toProductQuery: () => {
    const state = get();

    const filters: ProductListFilters = {
      page: state.page,
      pageSize: state.pageSize,
      search: state.search,
      categorySlug: state.categorySlug,
      sort: mapSortToApi(state.sort),
      priceRange: state.priceRange,
      attributes: state.attributes,
      inventoryAvailability: state.availability,
      brands: state.brands,
      rating: state.rating,
    };

    return normalizeProductFilters(filters);
  },
}));
