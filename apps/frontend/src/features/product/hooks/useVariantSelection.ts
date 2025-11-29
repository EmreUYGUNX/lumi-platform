import { useEffect, useMemo, useState } from "react";

import type { Route } from "next";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { ProductSummary } from "@/features/products/types/product.types";

type Variant = ProductSummary["variants"][number];

export type VariantAvailability = "in_stock" | "low_stock" | "out_of_stock";

export interface VariantAttributeOption {
  value: string;
  available: boolean;
  variantIds: string[];
}

export type VariantAttributeOptions = Record<string, VariantAttributeOption[]>;

export type VariantSelection = Record<string, string>;

export interface UseVariantSelectionResult {
  selectedVariant?: Variant;
  selection: VariantSelection;
  availability: VariantAvailability;
  attributeOptions: VariantAttributeOptions;
  selectVariant: (variantId: string) => void;
  selectAttribute: (attribute: string, value: string) => void;
  resetSelection: () => void;
}

const toAvailability = (stock?: number): VariantAvailability => {
  if (!stock || stock <= 0) return "out_of_stock";
  if (stock <= 5) return "low_stock";
  return "in_stock";
};

const toStringValue = (raw: unknown): string | undefined => {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === "string") return raw;
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw);
  return undefined;
};

const addAttributeValue = (map: Map<string, Set<string>>, key: string, candidate: unknown) => {
  const stringValue = toStringValue(candidate);
  if (!stringValue) return;
  const set = map.get(key) ?? new Set<string>();
  set.add(stringValue);
  map.set(key, set);
};

const buildAttributeMap = (attributes: Variant["attributes"]): Map<string, string[]> => {
  const map = new Map<string, Set<string>>();
  if (!attributes || typeof attributes !== "object") {
    return new Map();
  }

  Object.entries(attributes as Record<string, unknown>).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((entry) => addAttributeValue(map, key, entry));
      return;
    }
    addAttributeValue(map, key, value);
  });

  const normalised = new Map<string, string[]>();
  map.forEach((set, key) => {
    normalised.set(key, [...set.values()]);
  });

  return normalised;
};

const mapVariantAttributes = (variant?: Variant): VariantSelection => {
  if (!variant) return {};
  const attrs = buildAttributeMap(variant.attributes);
  const entries: [string, string][] = [];

  attrs.forEach((values, key) => {
    const firstValue = values[0];
    if (typeof firstValue === "string" && firstValue.length > 0) {
      entries.push([key, firstValue]);
    }
  });

  return Object.fromEntries(entries);
};

const findVariantForSelection = (
  variants: Variant[],
  selection: VariantSelection,
): Variant | undefined => {
  return variants.find((variant) => {
    const attrs = buildAttributeMap(variant.attributes);
    return Object.entries(selection).every(([key, value]) => {
      const values = attrs.get(key);
      if (!values || values.length === 0) return false;
      return values.some((entry) => entry.toLowerCase() === value.toLowerCase());
    });
  });
};

const buildAttributeOptions = (variants: Variant[]): VariantAttributeOptions => {
  const map = new Map<string, VariantAttributeOption[]>();

  variants.forEach((variant) => {
    const attrs = buildAttributeMap(variant.attributes);
    const available = toAvailability(variant.stock) !== "out_of_stock";

    attrs.forEach((values, key) => {
      const current = map.get(key) ?? [];
      values.forEach((value) => {
        const existing = current.find((option) => option.value === value);
        if (existing) {
          if (available) {
            existing.available = true;
          }
          existing.variantIds.push(variant.id);
          return;
        }
        current.push({
          value,
          available,
          variantIds: [variant.id],
        });
      });
      map.set(key, current);
    });
  });

  return Object.fromEntries(map.entries());
};

const resolveInitialVariant = (variants: Variant[], requestedId?: string): Variant | undefined => {
  if (variants.length === 0) return undefined;

  const matching = requestedId ? variants.find((variant) => variant.id === requestedId) : undefined;
  if (matching) return matching;

  const primaryAvailable = variants.find((variant) => variant.isPrimary && variant.stock > 0);
  if (primaryAvailable) return primaryAvailable;

  const firstAvailable = variants.find((variant) => variant.stock > 0);
  if (firstAvailable) return firstAvailable;

  return variants[0];
};

export const useVariantSelection = (
  product?: ProductSummary,
  options?: { syncUrl?: boolean },
): UseVariantSelectionResult => {
  const variants = product?.variants ?? [];
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const syncUrl = options?.syncUrl ?? true;

  const requestedVariantId = searchParams?.get("variant") ?? undefined;
  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(
    () => resolveInitialVariant(variants, requestedVariantId)?.id,
  );
  const [selection, setSelection] = useState<VariantSelection>(() =>
    mapVariantAttributes(resolveInitialVariant(variants, requestedVariantId)),
  );

  useEffect(() => {
    const nextVariant = resolveInitialVariant(variants, requestedVariantId);
    setSelectedVariantId(nextVariant?.id);
    setSelection(mapVariantAttributes(nextVariant));
  }, [product?.id, requestedVariantId, variants]);

  const selectedVariant = useMemo(
    () =>
      variants.find((variant) => variant.id === selectedVariantId) ??
      resolveInitialVariant(variants),
    [selectedVariantId, variants],
  );

  const attributeOptions = useMemo(() => buildAttributeOptions(variants), [variants]);

  const availability = useMemo(
    () => toAvailability(selectedVariant?.stock),
    [selectedVariant?.stock],
  );

  const pushVariantToUrl = (variantId: string) => {
    if (!syncUrl || !pathname) return;
    const params = new URLSearchParams(searchParams?.toString());
    params.set("variant", variantId);
    const nextUrl = `${pathname}?${params.toString()}` as Route;
    router.replace(nextUrl, { scroll: false });
  };

  const selectVariant = (variantId: string) => {
    const variant = variants.find((entry) => entry.id === variantId);
    if (!variant) return;

    setSelectedVariantId(variant.id);
    setSelection(mapVariantAttributes(variant));
    pushVariantToUrl(variant.id);
  };

  const selectAttribute = (attribute: string, value: string) => {
    const nextSelection: VariantSelection = {
      ...selection,
      [attribute]: value,
    };

    const variant = findVariantForSelection(variants, nextSelection);
    if (variant) {
      setSelectedVariantId(variant.id);
      pushVariantToUrl(variant.id);
    }
    setSelection(nextSelection);
  };

  const resetSelection = () => {
    const initialVariant = resolveInitialVariant(variants);
    setSelectedVariantId(initialVariant?.id);
    setSelection(mapVariantAttributes(initialVariant));
    if (initialVariant?.id) {
      pushVariantToUrl(initialVariant.id);
    }
  };

  return {
    selectedVariant,
    selection,
    availability,
    attributeOptions,
    selectVariant,
    selectAttribute,
    resetSelection,
  };
};
