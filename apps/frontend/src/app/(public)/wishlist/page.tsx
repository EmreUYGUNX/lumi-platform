import type { Metadata } from "next";

import { WishlistPage } from "@/features/wishlist/components/WishlistPage";

const title = "Wishlist | Lumi Commerce";
const description =
  "Kaydettiğin ürünlere hızlıca geri dön, stok durumunu takip et ve tek dokunuşla sepete ekle.";
const url = "https://lumi-commerce.dev/wishlist";

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

export default function WishlistRoute(): JSX.Element {
  return <WishlistPage />;
}
