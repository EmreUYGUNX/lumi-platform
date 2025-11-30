"use client";

import { useMemo, useState } from "react";

import { Check } from "lucide-react";

import dynamic from "next/dynamic";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProductReviewStats } from "@/features/product/types/product-detail.types";
import type { ProductReview } from "@/features/product/types/review.types";
import type { ProductSummary } from "@/features/products/types/product.types";

import { ReviewsList } from "./ReviewsList";

interface ProductTabsProps {
  product?: ProductSummary;
  reviewStats?: ProductReviewStats;
  reviews: ProductReview[];
  onSubmitReview: (input: {
    rating: number;
    title: string;
    content: string;
    media?: { url: string }[];
  }) => Promise<void>;
  submittingReview?: boolean;
  onVoteReview?: (reviewId: string, vote: "up" | "down") => void;
  isVoting?: boolean;
}

const deriveFeatures = (product?: ProductSummary): string[] => {
  const attributes = (product?.attributes as Record<string, unknown>) ?? {};
  const raw = attributes.features;

  if (Array.isArray(raw)) {
    return raw.filter((value): value is string => typeof value === "string");
  }

  if (typeof raw === "string") {
    return raw.split(",").map((value) => value.trim());
  }

  return ["Premium fabric", "Glassmorphism-ready aesthetic", "Tailored fit"];
};

const deriveSpecifications = (product?: ProductSummary) => {
  const attributes = (product?.attributes as Record<string, unknown>) ?? {};
  const entries = Object.entries(attributes).filter(
    ([key]) => !["brand", "features", "rating"].includes(key.toLowerCase()),
  );

  if (entries.length === 0) {
    return [
      { label: "Fabric", value: "Organic cotton blend" },
      { label: "Care", value: "Machine wash cold, dry flat" },
      { label: "Origin", value: "Made in Türkiye" },
    ];
  }

  return entries.map(([key, value]) => ({
    label: key,
    value:
      typeof value === "string"
        ? value
        : Array.isArray(value)
          ? value.join(", ")
          : String(value ?? "-"),
  }));
};

const ReviewForm = dynamic(() => import("./ReviewForm").then((mod) => mod.ReviewForm), {
  loading: () => <Skeleton className="h-64 w-full rounded-2xl" />,
});

export function ProductTabs({
  product,
  reviewStats,
  reviews,
  onSubmitReview,
  submittingReview,
  onVoteReview,
  isVoting,
}: ProductTabsProps): JSX.Element {
  const features = deriveFeatures(product);
  const specifications = deriveSpecifications(product);
  const [ratingFilter, setRatingFilter] = useState<number | undefined>();

  const ratingBreakdown = useMemo(() => {
    const breakdownEntries = Object.entries(reviewStats?.ratingBreakdown ?? {}).map(
      ([key, value]) => [Number(key), value] as const,
    );
    return new Map<number, number>(breakdownEntries);
  }, [reviewStats?.ratingBreakdown]);

  const filteredReviews = useMemo(() => {
    if (!ratingFilter) return reviews;
    return reviews.filter((review) => review.rating >= ratingFilter);
  }, [ratingFilter, reviews]);

  const totalReviews = reviewStats?.totalReviews ?? reviews.length;

  return (
    <Tabs defaultValue="description" className="w-full">
      <TabsList className="bg-lumi-bg-secondary grid w-full grid-cols-3 rounded-xl p-1">
        <TabsTrigger
          value="description"
          className="text-[11px] font-semibold uppercase tracking-[0.2em]"
        >
          Description
        </TabsTrigger>
        <TabsTrigger
          value="reviews"
          className="text-[11px] font-semibold uppercase tracking-[0.2em]"
        >
          Reviews ({reviewStats?.totalReviews ?? 0})
        </TabsTrigger>
        <TabsTrigger
          value="shipping"
          className="text-[11px] font-semibold uppercase tracking-[0.2em]"
        >
          Shipping & Returns
        </TabsTrigger>
      </TabsList>

      <TabsContent
        value="description"
        className="border-lumi-border/70 mt-4 space-y-4 rounded-2xl border bg-white/70 p-4 shadow-md backdrop-blur"
      >
        {product?.description ? (
          <p className="text-lumi-text-secondary text-sm leading-7">{product.description}</p>
        ) : (
          <p className="text-lumi-text-secondary text-sm leading-7">
            Crafted with Lumi&apos;s premium minimalist ethos. Expect structured silhouettes,
            elevated textures, and effortless layering potential across seasons.
          </p>
        )}

        <div className="space-y-2">
          <p className="text-lumi-text text-[11px] font-semibold uppercase tracking-[0.2em]">
            Features
          </p>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {features.map((feature) => (
              <li key={feature} className="text-lumi-text flex items-center gap-2 text-sm">
                <Check className="text-lumi-primary h-4 w-4" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2">
          <p className="text-lumi-text text-[11px] font-semibold uppercase tracking-[0.2em]">
            Specifications
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {specifications.map((item) => (
              <div
                key={`${item.label}-${item.value}`}
                className="border-lumi-border/70 bg-lumi-bg-secondary/60 rounded-xl border p-3"
              >
                <p className="text-lumi-text-secondary text-[10px] uppercase tracking-[0.16em]">
                  {item.label}
                </p>
                <p className="text-lumi-text text-sm">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="reviews" className="mt-4 space-y-4">
        <div className="border-lumi-border/70 rounded-2xl border bg-white/70 p-4 shadow-md backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-lumi-text-secondary text-[10px] uppercase tracking-[0.16em]">
                Average Rating
              </p>
              <p className="text-lumi-text text-3xl font-semibold">
                {reviewStats?.averageRating?.toFixed(1) ?? "0.0"}
              </p>
              <p className="text-lumi-text-secondary text-[11px] uppercase tracking-[0.18em]">
                {totalReviews} Reviews
              </p>
            </div>
            <div className="flex flex-1 flex-col gap-2">
              {[5, 4, 3, 2, 1].map((rating) => {
                const count = ratingBreakdown.get(rating) ?? 0;
                const percentage = totalReviews ? Math.round((count / totalReviews) * 100) : 0;
                const active = ratingFilter === rating;
                return (
                  <button
                    key={`rating-${rating}`}
                    type="button"
                    className="flex items-center gap-3"
                    onClick={() => setRatingFilter(active ? undefined : rating)}
                  >
                    <span className="text-lumi-text text-[11px] font-semibold uppercase tracking-[0.16em]">
                      {rating}★
                    </span>
                    <div className="bg-lumi-bg-secondary relative h-2 flex-1 rounded-full">
                      <div
                        className="bg-lumi-primary absolute left-0 top-0 h-full rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-lumi-text-secondary text-[11px] uppercase tracking-[0.14em]">
                      {count}
                    </span>
                    {active && (
                      <span className="text-lumi-primary text-[10px] uppercase tracking-[0.14em]">
                        Filter
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div id="reviews" className="space-y-4">
          <ReviewsList reviews={filteredReviews} onVote={onVoteReview} isVoting={isVoting} />
          <ReviewForm onSubmit={onSubmitReview} isSubmitting={submittingReview} />
        </div>
      </TabsContent>

      <TabsContent value="shipping" className="mt-4">
        <div className="border-lumi-border/70 space-y-3 rounded-2xl border bg-white/70 p-4 shadow-md backdrop-blur">
          <p className="text-lumi-text text-[11px] font-semibold uppercase tracking-[0.2em]">
            Delivery
          </p>
          <p className="text-lumi-text-secondary text-sm">
            Same-day dispatch for orders placed before 14:00. Delivery in 1-3 business days across
            Türkiye with tracked shipping and SMS updates.
          </p>
          <p className="text-lumi-text text-[11px] font-semibold uppercase tracking-[0.2em]">
            Returns
          </p>
          <p className="text-lumi-text-secondary text-sm">
            Free returns within 14 days. Items must be unworn with original tags. Use the prepaid
            label included in your parcel or schedule a pickup.
          </p>
        </div>
      </TabsContent>
    </Tabs>
  );
}
