import type { Metadata } from "next";

import { CatalogPage } from "@/features/catalog/components/CatalogPage";

const title = "Lumi Catalog | Minimalist Grid";
const description =
  "Discover Lumi's curated catalog: uppercase luxury, glassmorphism accents, and Cloudinary-optimized imagery across every drop.";
const url = "https://lumi-commerce.dev/products";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: url },
  openGraph: {
    title,
    description,
    url,
  },
  twitter: {
    card: "summary",
    title,
    description,
  },
};

export default function ProductsPage(): JSX.Element {
  return <CatalogPage />;
}
