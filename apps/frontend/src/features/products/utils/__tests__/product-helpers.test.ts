import { describe, expect, it } from "vitest";

import type { ProductSummary } from "@/features/products/types/product.types";
import {
  deriveProductAvailability,
  getPreferredVariant,
  resolveProductMedia,
} from "@/features/products/utils/product-helpers";

const now = new Date().toISOString();

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
    attributes: {},
    variants: [
      {
        id: "var_primary",
        title: "Black / M",
        sku: "SKU-123-BM",
        price: { amount: "1299.00", currency: "TRY" },
        stock: 5,
        attributes: {},
        weightGrams: 0,
        isPrimary: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
    categories: [],
    media: [],
    createdAt: now,
    updatedAt: now,
    deletedAt: undefined,
    ...overrides,
  }) as ProductSummary;

describe("product-helpers", () => {
  it("derives availability across all variants", () => {
    const product = buildProduct({
      variants: [
        {
          id: "var_low",
          title: "Black / S",
          sku: "SKU-LOW",
          price: { amount: "100.00", currency: "TRY" },
          stock: 2,
          attributes: {},
          weightGrams: 0,
          isPrimary: true,
          createdAt: now,
          updatedAt: now,
        },
      ],
    });

    expect(deriveProductAvailability(product)).toBe("low_stock");

    const outOfStock = buildProduct({
      variants: [
        {
          id: "var_out",
          title: "Black / S",
          sku: "SKU-OUT",
          price: { amount: "100.00", currency: "TRY" },
          stock: 0,
          attributes: {},
          weightGrams: 0,
          isPrimary: true,
          createdAt: now,
          updatedAt: now,
        },
      ],
    });

    expect(deriveProductAvailability(outOfStock)).toBe("out_of_stock");
  });

  it("picks an available variant when primary is out of stock", () => {
    const product = buildProduct({
      variants: [
        {
          id: "var_primary",
          title: "Black / M",
          sku: "SKU-PRIMARY",
          price: { amount: "120.00", currency: "TRY" },
          stock: 0,
          attributes: {},
          weightGrams: 0,
          isPrimary: true,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "var_alt",
          title: "Ivory / L",
          sku: "SKU-ALT",
          price: { amount: "125.00", currency: "TRY" },
          stock: 3,
          attributes: {},
          weightGrams: 0,
          isPrimary: false,
          createdAt: now,
          updatedAt: now,
        },
      ],
    });

    const preferred = getPreferredVariant(product);
    expect(preferred?.id).toBe("var_alt");
  });

  it("resolves media with explicit URL fallback", () => {
    const mediaProduct = buildProduct({
      media: [
        {
          productId: "prod_1",
          mediaId: "med_1",
          sortOrder: 1,
          isPrimary: true,
          media: {
            id: "med_1",
            assetId: "asset_1",
            url: "https://cdn.example.com/image.jpg",
            type: "IMAGE",
            provider: "CLOUDINARY",
            mimeType: "image/jpeg",
            sizeBytes: 1200,
            width: 800,
            height: 1000,
            alt: "Cover",
            caption: "Cover image",
            createdAt: now,
            updatedAt: now,
          },
          createdAt: now,
          updatedAt: now,
        },
      ],
    });

    const media = resolveProductMedia(mediaProduct);
    expect(media.src).toBe("https://cdn.example.com/image.jpg");
    expect(media.alt).toBe("Cover");

    const fallbackMedia = resolveProductMedia(buildProduct());
    expect(fallbackMedia.src.length).toBeGreaterThan(0);
    expect(fallbackMedia.alt).toBe("Lumi Capsule Jacket");
  });
});
