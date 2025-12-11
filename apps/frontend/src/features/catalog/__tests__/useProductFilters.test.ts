import { describe, expect, it, beforeEach } from "vitest";

import { useProductFilters } from "../hooks/useProductFilters";

const resetFilters = () => {
  useProductFilters.setState({
    search: "",
    categorySlug: undefined,
    categoryLabel: undefined,
    sort: "featured",
    page: 1,
    pageSize: 24,
    viewMode: "paged",
    priceRange: {},
    attributes: {},
    availability: undefined,
    brands: [],
    rating: undefined,
  });
};

describe("useProductFilters store", () => {
  beforeEach(() => {
    resetFilters();
  });

  it("applies filters and returns a normalized product query", () => {
    const {
      setSearch,
      setCategory,
      setSort,
      setPriceRange,
      toggleAttribute,
      toggleBrand,
      setRating,
      toProductQuery,
    } = useProductFilters.getState();

    setSearch(" <New Lamps> ");
    setCategory("lighting", "Lighting");
    setSort("price_high_low");
    setPriceRange({ min: 100, max: 500 });
    toggleAttribute("Color", "Black");
    toggleAttribute("size", "L");
    toggleBrand("Lumi");
    toggleBrand("Acme");
    setRating(4);

    const query = toProductQuery();

    expect(query.search).toBe("New Lamps");
    expect(query.categorySlug).toBe("lighting");
    expect(query.sort).toBe("price_desc");
    expect(query.priceRange).toEqual({ min: 100, max: 500 });
    expect(query.attributes).toEqual({ color: ["Black"], size: ["L"] });
    expect(query.brands).toEqual(["Acme", "Lumi"]);
    expect(query.rating).toBe(4);
  });

  it("hydrates state from URL parameters and updates view state", () => {
    const params = new URLSearchParams(
      "search=table&category=decor&sort=newest&priceMin=50&priceMax=200&brand=Lumi&brand=Acme&rating=4&availability=in_stock&attr_color=black&attr_material=leather&page=3&pageSize=12&view=infinite",
    );

    useProductFilters.getState().hydrateFromSearchParams(params);

    const state = useProductFilters.getState();
    expect(state.search).toBe("table");
    expect(state.categorySlug).toBe("decor");
    expect(state.sort).toBe("newest");
    expect(state.page).toBe(3);
    expect(state.pageSize).toBe(12);
    expect(state.viewMode).toBe("infinite");
    expect(state.priceRange).toEqual({ min: 50, max: 200 });
    expect(state.availability).toBe("in_stock");
    expect(state.attributes).toEqual({ color: ["black"], material: ["leather"] });
    expect(state.brands).toEqual(["Lumi", "Acme"]);
    expect(state.rating).toBe(4);
  });

  it("resets filters to defaults", () => {
    const { setSearch, toggleBrand, setRating, resetFilters: reset } = useProductFilters.getState();

    setSearch("sneakers");
    toggleBrand("Lumi");
    setRating(5);

    reset();

    const state = useProductFilters.getState();
    expect(state.search).toBe("");
    expect(state.categorySlug).toBeUndefined();
    expect(state.priceRange).toEqual({});
    expect(state.attributes).toEqual({});
    expect(state.brands).toEqual([]);
    expect(state.rating).toBeUndefined();
    expect(state.page).toBe(1);
  });
});
