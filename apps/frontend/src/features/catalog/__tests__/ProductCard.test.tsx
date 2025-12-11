/* eslint-disable unicorn/no-null */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import type { ProductSummary } from "@/features/products/types/product.types";
import { formatMoney } from "@/lib/formatters/price";

import { ProductCard } from "../components/ProductCard";

const addToCartMutate = vi.fn();
const addToWishlistMutate = vi.fn();
const ids = {
  product: "c000000000000000000000001",
  variant: "c000000000000000000000002",
  category: "c000000000000000000000003",
  media: "c000000000000000000000004",
};

vi.mock("@/features/cart/hooks/useAddToCart", () => ({
  useAddToCart: () => ({
    mutate: addToCartMutate,
    isPending: false,
  }),
}));

vi.mock("@/features/wishlist/hooks/useAddToWishlist", () => ({
  useAddToWishlist: () => ({
    mutate: addToWishlistMutate,
    isPending: false,
  }),
}));

const buildProduct = (overrides?: Partial<ProductSummary>): ProductSummary => {
  const timestamp = new Date("2024-01-02T12:00:00.000Z").toISOString();
  const price = { amount: "1200.00", currency: "TRY" } as const;
  const compareAt = { amount: "1500.00", currency: "TRY" } as const;

  return {
    id: ids.product,
    title: "Lumi Jacket",
    slug: "lumi-jacket",
    sku: "LUMI-JACKET",
    summary: "Statement outerwear",
    description: "Technical shell",
    status: "ACTIVE",
    price,
    compareAtPrice: compareAt,
    currency: "TRY",
    inventoryPolicy: "TRACK",
    searchKeywords: ["lumi", "jacket"],
    attributes: null,
    variants: [
      {
        id: ids.variant,
        title: "Default",
        sku: "SKU-PRIMARY",
        price,
        compareAtPrice: compareAt,
        stock: 8,
        attributes: null,
        weightGrams: null,
        isPrimary: true,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    categories: [
      {
        id: ids.category,
        name: "Outerwear",
        slug: "outerwear",
        description: null,
        parentId: null,
        level: 0,
        path: "outerwear",
        imageUrl: null,
        iconUrl: null,
        displayOrder: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    media: [
      {
        productId: ids.product,
        mediaId: ids.media,
        sortOrder: 1,
        isPrimary: true,
        media: {
          id: ids.media,
          assetId: "asset_123",
          url: "https://cdn.lumi.test/media/lumi-jacket.jpg",
          type: "IMAGE",
          provider: "CLOUDINARY",
          mimeType: "image/jpeg",
          sizeBytes: 1024,
          width: 1200,
          height: 1600,
          alt: "Lumi Jacket",
          caption: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
    ...overrides,
  };
};

describe("ProductCard component", () => {
  beforeEach(() => {
    addToCartMutate.mockClear();
    addToWishlistMutate.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders product information with formatted pricing", () => {
    const product = buildProduct();

    render(<ProductCard product={product} priority />);

    expect(screen.getByText(product.title)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: `View ${product.title}` })).not.toHaveLength(0);
    expect(screen.getByText(formatMoney(product.price))).toBeInTheDocument();
    expect(screen.getByText(formatMoney(product.compareAtPrice))).toBeInTheDocument();
  });

  it("shows a discount badge when the product is on sale", () => {
    const product = buildProduct();

    render(<ProductCard product={product} />);

    expect(screen.getByText("-20%")).toBeInTheDocument();
  });

  it("handles quick add and wishlist interactions", async () => {
    const user = userEvent.setup();
    const product = buildProduct();

    render(<ProductCard product={product} />);

    await user.click(screen.getByRole("button", { name: "Quick Add" }));
    expect(addToCartMutate).toHaveBeenCalledTimes(1);
    expect(addToCartMutate).toHaveBeenCalledWith({
      productVariantId: ids.variant,
      quantity: 1,
      product,
      variant: product.variants[0],
    });

    await user.click(screen.getByLabelText("Add to wishlist"));
    expect(addToWishlistMutate).toHaveBeenCalledTimes(1);
    expect(addToWishlistMutate).toHaveBeenCalledWith({
      productId: product.id,
      product,
    });
  });
});
