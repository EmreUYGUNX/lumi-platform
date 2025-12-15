"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Download, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

import { useGenerateProduction } from "../hooks/useGenerateProduction";
import type { ProductionGenerateResult } from "../types/production.types";

interface GenerateProductionButtonProps {
  orderItemId: string;
  force?: boolean;
  disabled?: boolean;
  className?: string;
  onGenerated?: (result: ProductionGenerateResult) => void;
}

export function GenerateProductionButton({
  orderItemId,
  force,
  disabled,
  className,
  onGenerated,
}: GenerateProductionButtonProps): JSX.Element {
  const generate = useGenerateProduction();
  const [progress, setProgress] = useState<number | undefined>();
  const [result, setResult] = useState<ProductionGenerateResult | undefined>();

  const isGenerating = generate.isPending;

  useEffect(() => {
    if (!isGenerating) {
      setProgress(undefined);
      return () => {};
    }

    setProgress(12);
    const intervalId = window.setInterval(() => {
      setProgress((current = 12) => {
        if (current >= 92) return 92;
        const next = current + Math.max(2, Math.round(Math.random() * 10));
        return Math.min(next, 92);
      });
    }, 420);

    return () => window.clearInterval(intervalId);
  }, [isGenerating]);

  const downloadUrl = result?.downloadUrl;
  const canDownload = Boolean(downloadUrl);

  const handleDownload = useCallback(() => {
    if (!downloadUrl) return;
    window.open(downloadUrl, "_blank", "noopener,noreferrer");
  }, [downloadUrl]);

  const label = useMemo(() => {
    if (isGenerating) return "Generating…";
    if (result?.regenerated) return "Regenerate";
    return "Generate";
  }, [isGenerating, result?.regenerated]);

  const handleGenerate = useCallback(async () => {
    setResult(undefined);

    try {
      const generated = await generate.mutateAsync({ orderItemId, force });
      setResult(generated);
      setProgress(100);
      onGenerated?.(generated);
    } catch {
      setProgress(undefined);
    }
  }, [force, generate, onGenerated, orderItemId]);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={disabled || isGenerating}
          onClick={handleGenerate}
          className="h-9 gap-2 text-[11px] font-semibold uppercase tracking-[0.22em]"
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {label}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 gap-2 text-[11px] font-semibold uppercase tracking-[0.22em]"
          disabled={!canDownload}
          onClick={handleDownload}
        >
          <Download className="h-4 w-4" />
          Download
        </Button>
      </div>

      {isGenerating ? <Progress value={progress ?? 24} className="h-2" /> : undefined}
      {generate.isError ? (
        <p className="text-lumi-error text-xs">{generate.error?.message ?? "Generation failed."}</p>
      ) : undefined}
    </div>
  );
}
