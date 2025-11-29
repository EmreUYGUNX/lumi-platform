import { ChevronDown } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CatalogSortOption } from "@/features/catalog/hooks/useProductFilters";

const SORT_OPTIONS: { value: CatalogSortOption; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "price_low_high", label: "Price: Low to High" },
  { value: "price_high_low", label: "Price: High to Low" },
  { value: "newest", label: "Newest First" },
  { value: "best_selling", label: "Best Selling" },
  { value: "rating", label: "Rating: High to Low" },
];

interface SortDropdownProps {
  value: CatalogSortOption;
  onChange: (value: CatalogSortOption) => void;
}

export function SortDropdown({ value, onChange }: SortDropdownProps): JSX.Element {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as CatalogSortOption)}>
      <SelectTrigger className="border-lumi-border text-[10px] uppercase tracking-[0.2em]">
        <div className="flex items-center gap-2">
          <span className="text-lumi-text-secondary">Sort by</span>
          <ChevronDown className="h-3 w-3" />
        </div>
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end" className="min-w-[220px]">
        {SORT_OPTIONS.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            className="text-[11px] uppercase tracking-[0.18em]"
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
