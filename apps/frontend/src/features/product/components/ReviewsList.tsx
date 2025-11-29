"use client";

import { useMemo, useState } from "react";

import { ThumbsDown, ThumbsUp, Verified } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { ProductReview } from "@/features/product/types/review.types";

import { RatingStars } from "./RatingStars";

interface ReviewsListProps {
  reviews: ProductReview[];
  onVote?: (reviewId: string, vote: "up" | "down") => void;
  isVoting?: boolean;
}

const formatRelativeDate = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "1 day ago";
  if (diffDays < 30) return `${diffDays} days ago`;
  const diffMonths = Math.round(diffDays / 30);
  return `${diffMonths} month${diffMonths > 1 ? "s" : ""} ago`;
};

export function ReviewsList({ reviews, onVote, isVoting }: ReviewsListProps): JSX.Element {
  const [visibleCount, setVisibleCount] = useState(3);

  const visibleReviews = useMemo(() => reviews.slice(0, visibleCount), [reviews, visibleCount]);

  if (reviews.length === 0) {
    return (
      <div className="border-lumi-border bg-lumi-bg-secondary/50 rounded-xl border border-dashed p-4 text-center">
        <p className="text-lumi-text-secondary text-[11px] uppercase tracking-[0.2em]">
          No reviews yet — be the first to write one.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {visibleReviews.map((review) => (
        <div
          key={review.id}
          className="border-lumi-border/60 rounded-2xl border bg-white/70 p-4 shadow-sm backdrop-blur"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <Avatar className="border-lumi-border h-10 w-10 border">
                <AvatarImage src={review.avatarUrl} alt={review.userName} />
                <AvatarFallback>{review.userName.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-lumi-text text-[11px] font-semibold uppercase tracking-[0.2em]">
                  {review.userName}
                </p>
                <p className="text-lumi-text-secondary text-[11px] uppercase tracking-[0.18em]">
                  {formatRelativeDate(review.createdAt)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <RatingStars value={review.rating} size="sm" />
              <Badge
                variant="secondary"
                className={cn(
                  "rounded-full text-[10px] uppercase tracking-[0.16em]",
                  review.verified
                    ? "bg-lumi-success/10 text-lumi-success"
                    : "text-lumi-text bg-white",
                )}
              >
                {review.verified ? (
                  <span className="inline-flex items-center gap-1">
                    <Verified className="h-3.5 w-3.5" />
                    Verified
                  </span>
                ) : (
                  "Unverified"
                )}
              </Badge>
            </div>
          </div>

          <Separator className="my-3" />

          <h4 className="text-lumi-text text-sm font-semibold uppercase tracking-[0.18em]">
            {review.title}
          </h4>
          {review.content && (
            <p className="text-lumi-text-secondary mt-2 text-sm leading-6">{review.content}</p>
          )}

          <div className="text-lumi-text-secondary mt-3 flex items-center gap-3 text-[11px] uppercase tracking-[0.18em]">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="inline-flex items-center gap-2"
              onClick={() => onVote?.(review.id, "up")}
              disabled={isVoting}
            >
              <ThumbsUp className="h-4 w-4" />
              Helpful ({review.helpfulCount})
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="inline-flex items-center gap-2"
              onClick={() => onVote?.(review.id, "down")}
              disabled={isVoting}
            >
              <ThumbsDown className="h-4 w-4" />
              Not helpful ({review.notHelpfulCount})
            </Button>
          </div>
        </div>
      ))}

      {visibleCount < reviews.length && (
        <Button
          variant="outline"
          className="w-full rounded-full text-[11px] uppercase tracking-[0.2em]"
          onClick={() => setVisibleCount((count) => count + 3)}
        >
          Load more
        </Button>
      )}
    </div>
  );
}
