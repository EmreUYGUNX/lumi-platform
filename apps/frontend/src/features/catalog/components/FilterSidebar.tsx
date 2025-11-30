import { useEffect, useMemo, useState } from "react";

import { Star } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type {
  InventoryAvailability,
  ProductAttributeFilters,
} from "@/features/products/types/product.types";

import type { CatalogCategoryOption } from "./FilterBar";

interface FilterSidebarProps {
  categories: CatalogCategoryOption[];
  selectedCategory?: string;
  onCategoryChange: (slug?: string, label?: string) => void;
  priceRange: { min?: number; max?: number };
  onPriceChange: (range: { min?: number; max?: number }) => void;
  attributes: ProductAttributeFilters;
  onAttributeToggle: (attribute: string, value: string) => void;
  availability?: InventoryAvailability;
  onAvailabilityChange: (value?: InventoryAvailability) => void;
  brands: string[];
  availableBrands: string[];
  onBrandToggle: (brand: string) => void;
  rating?: number;
  onRatingChange: (rating?: number) => void;
  onClearAll: () => void;
  onApply?: () => void;
  variant?: "panel" | "drawer";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  activeCount?: number;
}

const SIZE_OPTIONS = ["XS", "S", "M", "L", "XL"];
const COLOR_SWATCHES = [
  { label: "Black", value: "#0f172a" },
  { label: "White", value: "#f9fafb", border: true },
  { label: "Gray", value: "#6b7280" },
  { label: "Navy", value: "#111827" },
  { label: "Sky", value: "#60a5fa" },
];

const PRICE_MIN = 0;
const PRICE_MAX = 5000;

const RatingButton = ({
  ratingValue,
  active,
  onSelect,
}: {
  ratingValue: number;
  active: boolean;
  onSelect: (value?: number) => void;
}) => (
  <button
    type="button"
    onClick={() => onSelect(active ? undefined : ratingValue)}
    className={cn(
      "flex min-h-[44px] items-center gap-2 rounded-full border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em]",
      active
        ? "border-lumi-text bg-lumi-bg-secondary text-lumi-text"
        : "border-lumi-border text-lumi-text-secondary",
    )}
  >
    {Array.from({ length: 5 }).map((_, index) => (
      <Star
        key={`${ratingValue}-star-${index}`}
        className={cn(
          "h-3.5 w-3.5",
          index < ratingValue ? "fill-lumi-text text-lumi-text" : "text-lumi-border",
        )}
      />
    ))}
    {ratingValue}+
  </button>
);

const FilterContent = ({
  categories,
  selectedCategory,
  onCategoryChange,
  priceRange,
  onPriceChange,
  attributes,
  onAttributeToggle,
  availability,
  onAvailabilityChange,
  brands,
  availableBrands,
  onBrandToggle,
  rating,
  onRatingChange,
  onClearAll,
  onApply,
  activeCount = 0,
}: Omit<FilterSidebarProps, "variant" | "open" | "onOpenChange" | "viewMode">) => {
  const [localRange, setLocalRange] = useState<{ min?: number; max?: number }>(priceRange);

  useEffect(() => {
    setLocalRange(priceRange);
  }, [priceRange]);

  const updateRange = (partial: { min?: number; max?: number }) => {
    const nextRange = {
      ...localRange,
      ...partial,
    };
    if (
      nextRange.min !== undefined &&
      nextRange.max !== undefined &&
      nextRange.min > nextRange.max
    ) {
      nextRange.max = nextRange.min;
    }
    setLocalRange(nextRange);
    onPriceChange(nextRange);
  };

  const activeColorValues = useMemo(() => new Set(attributes.color ?? []), [attributes.color]);
  const activeSizes = useMemo(() => new Set(attributes.size ?? []), [attributes.size]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em]">Filters</p>
        {activeCount > 0 && (
          <span className="bg-lumi-text rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white">
            {activeCount}
          </span>
        )}
        <Button
          variant="ghost"
          className="text-[11px] uppercase tracking-[0.2em]"
          onClick={() => {
            onClearAll();
            onApply?.();
          }}
        >
          Clear All
        </Button>
      </div>

      <Accordion
        type="multiple"
        defaultValue={["categories", "price", "attributes"]}
        className="space-y-2"
      >
        <AccordionItem value="categories" className="border-lumi-border/60 rounded-xl border">
          <AccordionTrigger className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.24em]">
            Categories
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="space-y-2">
              {categories.map((category) => (
                <Label
                  key={category.slug ?? category.label}
                  className="flex cursor-pointer items-center gap-3 text-sm"
                >
                  <Checkbox
                    checked={selectedCategory === category.slug}
                    onCheckedChange={() => onCategoryChange(category.slug, category.label)}
                  />
                  <span className="text-[11px] uppercase tracking-[0.2em]">{category.label}</span>
                </Label>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="price" className="border-lumi-border/60 rounded-xl border">
          <AccordionTrigger className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.24em]">
            Price Range
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={PRICE_MIN}
                max={PRICE_MAX}
                value={localRange.min ?? ""}
                onChange={(event) => {
                  const nextValue =
                    event.target.value === "" ? undefined : Number(event.target.value);
                  updateRange({ min: nextValue });
                }}
                className="w-24 rounded-lg bg-white text-sm"
                placeholder="Min"
              />
              <span className="text-lumi-text-secondary text-xs uppercase tracking-[0.16em]">
                to
              </span>
              <Input
                type="number"
                min={PRICE_MIN}
                max={PRICE_MAX}
                value={localRange.max ?? ""}
                onChange={(event) => {
                  const nextValue =
                    event.target.value === "" ? undefined : Number(event.target.value);
                  updateRange({ max: nextValue });
                }}
                className="w-24 rounded-lg bg-white text-sm"
                placeholder="Max"
              />
            </div>
            <div className="mt-4 space-y-2">
              <div className="relative">
                <input
                  type="range"
                  min={PRICE_MIN}
                  max={PRICE_MAX}
                  value={localRange.min ?? PRICE_MIN}
                  onChange={(event) => updateRange({ min: Number(event.target.value) })}
                  className="range-thumb-lumi absolute z-10 h-2 w-full appearance-none bg-transparent"
                />
                <input
                  type="range"
                  min={PRICE_MIN}
                  max={PRICE_MAX}
                  value={localRange.max ?? PRICE_MAX}
                  onChange={(event) => updateRange({ max: Number(event.target.value) })}
                  className="range-thumb-lumi h-2 w-full appearance-none bg-transparent"
                />
                <div className="bg-lumi-border/70 absolute inset-0 rounded-full" />
                <div
                  className="bg-lumi-text absolute inset-y-0 rounded-full"
                  style={{
                    left: `${((localRange.min ?? PRICE_MIN) / PRICE_MAX) * 100}%`,
                    right: `${100 - ((localRange.max ?? PRICE_MAX) / PRICE_MAX) * 100}%`,
                    opacity: 0.25,
                  }}
                />
              </div>
              <p className="text-lumi-text-secondary text-[11px] uppercase tracking-[0.2em]">
                TRY {localRange.min ?? PRICE_MIN} - TRY {localRange.max ?? PRICE_MAX}
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="attributes" className="border-lumi-border/60 rounded-xl border">
          <AccordionTrigger className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.24em]">
            Attributes
          </AccordionTrigger>
          <AccordionContent className="space-y-4 px-4 pb-4">
            <div>
              <p className="text-lumi-text-secondary text-[10px] uppercase tracking-[0.2em]">
                Sizes
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {SIZE_OPTIONS.map((size) => (
                  <Badge
                    key={size}
                    variant={activeSizes.has(size) ? "default" : "outline"}
                    className={cn(
                      "cursor-pointer rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]",
                      activeSizes.has(size)
                        ? "bg-lumi-text text-white"
                        : "border-lumi-border text-lumi-text",
                    )}
                    onClick={() => onAttributeToggle("size", size)}
                  >
                    {size}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <p className="text-lumi-text-secondary text-[10px] uppercase tracking-[0.2em]">
                Colors
              </p>
              <div className="mt-3 grid grid-cols-5 gap-3">
                {COLOR_SWATCHES.map((swatch) => (
                  <button
                    key={swatch.label}
                    type="button"
                    onClick={() => onAttributeToggle("color", swatch.label.toLowerCase())}
                    className={cn(
                      "flex h-12 items-center justify-center rounded-xl border transition",
                      activeColorValues.has(swatch.label.toLowerCase())
                        ? "border-lumi-text shadow-sm"
                        : "border-lumi-border/80 hover:border-lumi-text",
                    )}
                    style={{
                      backgroundColor: swatch.value,
                    }}
                  >
                    <span
                      className={cn(
                        "text-[10px] font-semibold uppercase tracking-[0.18em]",
                        swatch.value === "#f9fafb" ? "text-lumi-text" : "text-white",
                      )}
                    >
                      {swatch.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="rating" className="border-lumi-border/60 rounded-xl border">
          <AccordionTrigger className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.24em]">
            Rating
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="flex flex-wrap gap-2">
              {[5, 4, 3].map((ratingValue) => (
                <RatingButton
                  key={ratingValue}
                  ratingValue={ratingValue}
                  active={rating === ratingValue}
                  onSelect={onRatingChange}
                />
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="availability" className="border-lumi-border/60 rounded-xl border">
          <AccordionTrigger className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.24em]">
            Availability
          </AccordionTrigger>
          <AccordionContent className="space-y-2 px-4 pb-4">
            <Label className="flex cursor-pointer items-center gap-3 text-sm">
              <Checkbox
                checked={availability === "in_stock"}
                onCheckedChange={() =>
                  onAvailabilityChange(availability === "in_stock" ? undefined : "in_stock")
                }
              />
              <span className="text-[11px] uppercase tracking-[0.2em]">In Stock</span>
            </Label>
            <Label className="flex cursor-pointer items-center gap-3 text-sm">
              <Checkbox
                checked={availability === "low_stock"}
                onCheckedChange={() =>
                  onAvailabilityChange(availability === "low_stock" ? undefined : "low_stock")
                }
              />
              <span className="text-[11px] uppercase tracking-[0.2em]">Low Stock</span>
            </Label>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="brands" className="border-lumi-border/60 rounded-xl border">
          <AccordionTrigger className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.24em]">
            Brands
          </AccordionTrigger>
          <AccordionContent className="space-y-2 px-4 pb-4">
            {availableBrands.map((brand) => (
              <Label key={brand} className="flex cursor-pointer items-center gap-3 text-sm">
                <Checkbox
                  checked={brands.includes(brand)}
                  onCheckedChange={() => onBrandToggle(brand)}
                />
                <span className="text-[11px] uppercase tracking-[0.2em]">{brand}</span>
              </Label>
            ))}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="flex gap-3">
        <Button
          variant="outline"
          className="border-lumi-border w-full text-[11px] uppercase tracking-[0.2em]"
          onClick={() => {
            onClearAll();
            onApply?.();
          }}
        >
          Reset
        </Button>
        <Button
          className="bg-lumi-text hover:bg-lumi-text w-full text-[11px] uppercase tracking-[0.2em] text-white"
          onClick={onApply}
        >
          Apply Filters
        </Button>
      </div>
    </div>
  );
};

export function FilterSidebar({
  variant = "panel",
  open,
  onOpenChange,
  ...props
}: FilterSidebarProps): JSX.Element {
  if (variant === "drawer") {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="border-lumi-border/70 h-[82vh] max-h-[720px] overflow-y-auto rounded-t-3xl border bg-white/95 px-6 pb-8 pt-4 shadow-2xl backdrop-blur-md sm:max-w-xl sm:rounded-3xl"
        >
          <SheetHeader className="flex flex-col items-center">
            <div className="bg-lumi-border/60 mb-2 h-1 w-12 rounded-full" aria-hidden />
            <SheetTitle className="text-[12px] uppercase tracking-[0.28em]">Filters</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            <FilterContent {...props} onApply={() => onOpenChange?.(false)} />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div className="border-lumi-border/70 rounded-2xl border bg-white/70 p-5 shadow-sm backdrop-blur">
      <FilterContent {...props} />
    </div>
  );
}
