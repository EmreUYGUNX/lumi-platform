import { env } from "@/lib/env";

const resolvePublicId = (preferred: string, demoFallback: string): string => {
  return env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME === "demo" ? demoFallback : preferred;
};

const PRODUCTS_PATH = "/products" as const;
const ABOUT_PATH = "/about" as const;
const CONTACT_PATH = "/contact" as const;
const FALLBACK_SAMPLE_TWO = "cld-sample-2";
const FALLBACK_SAMPLE_THREE = "cld-sample-3";
const FALLBACK_SAMPLE_FOUR = "cld-sample-4";
const FALLBACK_SAMPLE_FIVE = "cld-sample-5";

export const heroContent = {
  label: "FW25 // LUMI STUDIO",
  title: "PREMIUM MINIMALIST DROP",
  tagline:
    "Glassmorphic silhouettes, wide tracking, and electric cobalt highlights crafted for the new Lumi house codes.",
  backgroundId: resolvePublicId("lumi/banners/fall-hero", FALLBACK_SAMPLE_FIVE),
  primaryCta: { label: "Shop collection", href: { pathname: PRODUCTS_PATH } },
  secondaryCta: { label: "View lookbook", href: { pathname: ABOUT_PATH } },
};

export const primaryCollections = [
  {
    title: "Monolith Outerwear",
    href: { pathname: PRODUCTS_PATH, query: { category: "outerwear" } },
    count: 28,
    imageId: resolvePublicId("lumi/products/board-001", FALLBACK_SAMPLE_THREE),
  },
  {
    title: "Studio Knit Capsule",
    href: { pathname: PRODUCTS_PATH, query: { category: "knitwear" } },
    count: 18,
    imageId: resolvePublicId("lumi/products/chair-001", FALLBACK_SAMPLE_FOUR),
  },
  {
    title: "Modular Layers",
    href: { pathname: PRODUCTS_PATH, query: { category: "layers" } },
    count: 24,
    imageId: resolvePublicId("lumi/products/detail-zoom", FALLBACK_SAMPLE_TWO),
  },
];

export const secondaryCollections = [
  {
    title: "Travel Capsule",
    href: { pathname: PRODUCTS_PATH, query: { category: "travel" } },
    count: 12,
    imageId: resolvePublicId("lumi/products/lookbook-travel", FALLBACK_SAMPLE_TWO),
  },
  {
    title: "Chromatic Essentials",
    href: { pathname: PRODUCTS_PATH, query: { category: "essentials" } },
    count: 16,
    imageId: resolvePublicId("lumi/products/lookbook-essentials", FALLBACK_SAMPLE_THREE),
  },
  {
    title: "Limited Collaborations",
    href: { pathname: PRODUCTS_PATH, query: { category: "collabs" } },
    count: 8,
    imageId: resolvePublicId("lumi/products/collab", "sample"),
  },
];

export const sliderCollections = [
  {
    title: "NOCTURNE",
    href: { pathname: PRODUCTS_PATH, query: { tag: "nocturne" } },
    imageId: resolvePublicId("lumi/banners/nocturne", FALLBACK_SAMPLE_FOUR),
  },
  {
    title: "STUDIO UTILITY",
    href: { pathname: PRODUCTS_PATH, query: { tag: "utility" } },
    imageId: resolvePublicId("lumi/banners/utility", FALLBACK_SAMPLE_THREE),
  },
  {
    title: "CHROMA EDIT",
    href: { pathname: PRODUCTS_PATH, query: { tag: "chroma" } },
    imageId: resolvePublicId("lumi/banners/chroma", FALLBACK_SAMPLE_TWO),
  },
];

export const featureBanners = [
  {
    badge: "New",
    title: "LUMI // CARBON NIGHT DROP",
    ctas: [
      { label: "Shop drop", href: { pathname: PRODUCTS_PATH, query: { tag: "night" } } },
      { label: "Explore story", href: ABOUT_PATH },
    ],
    imageId: resolvePublicId("lumi/banners/night-drop", FALLBACK_SAMPLE_FIVE),
    glass: true,
  },
  {
    badge: "Collaboration",
    title: "LUMI × UPPERGROUND / TECHNICAL EDIT",
    ctas: [
      {
        label: "Discover collab",
        href: { pathname: PRODUCTS_PATH, query: { tag: "collaboration" } },
      },
      { label: "Join waitlist", href: CONTACT_PATH },
    ],
    imageId: resolvePublicId("lumi/banners/collab", FALLBACK_SAMPLE_THREE),
    glass: false,
  },
  {
    badge: "Seasonal",
    title: "WINTER | ARCTIC LAYER PROGRAM",
    ctas: [
      {
        label: "Shop outerwear",
        href: { pathname: PRODUCTS_PATH, query: { category: "outerwear" } },
      },
      { label: "See lookbook", href: ABOUT_PATH },
    ],
    imageId: resolvePublicId("lumi/banners/winter", FALLBACK_SAMPLE_TWO),
    glass: true,
  },
];
