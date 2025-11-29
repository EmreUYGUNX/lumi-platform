"use client";

import { useMemo } from "react";

import { Palette, Shirt } from "lucide-react";

import { Button } from "@/components/ui/button";
import type {
  VariantAttributeOptions,
  VariantAvailability,
  VariantSelection,
} from "@/features/product/hooks/useVariantSelection";
import type { ProductSummary } from "@/features/products/types/product.types";
import { cn } from "@/lib/utils";

const isHexColor = (value: string) => /^#?([0-9a-f]{3}|[0-9a-f]{6})$/iu.test(value);

const renderColorChip = ({
  option,
  selected,
  onClick,
}: {
  option: { value: string; available: boolean };
  selected: boolean;
  onClick: () => void;
}) => {
  const style = isHexColor(option.value)
    ? { backgroundColor: option.value.startsWith("#") ? option.value : `#${option.value}` }
    : {
        backgroundImage: `linear-gradient(135deg, var(--lumi-primary) 0%, var(--lumi-secondary) 100%)`,
      };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!option.available}
      className={cn(
        "h-10 w-10 rounded-full border shadow-sm transition duration-300",
        selected ? "ring-lumi-primary ring-2 ring-offset-2" : "border-lumi-border",
        !option.available && "opacity-40",
      )}
      style={style}
      aria-label={`Select color ${option.value}`}
    />
  );
};

const renderTextChip = ({
  label,
  selected,
  disabled,
  onClick,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className={cn(
      "rounded-full border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em]",
      selected
        ? "border-lumi-text bg-lumi-text text-white"
        : "border-lumi-border text-lumi-text bg-white",
      disabled && "opacity-50",
    )}
  >
    {label}
  </button>
);

interface VariantSelectorProps {
  product?: ProductSummary;
  selection: VariantSelection;
  attributeOptions: VariantAttributeOptions;
  selectedVariant?: ProductSummary["variants"][number];
  availability: VariantAvailability;
  onSelectAttribute: (attribute: string, value: string) => void;
  onReset?: () => void;
}

export function VariantSelector({
  product,
  selection,
  attributeOptions,
  selectedVariant,
  availability,
  onSelectAttribute,
  onReset,
}: VariantSelectorProps): JSX.Element {
  const hasOptions = Object.keys(attributeOptions).length > 0;
  const selectionMap = useMemo(() => new Map(Object.entries(selection)), [selection]);

  return (
    <div className="border-lumi-border/70 space-y-4 rounded-2xl border bg-white/60 p-4 shadow-md backdrop-blur">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-lumi-text-secondary text-[11px] font-semibold uppercase tracking-[0.24em]">
            Variants
          </p>
          {selectedVariant && (
            <p className="text-lumi-text text-[11px] uppercase tracking-[0.2em]">
              {selectedVariant.title}
            </p>
          )}
        </div>
        {onReset && (
          <Button
            variant="ghost"
            size="sm"
            className="text-[11px] uppercase tracking-[0.18em]"
            onClick={onReset}
          >
            Reset
          </Button>
        )}
      </div>

      {!hasOptions && (
        <p className="text-lumi-text-secondary text-[11px] uppercase tracking-[0.18em]">
          No additional options for this item.
        </p>
      )}

      {Object.entries(attributeOptions).map(([attribute, options]) => {
        const isColor = attribute.toLowerCase().includes("color");

        return (
          <div key={attribute} className="space-y-2">
            <div className="flex items-center gap-2">
              {isColor ? (
                <Palette className="text-lumi-text-secondary h-4 w-4" />
              ) : (
                <Shirt className="text-lumi-text-secondary h-4 w-4" />
              )}
              <p className="text-lumi-text-secondary text-[11px] font-semibold uppercase tracking-[0.2em]">
                {attribute}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {options.map((option) =>
                isColor ? (
                  <div key={`${attribute}-${option.value}`} className="flex flex-col items-center">
                    {renderColorChip({
                      option,
                      selected: selectionMap.get(attribute) === option.value,
                      onClick: () => onSelectAttribute(attribute, option.value),
                    })}
                    <span className="text-lumi-text-secondary mt-1 text-[10px] uppercase tracking-[0.16em]">
                      {option.value}
                    </span>
                  </div>
                ) : (
                  <div key={`${attribute}-${option.value}`}>
                    {renderTextChip({
                      label: option.value,
                      selected: selectionMap.get(attribute) === option.value,
                      disabled: !option.available,
                      onClick: () => onSelectAttribute(attribute, option.value),
                    })}
                  </div>
                ),
              )}
            </div>
          </div>
        );
      })}

      {availability === "out_of_stock" && product?.inventoryPolicy === "DENY" && (
        <p className="text-lumi-error text-[11px] uppercase tracking-[0.18em]">
          Selected variant is unavailable.
        </p>
      )}
    </div>
  );
}
