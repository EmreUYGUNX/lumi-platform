"use client";

import { ShoppingBag } from "lucide-react";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const suggestions = ["Monolith Bomber", "Studio Knit", "Arctic Layer"];

interface CartEmptyProps {
  compact?: boolean;
  className?: string;
}

export function CartEmpty({ compact = false, className }: CartEmptyProps): JSX.Element {
  return (
    <div
      className={cn(
        "border-lumi-border/70 bg-lumi-bg-secondary/80 glass-panel flex flex-col items-center justify-center gap-4 rounded-2xl border p-6 text-center shadow-lg",
        compact ? "py-6" : "py-10",
        className,
      )}
    >
      <div className="bg-lumi-primary/10 text-lumi-primary flex h-12 w-12 items-center justify-center rounded-full shadow-inner">
        <ShoppingBag className="h-6 w-6" />
      </div>
      <div className="space-y-2">
        <p className="text-lumi-text text-sm font-semibold uppercase tracking-[0.28em]">
          Your cart is empty
        </p>
        <p className="text-lumi-text-secondary text-[11px] uppercase tracking-[0.18em]">
          Add your first piece to unlock the Lumi checkout flow.
        </p>
      </div>
      <Button
        asChild
        size={compact ? "sm" : "lg"}
        className="bg-lumi-text hover:bg-lumi-text/90 rounded-full uppercase tracking-[0.22em] text-white"
      >
        <Link href="/products">Browse products</Link>
      </Button>
      <div className="text-lumi-text-secondary mt-2 flex flex-wrap justify-center gap-2 text-[10px] uppercase tracking-[0.16em]">
        <span className="text-lumi-text">Recently viewed</span>
        {suggestions.map((item) => (
          <span
            key={item}
            className="border-lumi-border/80 text-lumi-text rounded-full border bg-white/70 px-3 py-1 shadow-sm"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
