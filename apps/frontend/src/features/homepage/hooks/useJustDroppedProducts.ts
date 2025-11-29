import { useProducts } from "@/features/products/hooks/useProducts";

const JUST_DROPPED_TAG = "just-dropped";
const FIVE_MINUTES_MS = 5 * 60 * 1000;
const PAGE_SIZE = 24;

export const useJustDroppedProducts = () =>
  useProducts(
    {
      tags: [JUST_DROPPED_TAG],
      sort: "newest",
      page: 1,
      pageSize: PAGE_SIZE,
    },
    {
      staleTimeMs: FIVE_MINUTES_MS,
      gcTimeMs: FIVE_MINUTES_MS * 2,
    },
  );
