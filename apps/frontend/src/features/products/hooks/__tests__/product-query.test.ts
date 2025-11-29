import { describe, expect, it } from "vitest";

import type { ProductListFilters } from "../../types/product.types";
import { buildProductQuery, normalizeProductFilters } from "../product-query";

describe("product-query helpers", () => {
  it("normalizes filters and formats attributes consistently", () => {
    const filters: ProductListFilters = {
      search: "  hoodie ",
      page: 2,
      pageSize: 48,
      priceRange: { min: 199.9, max: 899.123 },
      attributes: {
        size: ["M", "S", "M"],
      },
      brands: ["Lumi", "lumi"],
      rating: 4,
      inventoryAvailability: "in_stock",
    };

    const normalized = normalizeProductFilters(filters);

    expect(normalized.search).toBe("hoodie");
    expect(normalized.page).toBe(2);
    expect(normalized.pageSize).toBe(48);
    expect(normalized.priceRange).toEqual({ min: 199.9, max: 899.123 });
    expect(normalized.attributes?.size).toEqual(["M", "S"]);
    expect(normalized.brands).toEqual(["Lumi", "lumi"]);
    expect(normalized.rating).toBe(4);
    expect(normalized.inventoryAvailability).toBe("in_stock");
  });

  it("builds query params with price strings, attributes, and brands", () => {
    const query = buildProductQuery(
      normalizeProductFilters({
        search: "capsule",
        page: 1,
        pageSize: 24,
        priceRange: { min: 120, max: 560.5 },
        attributes: {
          size: ["L"],
        },
        brands: ["Lumi Atelier"],
        rating: 5,
        inventoryAvailability: "in_stock",
      }),
    );

    expect(query.search).toBe("capsule");
    expect(query.page).toBe(1);
    expect(query.perPage).toBe(24);
    expect(query.priceMin).toBe("120.00");
    expect(query.priceMax).toBe("560.50");
    expect(query.inventoryAvailability).toBe("in_stock");
    expect(typeof query.attributes).toBe("string");

    const attributes = JSON.parse(String(query.attributes));
    expect(attributes.size).toEqual(["L"]);
    expect(attributes.brand).toEqual(["Lumi Atelier"]);
    expect(attributes.rating).toEqual(["5+"]);
  });
});
