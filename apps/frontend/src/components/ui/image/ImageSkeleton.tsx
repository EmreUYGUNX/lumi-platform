"use client";

import type { ReactElement } from "react";

interface ImageSkeletonProps {
  width: number;
  height: number;
  borderRadius?: number;
  className?: string;
}

export function ImageSkeleton({
  width,
  height,
  borderRadius = 16,
  className,
}: ImageSkeletonProps): ReactElement {
  return (
    <>
      <div
        className={`lumi-image-skeleton ${className ?? ""}`.trim()}
        style={{
          width,
          height,
          borderRadius,
        }}
        aria-hidden="true"
        role="presentation"
      />
      <style jsx>{`
        .lumi-image-skeleton {
          display: block;
          background: linear-gradient(120deg, #edeff3 0%, #f9fafb 50%, #edeff3 100%);
          background-size: 200% 100%;
          animation: lumiImageSkeletonShimmer 1.6s ease-in-out infinite;
        }

        @keyframes lumiImageSkeletonShimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
      `}</style>
    </>
  );
}
