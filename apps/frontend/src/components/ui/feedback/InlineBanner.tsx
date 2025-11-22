"use client";

import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface InlineBannerProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  variant?: "info" | "warning" | "success";
}

const variantClasses: Record<NonNullable<InlineBannerProps["variant"]>, string> = {
  info: "bg-lumi-primary/10 border-lumi-primary/30 text-lumi-primary",
  warning: "bg-lumi-warning/10 border-lumi-warning/40 text-lumi-warning",
  success: "bg-lumi-success/10 border-lumi-success/40 text-lumi-success",
};

export function InlineBanner({
  title,
  description,
  icon: Icon,
  variant = "info",
}: InlineBannerProps): JSX.Element {
  return (
    <div
      className={cn(
        "border-lumi-border/60 flex items-start gap-3 rounded-xl border px-3 py-2",
        variantClasses[variant],
      )}
    >
      {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0" />}
      <div className="space-y-0.5">
        <p className="text-sm font-semibold">{title}</p>
        {description && <p className="text-xs">{description}</p>}
      </div>
    </div>
  );
}
