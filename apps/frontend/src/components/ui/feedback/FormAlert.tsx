"use client";

import type { ElementType } from "react";
import { useState } from "react";

import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Variant = "success" | "error" | "warning" | "info";

const getIconForVariant = (variant: Variant): ElementType => {
  switch (variant) {
    case "success": {
      return CheckCircle2;
    }
    case "error": {
      return AlertCircle;
    }
    case "warning": {
      return TriangleAlert;
    }
    default: {
      return Info;
    }
  }
};

interface FormAlertProps {
  title: string;
  description?: string;
  variant?: Variant;
  dismissible?: boolean;
  className?: string;
}

export function FormAlert({
  title,
  description,
  variant = "info",
  dismissible = false,
  className,
}: FormAlertProps): JSX.Element {
  const [open, setOpen] = useState(true);
  if (!open) return <></>;

  const Icon = getIconForVariant(variant);

  return (
    <Alert
      className={cn("animate-in fade-in slide-in-from-top-1", className)}
      variant={variant === "error" ? "destructive" : "default"}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4" />
        <div className="space-y-1">
          <AlertTitle>{title}</AlertTitle>
          {description && <AlertDescription>{description}</AlertDescription>}
        </div>
        {dismissible && (
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto"
            onClick={() => setOpen(false)}
            aria-label="Dismiss notification"
          >
            ×
          </Button>
        )}
      </div>
    </Alert>
  );
}
