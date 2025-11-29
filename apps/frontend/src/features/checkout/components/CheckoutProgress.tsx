"use client";

import { CheckCircle2 } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

import type { CheckoutStep } from "../types/checkout.types";

const getStepLabel = (value: CheckoutStep): string => {
  switch (value) {
    case "shipping": {
      return "Shipping";
    }
    case "payment": {
      return "Payment";
    }
    case "review": {
      return "Review";
    }
    default: {
      return "Checkout";
    }
  }
};

interface CheckoutProgressProps {
  step: CheckoutStep;
  progress: number;
  steps: CheckoutStep[];
  onStepChange?: (step: CheckoutStep) => void;
  canNavigateTo: (step: CheckoutStep) => boolean;
}

export function CheckoutProgress({
  step,
  steps,
  progress,
  onStepChange,
  canNavigateTo,
}: CheckoutProgressProps): JSX.Element {
  return (
    <div className="glass-panel border-lumi-border/60 space-y-4 rounded-2xl border bg-white/80 p-5 shadow-sm backdrop-blur">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-lumi-text-secondary text-[10px] font-semibold uppercase tracking-[0.24em]">
            Checkout flow
          </p>
          <h2 className="text-lumi-text text-xl font-semibold uppercase tracking-[0.3em]">
            Multi-step wizard
          </h2>
        </div>
        <div className="text-right">
          <p className="text-lumi-text text-sm font-semibold uppercase tracking-[0.2em]">
            {progress}%
          </p>
          <Progress value={progress} className="mt-1 h-2 w-32" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {steps.map((entry) => {
          const isActive = entry === step;
          const completed =
            steps.indexOf(entry) < steps.indexOf(step) ||
            (steps.indexOf(entry) === steps.indexOf(step) && progress === 100);
          return (
            <button
              key={entry}
              type="button"
              onClick={() => onStepChange?.(entry)}
              disabled={!canNavigateTo(entry)}
              className={cn(
                "border-lumi-border/70 flex items-center justify-between rounded-xl border px-3 py-3 text-left transition",
                isActive && "border-lumi-text shadow-sm",
                completed && "bg-lumi-primary/5 text-lumi-text",
                !isActive && !completed && "text-lumi-text-secondary",
                !canNavigateTo(entry) && "opacity-60",
              )}
              aria-label={`Go to ${getStepLabel(entry)} step`}
            >
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-current">
                  {getStepLabel(entry)}
                </p>
                <p className="text-lumi-text text-sm font-semibold">
                  {steps.indexOf(entry) + 1} / {steps.length}
                </p>
              </div>
              {completed ? (
                <CheckCircle2 className="text-lumi-primary h-5 w-5" />
              ) : (
                <div
                  className={cn(
                    "h-2 w-2 rounded-full",
                    isActive ? "bg-lumi-text" : "bg-lumi-border",
                  )}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
