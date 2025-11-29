import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

type RatingSize = "sm" | "md" | "lg";

const STAR_SIZE: Record<RatingSize, string> = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5",
};

interface RatingStarsProps {
  value: number;
  outOf?: number;
  size?: RatingSize;
  interactive?: boolean;
  onChange?: (value: number) => void;
  className?: string;
}

export function RatingStars({
  value,
  outOf = 5,
  size = "md",
  interactive = false,
  onChange,
  className,
}: RatingStarsProps): JSX.Element {
  const roundedValue = Math.max(0, Math.min(outOf, value));
  const sizeClass = size === "sm" ? STAR_SIZE.sm : size === "lg" ? STAR_SIZE.lg : STAR_SIZE.md;

  return (
    <div className={cn("text-lumi-text flex items-center gap-1", className)}>
      {Array.from({ length: outOf }).map((_, index) => {
        const ratingValue = index + 1;
        const filled = ratingValue <= roundedValue;

        const star = (
          <Star
            key={`rating-${ratingValue}`}
            className={cn(
              sizeClass,
              filled ? "fill-lumi-text text-lumi-text" : "text-lumi-border",
              interactive && "transition duration-200 hover:scale-110",
            )}
          />
        );

        if (!interactive) {
          return <span key={`rating-${ratingValue}`}>{star}</span>;
        }

        return (
          <button
            key={`rating-${ratingValue}`}
            type="button"
            onClick={() => onChange?.(ratingValue)}
            className="focus-visible:ring-lumi-primary rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            aria-label={`Set rating to ${ratingValue}`}
          >
            {star}
          </button>
        );
      })}
    </div>
  );
}
