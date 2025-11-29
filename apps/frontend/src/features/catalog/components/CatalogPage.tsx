"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { Route } from "next";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useInfiniteProducts } from "@/features/products/hooks/useInfiniteProducts";
import { useProducts } from "@/features/products/hooks/useProducts";
import type { ProductSummary } from "@/features/products/types/product.types";
import { Button } from "@/components/ui/button";

import { useProductFilters } from "../hooks/useProductFilters";
import { ActiveFilters, type FilterChip } from "./ActiveFilters";
import { CategoryHeader } from "./CategoryHeader";
import { FilterBar } from "./FilterBar";
import { FilterSidebar } from "./FilterSidebar";
import { PaginationControls } from "./PaginationControls";
import { ProductGrid } from "./ProductGrid";
import { SearchBar } from "./SearchBar";

const toTitleCase = (value: string) =>
  value
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const deriveCategories = (products: ProductSummary[]) => {
  const map = new Map<string, { label: string; slug?: string }>();
  products.forEach((product) => {
    product.categories.forEach((category) => {
      map.set(category.slug, { label: category.name, slug: category.slug });
    });
  });

  return [...map.values()];
};

const deriveBrands = (products: ProductSummary[]) => {
  const brands = new Set<string>();
  products.forEach((product) => {
    const attributes = product.attributes as Record<string, unknown> | null;
    const brand = attributes?.brand;
    if (typeof brand === "string") {
      brands.add(toTitleCase(brand));
    } else if (Array.isArray(brand)) {
      brand.forEach((entry) => {
        if (typeof entry === "string") {
          brands.add(toTitleCase(entry));
        }
      });
    }
  });
  return [...brands];
};

export function CatalogPage(): JSX.Element {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const previousQueryRef = useRef<string>("");

  const {
    search,
    categorySlug,
    categoryLabel,
    sort,
    page,
    pageSize,
    viewMode,
    priceRange,
    attributes,
    availability,
    brands,
    rating,
    setSearch,
    setCategory,
    clearCategory,
    setSort,
    setPage,
    setPageSize,
    setViewMode,
    setPriceRange,
    clearPriceRange,
    toggleAttribute,
    clearAttribute,
    setAvailability,
    toggleBrand,
    setRating,
    resetFilters,
    hydrateFromSearchParams,
    toProductQuery,
  } = useProductFilters();

  useEffect(() => {
    const hydratedParams = searchParams
      ? new URLSearchParams(searchParams.toString())
      : new URLSearchParams();
    hydrateFromSearchParams(hydratedParams);
    setHydrated(true);
  }, [hydrateFromSearchParams, searchParams]);

  useEffect(() => {
    if (viewMode === "infinite") {
      setPage(1);
    }
  }, [setPage, viewMode]);

  useEffect(() => {
    if (!hydrated) return;
    const params = new URLSearchParams();

    if (search) params.set("search", search);
    if (categorySlug) params.set("category", categorySlug);
    if (sort !== "featured") params.set("sort", sort);
    if (viewMode === "infinite") params.set("view", "infinite");
    if (page > 1) params.set("page", String(page));
    if (pageSize !== 24) params.set("pageSize", String(pageSize));
    if (priceRange.min !== undefined) params.set("priceMin", String(priceRange.min));
    if (priceRange.max !== undefined) params.set("priceMax", String(priceRange.max));
    if (availability) params.set("availability", availability);
    brands.forEach((brand) => params.append("brand", brand));
    if (rating) params.set("rating", String(rating));
    Object.entries(attributes).forEach(([key, values]) => {
      values?.forEach((value) => params.append(`attr_${key}`, value));
    });

    const queryString = params.toString();
    if (queryString === previousQueryRef.current) return;
    previousQueryRef.current = queryString;

    const targetPath = pathname ?? "/";
    const targetUrl = (queryString ? `${targetPath}?${queryString}` : targetPath) as Route;
    router.replace(targetUrl, { scroll: false });
  }, [
    attributes,
    availability,
    brands,
    categorySlug,
    hydrated,
    page,
    pageSize,
    pathname,
    priceRange.max,
    priceRange.min,
    rating,
    router,
    search,
    sort,
    viewMode,
  ]);

  const productFilters = useMemo(() => toProductQuery(), [toProductQuery]);
  const isInfinite = viewMode === "infinite";

  const productsQuery = useProducts(productFilters, {
    staleTimeMs: 60_000,
    gcTimeMs: 120_000,
    enabled: !isInfinite,
  });

  const infiniteQuery = useInfiniteProducts(productFilters, {
    staleTimeMs: 60_000,
    gcTimeMs: 120_000,
    enabled: isInfinite,
  });

  const products: ProductSummary[] = useMemo(() => {
    if (isInfinite) {
      return infiniteQuery.data?.pages.flatMap((pageData) => pageData.items) ?? [];
    }
    return productsQuery.data?.items ?? [];
  }, [infiniteQuery.data?.pages, isInfinite, productsQuery.data?.items]);

  const pagination = productsQuery.data?.pagination;

  const categories = useMemo(() => deriveCategories(products), [products]);
  const availableBrands = useMemo(() => deriveBrands(products), [products]);
  const sidebarCategories = useMemo(
    () => [{ label: "All", slug: undefined }, ...categories],
    [categories],
  );

  const filterChips: FilterChip[] = useMemo(() => {
    const chips: FilterChip[] = [];
    if (search) {
      chips.push({ label: `Search: ${search}`, onRemove: () => setSearch("") });
    }
    if (categorySlug) {
      chips.push({
        label: `Category: ${categoryLabel ?? categorySlug}`,
        onRemove: () => clearCategory(),
      });
    }
    if (priceRange.min !== undefined || priceRange.max !== undefined) {
      chips.push({
        label: `Price: ${priceRange.min ?? 0} - ${priceRange.max ?? "MAX"}`,
        onRemove: () => clearPriceRange(),
      });
    }
    Object.entries(attributes).forEach(([key, values]) => {
      if (values && values.length > 0) {
        chips.push({
          label: `${toTitleCase(key)}: ${values.join(", ")}`,
          onRemove: () => clearAttribute(key),
        });
      }
    });
    brands.forEach((brand) =>
      chips.push({
        label: `Brand: ${brand}`,
        onRemove: () => toggleBrand(brand),
      }),
    );
    if (availability) {
      chips.push({
        label: `Availability: ${availability.replace("_", " ")}`,
        onRemove: () => setAvailability(undefined),
      });
    }
    if (rating) {
      chips.push({
        label: `Rating: ${rating}+`,
        onRemove: () => setRating(undefined),
      });
    }
    return chips;
  }, [
    attributes,
    availability,
    brands,
    categoryLabel,
    categorySlug,
    clearAttribute,
    clearCategory,
    clearPriceRange,
    priceRange.max,
    priceRange.min,
    rating,
    search,
    setAvailability,
    setRating,
    setSearch,
    toggleBrand,
  ]);

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className="bg-lumi-bg text-lumi-text">
      <CategoryHeader
        title="Product Catalog"
        subtitle="Minimal grid, curated drops"
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Products" }]}
      />

      <section className="py-10">
        <div className="container space-y-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <SearchBar value={search} onSearch={setSearch} />
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === "paged" ? "default" : "outline"}
                className="text-[10px] uppercase tracking-[0.18em]"
                onClick={() => setViewMode("paged")}
              >
                Paginated
              </Button>
              <Button
                variant={viewMode === "infinite" ? "default" : "outline"}
                className="text-[10px] uppercase tracking-[0.18em]"
                onClick={() => setViewMode("infinite")}
              >
                Infinite
              </Button>
            </div>
          </div>

          <FilterBar
            categories={categories}
            activeCategory={categorySlug}
            onCategoryChange={(slug, label) => setCategory(slug, label)}
            sort={sort}
            onSortChange={(nextSort) => setSort(nextSort)}
            onOpenFilters={() => setFiltersOpen(true)}
            activeCount={filterChips.length}
          />

          <ActiveFilters chips={filterChips} onClearAll={resetFilters} />

          <div className="grid gap-10 lg:grid-cols-[280px,1fr]">
            <div className="hidden lg:block">
              <FilterSidebar
                variant="panel"
                categories={sidebarCategories}
                selectedCategory={categorySlug}
                onCategoryChange={(slug, label) => setCategory(slug, label)}
                priceRange={priceRange}
                onPriceChange={setPriceRange}
                attributes={attributes}
                onAttributeToggle={toggleAttribute}
                availability={availability}
                onAvailabilityChange={setAvailability}
                brands={brands}
                availableBrands={availableBrands}
                onBrandToggle={toggleBrand}
                rating={rating}
                onRatingChange={setRating}
                onClearAll={resetFilters}
                activeCount={filterChips.length}
              />
            </div>

            <div className="space-y-6">
              <ProductGrid
                products={products}
                isLoading={productsQuery.isLoading || infiniteQuery.isLoading}
                isError={productsQuery.isError || infiniteQuery.isError}
                onRetry={() => {
                  productsQuery.refetch();
                  infiniteQuery.refetch();
                }}
                onClearFilters={resetFilters}
                viewMode={viewMode}
                hasNextPage={isInfinite ? infiniteQuery.hasNextPage : pagination?.hasNextPage}
                isFetchingNextPage={infiniteQuery.isFetchingNextPage}
                onLoadMore={() => infiniteQuery.fetchNextPage()}
              />

              {!isInfinite && pagination && (
                <PaginationControls
                  page={pagination.page}
                  pageSize={pagination.pageSize}
                  totalItems={pagination.totalItems}
                  hasNextPage={pagination.hasNextPage}
                  hasPreviousPage={pagination.hasPreviousPage}
                  onPageChange={handlePageChange}
                  onPageSizeChange={handlePageSizeChange}
                />
              )}
            </div>
          </div>
        </div>
      </section>

      <FilterSidebar
        variant="drawer"
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        categories={sidebarCategories}
        selectedCategory={categorySlug}
        onCategoryChange={(slug, label) => {
          setCategory(slug, label);
          setFiltersOpen(false);
        }}
        priceRange={priceRange}
        onPriceChange={setPriceRange}
        attributes={attributes}
        onAttributeToggle={toggleAttribute}
        availability={availability}
        onAvailabilityChange={setAvailability}
        brands={brands}
        availableBrands={availableBrands}
        onBrandToggle={toggleBrand}
        rating={rating}
        onRatingChange={setRating}
        onClearAll={() => {
          resetFilters();
          setFiltersOpen(false);
        }}
        onApply={() => setFiltersOpen(false)}
        activeCount={filterChips.length}
      />
    </div>
  );
}
