"use client";

import { cn } from "@/lib/utils";

interface InputHintProps {
  id?: string;
  message?: string;
  error?: string;
  maxLength?: number;
  value?: string;
}

export function InputHint({ id, message, error, maxLength, value }: InputHintProps): JSX.Element {
  const count = maxLength && value ? `${value.length}/${maxLength}` : undefined;
  if (!message && !error && !count) return <></>;

  return (
    <div
      id={id}
      className={cn(
        "flex items-center justify-between text-xs",
        error ? "text-lumi-error" : "text-lumi-text-secondary",
      )}
      aria-live={error ? "assertive" : "polite"}
    >
      <span>{error ?? message}</span>
      {count && <span>{count}</span>}
    </div>
  );
}
