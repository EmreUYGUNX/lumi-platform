/* eslint-disable unicorn/no-null */
import { describe, expect, it } from "vitest";

import type {
  ProductDetail,
  ProductReviewStats,
} from "@/features/product/types/product-detail.types";

import {
  buildBreadcrumbSchema,
  buildOrganizationSchema,
  buildProductSchema,
  buildSearchActionSchema,
  buildWebSiteSchema,
} from "../schema";

const baseTimestamp = "2025-01-01T00:00:00.000Z";

const buildProduct = (): ProductDetail["product"] => ({
  id: "prod_123",
  title: "Midnight Hoodie",
  slug: "midnight-hoodie",
  sku: "LUMI-001",
  summary: "Premium minimalist hoodie with glassmorphism accents.",
  description: "A premium cotton hoodie optimized for Cloudinary delivery and luxury feel.",
  status: "ACTIVE",
  price: { amount: "149.00", currency: "USD" },
  compareAtPrice: { amount: "179.00", currency: "USD" },
  currency: "USD",
  inventoryPolicy: "TRACK",
  searchKeywords: ["hoodie", "lumi", "outerwear"],
  attributes: { brand: "Lumi", color: ["Black"], material: "Cotton" },
  variants: [
    {
      id: "var_1",
      title: "Standard",
      sku: "LUMI-001-STD",
      price: { amount: "149.00", currency: "USD" },
      compareAtPrice: { amount: "179.00", currency: "USD" },
      stock: 8,
      attributes: { size: "M" },
      weightGrams: 500,
      isPrimary: true,
      createdAt: baseTimestamp,
      updatedAt: baseTimestamp,
    },
  ],
  categories: [
    {
      id: "cat_1",
      name: "Outerwear",
      slug: "outerwear",
      description: "Layered looks",
      parentId: null,
      level: 1,
      path: "/outerwear",
      imageUrl: null,
      iconUrl: null,
      displayOrder: 1,
      createdAt: baseTimestamp,
      updatedAt: baseTimestamp,
    },
  ],
  media: [
    {
      productId: "prod_123",
      mediaId: "media_1",
      sortOrder: 1,
      isPrimary: true,
      media: {
        id: "media_1",
        assetId: "hero_1",
        url: "https://res.cloudinary.com/demo/image/upload/v1/lumi/hoodie.jpg",
        type: "IMAGE",
        provider: "CLOUDINARY",
        mimeType: "image/jpeg",
        sizeBytes: 125_000,
        width: 1200,
        height: 1500,
        alt: "Black hoodie",
        caption: null,
        createdAt: baseTimestamp,
        updatedAt: baseTimestamp,
      },
      createdAt: baseTimestamp,
      updatedAt: baseTimestamp,
    },
  ],
  createdAt: baseTimestamp,
  updatedAt: baseTimestamp,
  deletedAt: null,
});

describe("schema builders", () => {
  it("builds a valid product schema with offers and rating", () => {
    const product = buildProduct();
    const reviews: ProductReviewStats = {
      totalReviews: 12,
      averageRating: 4.4,
      ratingBreakdown: { 5: 8, 4: 3, 3: 1 } as Record<number, number>,
    };

    const schema = buildProductSchema({ product, reviews });

    expect(schema["@context"]).toBe("https://schema.org");
    expect(schema["@type"]).toBe("Product");
    expect(schema).toHaveProperty("offers");
    expect(schema).toHaveProperty("image");

    const { offers } = schema as {
      offers: { price: string; priceCurrency: string; availability: string };
      aggregateRating?: { ratingValue: number; reviewCount: number };
    };
    expect(offers.price).toBe(product.price.amount);
    expect(offers.priceCurrency).toBe(product.price.currency);
    expect(offers.availability).toBe("https://schema.org/InStock");

    const { aggregateRating } = schema as {
      aggregateRating?: { ratingValue: number; reviewCount: number };
    };
    expect(aggregateRating?.ratingValue).toBeCloseTo(4.4);
    expect(aggregateRating?.reviewCount).toBe(12);
  });

  it("builds breadcrumb schema with sequential positions", () => {
    const schema = buildBreadcrumbSchema([
      { name: "Home", url: "/" },
      { name: "Products", url: "/products" },
      { name: "Midnight Hoodie", url: "/products/midnight-hoodie" },
    ]);

    expect(schema["@type"]).toBe("BreadcrumbList");
    const { itemListElement } = schema as {
      "@type": string;
      itemListElement: { position: number; item: string }[];
    };
    expect(itemListElement).toHaveLength(3);
    expect(itemListElement[2]!.position).toBe(3);
    expect(itemListElement[2]!.item).toContain("/products/midnight-hoodie");
  });

  it("builds organization and website schemas with search action", () => {
    const orgSchema = buildOrganizationSchema("https://res.cloudinary.com/demo/logo.png");
    expect(orgSchema["@type"]).toBe("Organization");
    expect(orgSchema.logo).toContain("logo.png");

    const searchAction = buildSearchActionSchema();
    expect(searchAction["@type"]).toBe("SearchAction");
    expect(searchAction.target).toContain("/search?q=");

    const websiteSchema = buildWebSiteSchema();
    expect(websiteSchema["@type"]).toBe("WebSite");
    expect(websiteSchema.potentialAction).toMatchObject(searchAction);
  });
});
