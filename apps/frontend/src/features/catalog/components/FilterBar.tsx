import { SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CatalogSortOption } from "@/features/catalog/hooks/useProductFilters";

import { SortDropdown } from "./SortDropdown";

export interface CatalogCategoryOption {
  label: string;
  slug?: string;
}

interface FilterBarProps {
  categories: CatalogCategoryOption[];
  activeCategory?: string;
  onCategoryChange: (slug?: string, label?: string) => void;
  sort: CatalogSortOption;
  onSortChange: (sort: CatalogSortOption) => void;
  onOpenFilters?: () => void;
  activeCount?: number;
}

export function FilterBar({
  categories,
  activeCategory,
  onCategoryChange,
  sort,
  onSortChange,
  onOpenFilters,
  activeCount = 0,
}: FilterBarProps): JSX.Element {
  const items: CatalogCategoryOption[] = [{ label: "All" }, ...categories];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="hidden items-center gap-3 md:flex">
          {items.map((item) => (
            <button
              key={item.slug ?? item.label}
              type="button"
              onClick={() => onCategoryChange(item.slug, item.label)}
              className={cn(
                "min-h-[44px] rounded-full px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] transition",
                activeCategory === item.slug
                  ? "bg-lumi-text text-white"
                  : "border-lumi-border/70 text-lumi-text-secondary border",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex flex-1 items-center gap-3 md:hidden">
          <Button
            variant="outline"
            className="border-lumi-border flex items-center gap-2 text-[10px] uppercase tracking-[0.18em]"
            onClick={onOpenFilters}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {activeCount > 0 && (
              <span className="bg-lumi-text flex h-5 min-w-[20px] items-center justify-center rounded-full px-2 text-[10px] font-semibold text-white">
                {activeCount}
              </span>
            )}
          </Button>
          <SortDropdown value={sort} onChange={onSortChange} />
        </div>
        <div className="hidden md:block">
          <SortDropdown value={sort} onChange={onSortChange} />
        </div>
      </div>
    </div>
  );
}
