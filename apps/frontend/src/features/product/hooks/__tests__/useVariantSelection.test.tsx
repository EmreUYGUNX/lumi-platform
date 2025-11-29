import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProductSummary } from "@/features/products/types/product.types";

import { useVariantSelection } from "../useVariantSelection";

const replaceMock = vi.fn();

vi.mock("next/navigation", () => {
  const params = new URLSearchParams();
  return {
    useRouter: () => ({ replace: replaceMock }),
    useSearchParams: () => params,
    usePathname: () => "/products/test-product",
  };
});

const buildProduct = (overrides: Partial<ProductSummary> = {}): ProductSummary =>
  ({
    id: "prod_1",
    title: "Lumi Capsule Jacket",
    slug: "lumi-capsule-jacket",
    sku: "SKU-123",
    summary: "Lightweight premium jacket.",
    description: "Minimal silhouette with premium fabrics.",
    status: "ACTIVE",
    price: { amount: "1299.00", currency: "TRY" },
    currency: "TRY",
    inventoryPolicy: "DENY",
    searchKeywords: [],
    attributes: { color: ["Black", "Ivory"], size: ["M", "L"] },
    variants: [
      {
        id: "var_primary",
        title: "Black / M",
        sku: "SKU-123-BM",
        price: { amount: "1299.00", currency: "TRY" },
        stock: 4,
        attributes: { color: "Black", size: "M" },
        weightGrams: undefined,
        isPrimary: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "var_second",
        title: "Ivory / L",
        sku: "SKU-123-IL",
        price: { amount: "1349.00", currency: "TRY" },
        stock: 2,
        attributes: { color: "Ivory", size: "M" },
        weightGrams: undefined,
        isPrimary: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    categories: [],
    media: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: new Date().toISOString(),
    ...overrides,
  }) as ProductSummary;

describe("useVariantSelection", () => {
  beforeEach(() => {
    replaceMock.mockClear();
  });

  it("selects primary available variant and syncs selection", () => {
    const product = buildProduct();
    const { result } = renderHook(() => useVariantSelection(product));

    expect(result.current.selectedVariant?.id).toBe("var_primary");
    expect(result.current.selection.color).toBe("Black");

    act(() => {
      result.current.selectAttribute("color", "Ivory");
    });

    expect(result.current.selectedVariant?.id).toBe("var_second");
    expect(result.current.selection.color).toBe("Ivory");
    expect(replaceMock).toHaveBeenCalled();
  });

  it("reports out of stock when no inventory is available", () => {
    const product = buildProduct({
      variants: [
        {
          id: "var_out",
          title: "Black / M",
          sku: "SKU-123",
          price: { amount: "1299.00", currency: "TRY" },
          stock: 0,
          attributes: { color: "Black", size: "M" },
          weightGrams: 0,
          isPrimary: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });

    const { result } = renderHook(() => useVariantSelection(product));
    expect(result.current.availability).toBe("out_of_stock");
  });
});
