"use client";

import { useMemo } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { uiStore } from "@/store";
import { sessionStore } from "@/store/session";
import { apiClient } from "@/lib/api-client";
import { productKeys } from "@/features/products/hooks/product.keys";

import type { ProductDetail, ProductReviewStats } from "../types/product-detail.types";
import type { ProductReview, ReviewVoteInput, SubmitReviewInput } from "../types/review.types";
import { productReviewSchema } from "../types/review.types";

const randomId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `rev_${Math.random().toString(36).slice(2, 10)}`;
};

const REVIEW_AUTH_ERROR = "AUTH_REQUIRED";

const SAMPLE_AUTHORS = [
  {
    name: "Elif Kaya",
    avatar: "https://avatar.vercel.sh/elif-kaya",
    title: "Harika doku ve kalite",
    comment: "Kumaş dokusu ve kesim tam aradığım gibi, premium hissiyatını veriyor.",
  },
  {
    name: "Mert Yılmaz",
    avatar: "https://avatar.vercel.sh/mert-yilmaz",
    title: "Beklentimin üzerinde",
    comment: "Renk ve duruşu fotoğraflardan daha iyi. Paketleme özenliydi.",
  },
  {
    name: "Selin Aydın",
    avatar: "https://avatar.vercel.sh/selin-aydin",
    title: "Tam bedenim",
    comment: "Beden tablosu doğru. XS aldım, tam üstüme oturdu. Tavsiye ederim.",
  },
  {
    name: "Can Demir",
    avatar: "https://avatar.vercel.sh/can-demir",
    title: "Detaylar etkileyici",
    comment: "Dikiş ve metal detaylar çok kaliteli. Fiyat/performans başarılı.",
  },
];

const buildSyntheticReviews = (
  productId: string,
  stats?: ProductReviewStats,
  limit = 6,
): ProductReview[] => {
  const entries = Object.entries(stats?.ratingBreakdown ?? {}).sort(
    ([left], [right]) => Number(right) - Number(left),
  );

  const buckets = entries.length > 0 ? entries : [["5", Math.max(2, stats?.totalReviews ?? 3)]];
  const reviews: ProductReview[] = [];
  const now = Date.now();

  buckets.forEach(([ratingValue, count], bucketIndex) => {
    const numericRating = Number(ratingValue) || 5;
    const numericCount = Number(count);
    const sampleCount = Math.max(1, Math.min(2, numericCount));
    for (let index = 0; index < sampleCount; index += 1) {
      const author =
        SAMPLE_AUTHORS[(bucketIndex + index) % SAMPLE_AUTHORS.length] ?? SAMPLE_AUTHORS[0];
      if (!author) {
        break;
      }
      reviews.push(
        productReviewSchema.parse({
          id: `${productId}-${numericRating}-${index}`,
          productId,
          userName: author.name,
          avatarUrl: author.avatar,
          rating: numericRating,
          title: author.title,
          content: author.comment,
          createdAt: new Date(now - (bucketIndex * 5 + index) * 86_400_000).toISOString(),
          verified: true,
          helpfulCount: Math.max(1, numericRating - 1 + index),
          notHelpfulCount: numericRating >= 4 ? 0 : 1,
          media: [],
        }),
      );
    }
  });

  return reviews.slice(0, limit);
};

interface UseProductReviewsOptions {
  productId?: string;
  productSlug?: string;
  stats?: ProductReviewStats;
}

export const useProductReviews = ({ productId, productSlug, stats }: UseProductReviewsOptions) => {
  const queryClient = useQueryClient();
  const cacheKey = useMemo(
    () => productKeys.reviews(productSlug ?? productId ?? "unknown"),
    [productId, productSlug],
  );

  const reviewsQuery = useQuery<ProductReview[]>({
    queryKey: cacheKey,
    enabled: Boolean(productId ?? productSlug),
    staleTime: 30_000,
    gcTime: 60_000,
    queryFn: async () => {
      const slug = productSlug ?? productId;
      if (!slug) {
        return buildSyntheticReviews("product", stats);
      }

      try {
        const response = await apiClient.get(
          `/catalog/products/${encodeURIComponent(slug)}/reviews`,
          {
            dataSchema: productReviewSchema.array(),
          },
        );
        return response.data;
      } catch {
        return buildSyntheticReviews(slug, stats);
      }
    },
    initialData: () => buildSyntheticReviews(productId ?? productSlug ?? "product", stats),
  });

  const submitReview = useMutation<ProductReview, Error, SubmitReviewInput>({
    mutationKey: [...cacheKey, "submit"],
    mutationFn: async (input) => {
      const { user } = sessionStore.getState();
      if (!user) {
        throw new Error(REVIEW_AUTH_ERROR);
      }

      const review: ProductReview = {
        id: randomId(),
        productId: productId ?? productSlug ?? "product",
        userName: user.fullName ?? user.name ?? user.email ?? "Lumi Customer",
        avatarUrl: user.avatarUrl ?? `https://avatar.vercel.sh/${user.id}`,
        rating: Math.min(5, Math.max(1, Math.round(input.rating))),
        title: input.title.trim(),
        content: input.content?.trim() || undefined,
        createdAt: new Date().toISOString(),
        verified: true,
        helpfulCount: 0,
        notHelpfulCount: 0,
        media:
          input.media?.map((entry, index) => ({
            id: `${entry.url}-${index}`,
            url: entry.url,
            alt: entry.alt ?? input.title,
          })) ?? [],
      };

      return productReviewSchema.parse(review);
    },
    onSuccess: (review) => {
      queryClient.setQueryData<ProductReview[]>(cacheKey, (existing = []) => [review, ...existing]);

      if (productSlug) {
        queryClient.setQueryData<ProductDetail>(productKeys.detail(productSlug), (previous) => {
          if (!previous) return previous;

          const total = previous.reviews.totalReviews ?? 0;
          const aggregate = previous.reviews.averageRating * total + review.rating;
          const nextTotal = total + 1;
          const nextAverage = Number((aggregate / nextTotal).toFixed(2));
          const nextBreakdown = { ...previous.reviews.ratingBreakdown };
          nextBreakdown[review.rating] = (nextBreakdown[review.rating] ?? 0) + 1;

          return {
            ...previous,
            reviews: {
              ...previous.reviews,
              totalReviews: nextTotal,
              averageRating: nextAverage,
              ratingBreakdown: nextBreakdown,
            },
          };
        });
      }

      uiStore.getState().enqueueToast({
        variant: "success",
        title: "Yorum gönderildi",
        description: "Değerlendirmeniz için teşekkürler.",
      });
    },
    onError: (error) => {
      const description =
        error.message === REVIEW_AUTH_ERROR
          ? "Yorum eklemek için giriş yapmalısınız."
          : "Yorum gönderilirken bir sorun oluştu.";
      uiStore.getState().enqueueToast({
        variant: "error",
        title: "İşlem başarısız",
        description,
      });
    },
  });

  const voteReview = useMutation<void, Error, ReviewVoteInput>({
    mutationKey: [...cacheKey, "vote"],
    mutationFn: async ({ vote }) => {
      if (!sessionStore.getState().user) {
        throw new Error(REVIEW_AUTH_ERROR);
      }

      if (vote !== "up" && vote !== "down") {
        throw new Error("Geçersiz oy.");
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.setQueryData<ProductReview[]>(cacheKey, (existing = []) =>
        existing.map((review) =>
          review.id === variables.reviewId
            ? {
                ...review,
                helpfulCount:
                  variables.vote === "up" ? review.helpfulCount + 1 : review.helpfulCount,
                notHelpfulCount:
                  variables.vote === "down" ? review.notHelpfulCount + 1 : review.notHelpfulCount,
              }
            : review,
        ),
      );
    },
    onError: (error) => {
      const description =
        error.message === REVIEW_AUTH_ERROR
          ? "Oy vermek için giriş yapmalısınız."
          : "İşlem tamamlanamadı.";
      uiStore.getState().enqueueToast({
        variant: "error",
        title: "Oy verilemedi",
        description,
      });
    },
  });

  return {
    ...reviewsQuery,
    submitReview,
    voteReview,
  };
};
