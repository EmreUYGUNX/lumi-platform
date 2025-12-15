"use client";

import { Download, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { useBatchDownloadProduction } from "../hooks/useBatchDownloadProduction";

interface BatchDownloadButtonProps {
  orderIds: string[];
  disabled?: boolean;
  className?: string;
}

export function BatchDownloadButton({
  orderIds,
  disabled,
  className,
}: BatchDownloadButtonProps): JSX.Element {
  const download = useBatchDownloadProduction();
  const isDisabled = disabled ?? orderIds.length === 0;

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className={cn("h-9 gap-2 text-[11px] font-semibold uppercase tracking-[0.22em]", className)}
      disabled={isDisabled || download.isPending}
      onClick={() => download.mutate(orderIds)}
    >
      {download.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      Download ZIP
    </Button>
  );
}
