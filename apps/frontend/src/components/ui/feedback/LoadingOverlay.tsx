"use client";

import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

interface LoadingOverlayProps {
  message?: string;
  className?: string;
}

export function LoadingOverlay({
  message = "Yükleniyor...",
  className,
}: LoadingOverlayProps): JSX.Element {
  return (
    <div
      className={cn(
        "bg-lumi-bg/80 text-lumi-text fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 backdrop-blur",
        className,
      )}
      role="status"
      aria-live="assertive"
    >
      <Loader2 className="h-8 w-8 animate-spin" />
      <p className="text-sm font-semibold">{message}</p>
    </div>
  );
}
