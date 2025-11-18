/* eslint-disable sonarjs/no-duplicate-string */
import type { MediaAsset, MediaFolderOption, MediaListFilters } from "../../types/media.types";

const SAMPLE_PRODUCT_ID = "cm2a0b1c2";
const SAMPLE_PUBLIC_ID = "lumi/products/board-001";

const BASE_DELIVERY_URL = "https://res.cloudinary.com/lumi/image/upload";
const VERSIONED_PATH = "v1727704823";

const baseTransformations = {
  original: `${BASE_DELIVERY_URL}/${VERSIONED_PATH}/${SAMPLE_PUBLIC_ID}.jpg`,
  thumbnail: `${BASE_DELIVERY_URL}/c_fill,w_300,h_300/${VERSIONED_PATH}/${SAMPLE_PUBLIC_ID}.jpg`,
  medium: `${BASE_DELIVERY_URL}/c_limit,w_800/${VERSIONED_PATH}/${SAMPLE_PUBLIC_ID}.jpg`,
  large: `${BASE_DELIVERY_URL}/c_limit,w_1920/${VERSIONED_PATH}/${SAMPLE_PUBLIC_ID}.jpg`,
  responsive_640: `${BASE_DELIVERY_URL}/c_limit,w_640/${VERSIONED_PATH}/${SAMPLE_PUBLIC_ID}.jpg`,
};

export const sampleAsset: MediaAsset = {
  id: "cm2x1y2z3",
  publicId: SAMPLE_PUBLIC_ID,
  url: baseTransformations.original,
  secureUrl: baseTransformations.original,
  folder: "lumi/products",
  format: "jpg",
  resourceType: "image",
  type: "upload",
  width: 1920,
  height: 1080,
  bytes: 245_678,
  tags: [`product:${SAMPLE_PRODUCT_ID}`, "hero"],
  metadata: {
    alt: "Carbon desk with walnut legs",
    caption: "Campaign hero",
    dominantColor: "#3B82F6",
  },
  version: 3,
  transformations: { ...baseTransformations },
  createdAt: "2025-09-29T10:01:08.000Z",
  updatedAt: "2025-09-29T10:01:08.000Z",
  usage: {
    products: [{ id: SAMPLE_PRODUCT_ID, title: "Carbon Desk", slug: "carbon-desk" }],
    variants: [{ id: "cm2a0b1v0", productId: SAMPLE_PRODUCT_ID, sku: "CARBON-DESK-STD" }],
  },
  visibility: "public",
};

export const sampleAssets: MediaAsset[] = [
  sampleAsset,
  {
    ...sampleAsset,
    id: "cm2x1y2z4",
    publicId: "lumi/products/chair-001",
    folder: "lumi/products",
    bytes: 185_000,
    tags: ["product:cm2chair01", "lifestyle"],
    metadata: {
      alt: "Minimal chair in oak",
      caption: "Gallery thumbnail",
    },
    transformations: {
      ...baseTransformations,
      original:
        "https://res.cloudinary.com/lumi/image/upload/v1727704823/lumi/products/chair-001.jpg",
      thumbnail:
        "https://res.cloudinary.com/lumi/image/upload/c_fill,w_300,h_300/v1727704823/lumi/products/chair-001.jpg",
      medium:
        "https://res.cloudinary.com/lumi/image/upload/c_limit,w_800/v1727704823/lumi/products/chair-001.jpg",
      large:
        "https://res.cloudinary.com/lumi/image/upload/c_limit,w_1920/v1727704823/lumi/products/chair-001.jpg",
    },
    usage: {
      products: [{ id: "cm2chair01", title: "Sense Chair", slug: "sense-chair" }],
      variants: [],
    },
  },
  {
    ...sampleAsset,
    id: "cm2x1y2z5",
    publicId: "lumi/banners/fall-hero",
    folder: "lumi/banners",
    bytes: 312_000,
    tags: ["campaign:fall-2025", "hero"],
    metadata: {
      alt: "Fall sale hero",
      dominantColor: "#F97316",
    },
    visibility: "internal",
    transformations: {
      ...baseTransformations,
      original:
        "https://res.cloudinary.com/lumi/image/upload/v1727704823/lumi/banners/fall-hero.jpg",
    },
    usage: { products: [], variants: [] },
  },
  {
    ...sampleAsset,
    id: "cm2x1y2z6",
    publicId: "lumi/products/detail-zoom",
    folder: "lumi/products",
    bytes: 99_000,
    tags: [`product:${SAMPLE_PRODUCT_ID}`, "detail"],
    metadata: {
      alt: "Macro shot of surface texture",
    },
    visibility: "private",
    usage: {
      products: [],
      variants: [{ id: "cm2variant02", productId: SAMPLE_PRODUCT_ID, sku: "CARBON-DESK-PRO" }],
    },
  },
];

export const folderOptions: MediaFolderOption[] = [
  { label: "Products", value: "lumi/products", maxSizeMb: 5 },
  { label: "Banners", value: "lumi/banners", maxSizeMb: 10 },
];

export const defaultFilters: MediaListFilters = {
  folder: "lumi/products",
  sortBy: "date",
  sortDirection: "desc",
};
