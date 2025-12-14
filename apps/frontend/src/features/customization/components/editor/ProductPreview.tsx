"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type * as fabric from "fabric";
import { Loader2, RefreshCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type {
  PreviewGenerationControls,
  PreviewResolution,
} from "../../hooks/usePreviewGeneration";

type FabricEventName =
  | "object:added"
  | "object:removed"
  | "object:modified"
  | "object:moving"
  | "object:scaling"
  | "object:rotating";

const CANVAS_EVENT_NAMES: readonly FabricEventName[] = [
  "object:added",
  "object:removed",
  "object:modified",
  "object:moving",
  "object:scaling",
  "object:rotating",
];

const THROTTLE_MS = 100;

const useThrottle = (callback: () => void, delayMs: number) => {
  const lastCallAtRef = useRef(0);
  const timeoutRef = useRef<number | undefined>();

  const cancel = useCallback(() => {
    if (timeoutRef.current === undefined) return;
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = undefined;
  }, []);

  const throttled = useCallback(() => {
    const now = Date.now();
    const elapsed = now - lastCallAtRef.current;

    if (elapsed >= delayMs) {
      lastCallAtRef.current = now;
      cancel();
      callback();
      return;
    }

    if (timeoutRef.current !== undefined) return;

    timeoutRef.current = window.setTimeout(
      () => {
        timeoutRef.current = undefined;
        lastCallAtRef.current = Date.now();
        callback();
      },
      Math.max(0, delayMs - elapsed),
    );
  }, [callback, cancel, delayMs]);

  useEffect(() => cancel, [cancel]);

  return useMemo(() => ({ throttled, cancel }), [cancel, throttled]);
};

export interface ProductPreviewDesignAreaOption {
  value: string;
  label?: string;
  productImageUrl?: string;
  canvas?: fabric.Canvas;
}

export interface ProductPreviewProps {
  productId?: string;
  productImageUrl: string;
  designArea: string;
  canvas?: fabric.Canvas;
  designAreas?: ProductPreviewDesignAreaOption[];
  previewControls: PreviewGenerationControls;
  className?: string;
}

const normalizeLabel = (value: string, fallback: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
};

export function ProductPreview({
  productId,
  productImageUrl,
  designArea,
  canvas,
  designAreas,
  previewControls,
  className,
}: ProductPreviewProps): JSX.Element {
  const { previewUrl, isGenerating, error, requestPreview, retry, cancelPending } = previewControls;
  const areas = useMemo(() => {
    const provided = Array.isArray(designAreas) ? designAreas : [];
    if (provided.length === 0) {
      return [
        {
          value: designArea,
          label: designArea,
          productImageUrl,
          canvas,
        },
      ];
    }

    return provided.map((area) => ({
      value: normalizeLabel(area.value, designArea),
      label: normalizeLabel(area.label ?? area.value, area.value),
      productImageUrl: area.productImageUrl ?? productImageUrl,
      canvas: area.canvas ?? canvas,
    }));
  }, [canvas, designArea, designAreas, productImageUrl]);

  const [activeArea, setActiveArea] = useState(() => areas[0]?.value ?? designArea);

  useEffect(() => {
    if (areas.some((area) => area.value === activeArea)) return;
    setActiveArea(areas[0]?.value ?? designArea);
  }, [activeArea, areas, designArea]);

  const activeConfig = useMemo(
    () => areas.find((area) => area.value === activeArea) ?? areas[0],
    [activeArea, areas],
  );

  const activeCanvas = activeConfig?.canvas ?? canvas;
  const activeImageUrl = activeConfig?.productImageUrl ?? productImageUrl;

  const canGenerate = Boolean(productId && activeCanvas);

  const requestDraftPreview = useCallback(() => {
    if (!productId || !activeCanvas) return;
    requestPreview(
      {
        productId,
        designArea: activeArea,
        canvas: activeCanvas,
      },
      "draft",
    );
  }, [activeArea, activeCanvas, productId, requestPreview]);

  const throttle = useThrottle(requestDraftPreview, THROTTLE_MS);

  useEffect(() => {
    if (!activeCanvas || !productId) return () => {};

    const handler = () => throttle.throttled();

    CANVAS_EVENT_NAMES.forEach((eventName) => {
      activeCanvas.on(eventName, handler);
    });

    requestDraftPreview();

    return () => {
      throttle.cancel();
      cancelPending();
      CANVAS_EVENT_NAMES.forEach((eventName) => {
        activeCanvas.off(eventName, handler);
      });
    };
  }, [activeCanvas, cancelPending, productId, requestDraftPreview, throttle]);

  const renderRetryButton = (resolution: PreviewResolution = "draft") => (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      className="h-9 rounded-xl px-4 text-[11px] font-semibold uppercase tracking-[0.18em]"
      onClick={() => retry(resolution)}
      disabled={!canGenerate}
    >
      <RefreshCcw />
      Retry
    </Button>
  );

  return (
    <div
      className={cn(
        "flex h-full flex-col gap-3 rounded-2xl border border-white/10 bg-black/5 p-3",
        className,
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
            Preview
          </p>
          <p className="text-[11px] text-white/50">
            {canGenerate
              ? "Draft preview updates as you edit."
              : "Connect a product to generate previews."}
          </p>
        </div>

        {areas.length > 1 && (
          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/10 p-1">
            {areas.map((area) => {
              const isActive = area.value === activeArea;
              return (
                <button
                  key={area.value}
                  type="button"
                  onClick={() => setActiveArea(area.value)}
                  className={cn(
                    "h-9 rounded-lg px-3 text-[11px] font-semibold uppercase tracking-[0.18em] transition",
                    isActive
                      ? "bg-white/10 text-white"
                      : "text-white/60 hover:bg-white/5 hover:text-white",
                  )}
                >
                  {area.label}
                </button>
              );
            })}
          </div>
        )}
      </header>

      <div className="relative flex-1 overflow-hidden rounded-2xl border border-white/10 bg-black/10">
        {!previewUrl && (
          <Skeleton className="absolute inset-0 h-full w-full rounded-none bg-white/5" />
        )}

        <div className="group absolute inset-0">
          <img
            src={activeImageUrl}
            alt="Product base"
            className={cn(
              "absolute inset-0 h-full w-full object-contain mix-blend-multiply transition-transform duration-500",
              previewUrl ? "opacity-0" : "opacity-100",
              "group-hover:scale-[1.04]",
            )}
            draggable={false}
          />

          {previewUrl && (
            <img
              src={previewUrl}
              alt="Customized product preview"
              className="absolute inset-0 h-full w-full object-contain mix-blend-multiply transition-transform duration-500 group-hover:scale-[1.04]"
              draggable={false}
            />
          )}
        </div>

        {isGenerating && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/45 px-4 text-center">
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-black/40 px-5 py-4">
              <Loader2 className="h-5 w-5 animate-spin text-white/80" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
                Generating preview…
              </p>
              <p className="text-[11px] text-white/50">This updates automatically while editing.</p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/55 px-4 text-center">
            <div className="flex max-w-xs flex-col items-center gap-2 rounded-2xl border border-white/10 bg-black/50 px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
                Preview failed
              </p>
              <p className="text-[11px] text-white/60">{error.message}</p>
              {renderRetryButton()}
            </div>
          </div>
        )}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-white/50">
          {activeArea ? `AREA: ${activeArea.toUpperCase()}` : "AREA"}
        </p>
        {previewUrl && renderRetryButton()}
      </footer>
    </div>
  );
}
