/* eslint-disable unicorn/no-null, @typescript-eslint/no-explicit-any */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useProducts } from "@/features/products/hooks/useProducts";
import { apiClient } from "@/lib/api-client";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("TanStack Query hooks", () => {
  it("requests products with normalized filters and hydrates pagination", async () => {
    const mockProduct = {
      id: "cprod_1234567890",
      title: "Lumi Lamp",
      slug: "lumi-lamp",
      sku: null,
      summary: null,
      description: null,
      status: "ACTIVE",
      price: { amount: "1200.00", currency: "TRY" },
      compareAtPrice: null,
      currency: "TRY",
      inventoryPolicy: "TRACK",
      searchKeywords: [],
      attributes: null,
      variants: [],
      categories: [],
      media: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    };

    const getSpy = vi.spyOn(apiClient, "get").mockResolvedValue({
      data: [mockProduct] as any,
      meta: {
        pagination: {
          page: 2,
          pageSize: 1,
          totalItems: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: true,
        },
        cursor: "cursor_token",
      },
    });

    const { result } = renderHook(
      () =>
        useProducts(
          {
            page: 2,
            statuses: ["DRAFT", "ACTIVE"],
            search: "lamp",
          },
          { enabled: true },
        ),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      const first = result.current.data?.items[0];
      expect(first).toBeDefined();
      expect(first?.title).toBe("Lumi Lamp");
    });

    const { data } = result.current;
    expect(data).toBeDefined();
    if (!data) return;

    expect(data.pagination.page).toBe(2);
    expect(data.cursor).toBe("cursor_token");
    expect(getSpy).toHaveBeenCalledWith(
      "/catalog/products",
      expect.objectContaining({
        query: expect.objectContaining({
          search: "lamp",
          page: 2,
          statuses: ["ACTIVE", "DRAFT"],
        }),
      }),
    );
  });

  it("falls back to safe pagination metadata when meta is missing", async () => {
    const product = {
      id: "cprod_missingmeta",
      title: "Fallback Product",
      slug: "fallback-product",
      sku: null,
      summary: null,
      description: null,
      status: "ACTIVE",
      price: { amount: "250.00", currency: "TRY" },
      compareAtPrice: null,
      currency: "TRY",
      inventoryPolicy: "TRACK",
      searchKeywords: [],
      attributes: null,
      variants: [],
      categories: [],
      media: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    };

    const getSpy = vi.spyOn(apiClient, "get").mockResolvedValue({
      data: [product] as any,
      meta: undefined,
    });

    const { result } = renderHook(
      () =>
        useProducts(
          {
            pageSize: 20,
            cursor: "next_cursor",
            statuses: ["ACTIVE", "ACTIVE"],
          },
          { enabled: true },
        ),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      const first = result.current.data?.items[0];
      expect(first).toBeDefined();
      expect(first?.title).toBe("Fallback Product");
    });
    const { data } = result.current;
    expect(data).toBeDefined();
    if (!data) return;

    expect(data.pagination.pageSize).toBe(20);
    expect(data.pagination.totalItems).toBe(0);
    expect(getSpy).toHaveBeenCalledWith(
      "/catalog/products",
      expect.objectContaining({
        query: expect.objectContaining({
          cursor: "next_cursor",
          statuses: ["ACTIVE"],
          perPage: 20,
        }),
      }),
    );
  });

  it("passes category and sorting filters to the API client", async () => {
    const product = {
      id: "cprod_filters",
      title: "Filtered Product",
      slug: "filtered-product",
      sku: null,
      summary: null,
      description: null,
      status: "ACTIVE",
      price: { amount: "120.00", currency: "TRY" },
      compareAtPrice: null,
      currency: "TRY",
      inventoryPolicy: "TRACK",
      searchKeywords: [],
      attributes: null,
      variants: [],
      categories: [],
      media: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    };

    const getSpy = vi.spyOn(apiClient, "get").mockResolvedValue({
      data: [product] as any,
      meta: {
        pagination: {
          page: 1,
          pageSize: 10,
          totalItems: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      },
    });

    const { result } = renderHook(
      () =>
        useProducts({
          categoryId: "cat_123",
          categorySlug: "outerwear",
          sort: "price_desc",
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      const first = result.current.data?.items[0];
      expect(first).toBeDefined();
      expect(first?.title).toBe("Filtered Product");
    });

    const call = getSpy.mock.calls.at(0);
    expect(call).toBeDefined();
    const callOptions = call?.[1];
    expect(callOptions?.query).toMatchObject({
      categoryId: "cat_123",
      categorySlug: "outerwear",
      sort: "price_desc",
    });
  });
});
