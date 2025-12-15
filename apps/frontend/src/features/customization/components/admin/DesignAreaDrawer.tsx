"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { DesignAreaDTO } from "../../types/product-customization.types";

type ResizeHandle = "nw" | "ne" | "sw" | "se";

interface Point {
  x: number;
  y: number;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface InteractionState {
  type: "drawing" | "moving" | "resizing";
  pointerId: number;
  startPoint: Point;
  areaName?: string;
  handle?: ResizeHandle;
  initialArea?: DesignAreaDTO;
  anchor?: Point;
  draftRect?: Rect;
}

const MIN_AREA_SIZE_PX = 24;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const normalizeRect = (start: Point, end: Point): Rect => {
  const left = Math.min(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const right = Math.max(start.x, end.x);
  const bottom = Math.max(start.y, end.y);

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
};

const roundPx = (value: number) => Math.round(value);

const clampRectToBounds = (rect: Rect, bounds: { width: number; height: number }): Rect => {
  const minWidth = Math.min(MIN_AREA_SIZE_PX, bounds.width);
  const minHeight = Math.min(MIN_AREA_SIZE_PX, bounds.height);

  const width = clamp(rect.width, minWidth, bounds.width);
  const height = clamp(rect.height, minHeight, bounds.height);

  const x = clamp(rect.x, 0, Math.max(0, bounds.width - width));
  const y = clamp(rect.y, 0, Math.max(0, bounds.height - height));

  return { x, y, width, height };
};

const toPercent = (value: number, total: number) => `${(value / total) * 100}%`;

const resolveAnchor = (area: DesignAreaDTO, handle: ResizeHandle): Point => {
  const { x, y, width, height } = area;

  if (handle === "nw") {
    return { x: x + width, y: y + height };
  }

  if (handle === "ne") {
    return { x, y: y + height };
  }

  if (handle === "sw") {
    return { x: x + width, y };
  }

  return { x, y };
};

const updateAreaAtIndex = (
  areas: readonly DesignAreaDTO[],
  index: number,
  nextArea: DesignAreaDTO,
) => {
  const updated = [...areas];
  updated[index] = nextArea;
  return updated;
};

const computeMovedArea = (
  initial: DesignAreaDTO,
  startPoint: Point,
  currentPoint: Point,
  bounds: { width: number; height: number },
): DesignAreaDTO => {
  const deltaX = currentPoint.x - startPoint.x;
  const deltaY = currentPoint.y - startPoint.y;

  const nextX = clamp(roundPx(initial.x + deltaX), 0, Math.max(0, bounds.width - initial.width));
  const nextY = clamp(roundPx(initial.y + deltaY), 0, Math.max(0, bounds.height - initial.height));

  return {
    ...initial,
    x: nextX,
    y: nextY,
  };
};

const applyAspectRatio = (rect: Rect, aspectRatio: number, anchor: Point, pointer: Point): Rect => {
  if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) {
    return rect;
  }

  const clamped = { ...rect };
  const currentRatio = clamped.width > 0 && clamped.height > 0 ? clamped.width / clamped.height : 0;

  if (!Number.isFinite(currentRatio) || currentRatio === 0) {
    return clamped;
  }

  if (currentRatio > aspectRatio) {
    clamped.width = clamped.height * aspectRatio;
  } else {
    clamped.height = clamped.width / aspectRatio;
  }

  const nextX = pointer.x < anchor.x ? anchor.x - clamped.width : anchor.x;
  const nextY = pointer.y < anchor.y ? anchor.y - clamped.height : anchor.y;
  clamped.x = nextX;
  clamped.y = nextY;

  return clamped;
};

const computeResizedArea = (
  initial: DesignAreaDTO,
  anchor: Point,
  currentPoint: Point,
  bounds: { width: number; height: number },
): DesignAreaDTO => {
  const baseRect = normalizeRect(anchor, currentPoint);
  const ratio = initial.aspectRatio;
  const nextRect = ratio ? applyAspectRatio(baseRect, ratio, anchor, currentPoint) : baseRect;
  const clamped = clampRectToBounds(nextRect, bounds);

  return {
    ...initial,
    x: roundPx(clamped.x),
    y: roundPx(clamped.y),
    width: roundPx(clamped.width),
    height: roundPx(clamped.height),
  };
};

const buildDefaultArea = (name: string, rect: Rect): DesignAreaDTO => {
  const safeWidth = Math.max(rect.width, MIN_AREA_SIZE_PX);
  const safeHeight = Math.max(rect.height, MIN_AREA_SIZE_PX);
  const minDesignSize = Math.max(1, Math.min(48, safeWidth, safeHeight));

  return {
    name,
    x: rect.x,
    y: rect.y,
    width: safeWidth,
    height: safeHeight,
    rotation: 0,
    minDesignSize,
    maxDesignSize: Math.max(safeWidth, safeHeight),
    allowResize: true,
    allowRotation: true,
  };
};

let fallbackAreaIdCounter = 0;

const createAreaIdFragment = () => {
  const { crypto } = globalThis;

  if (typeof crypto?.randomUUID === "function") {
    return crypto.randomUUID().replaceAll("-", "");
  }

  if (typeof crypto?.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  fallbackAreaIdCounter += 1;
  return `${Date.now().toString(16)}${fallbackAreaIdCounter.toString(16)}`;
};

const createUniqueAreaName = (areas: readonly DesignAreaDTO[]) => {
  const used = new Set(areas.map((area) => area.name.trim().toLowerCase()));

  for (let index = 1; index < 10_000; index += 1) {
    const candidate = `area-${index}`;
    if (!used.has(candidate)) {
      return candidate;
    }
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const fragment = createAreaIdFragment();
    const candidate = `area-${fragment.slice(0, 8)}`;
    if (!used.has(candidate)) {
      return candidate;
    }
  }

  fallbackAreaIdCounter += 1;
  return `area-${Date.now().toString(16)}${fallbackAreaIdCounter.toString(16)}`;
};

const formatRectLabel = (area: DesignAreaDTO) => {
  const x = roundPx(area.x);
  const y = roundPx(area.y);
  const width = roundPx(area.width);
  const height = roundPx(area.height);
  return `${x},${y} • ${width}×${height}`;
};

export interface DesignAreaDrawerProps {
  productImage: string;
  existingAreas: DesignAreaDTO[];
  onAreasChange: (areas: DesignAreaDTO[]) => void;
  selectedAreaName?: string;
  onSelectedAreaNameChange?: (areaName?: string) => void;
  previewMode?: boolean;
  imageWidth?: number | null;
  imageHeight?: number | null;
  className?: string;
}

export function DesignAreaDrawer({
  productImage,
  existingAreas,
  onAreasChange,
  selectedAreaName,
  onSelectedAreaNameChange,
  previewMode = false,
  imageWidth,
  imageHeight,
  className,
}: DesignAreaDrawerProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const areasRef = useRef(existingAreas);
  const selectionRef = useRef(selectedAreaName);

  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | undefined>();
  const [interaction, setInteraction] = useState<InteractionState | undefined>();

  useEffect(() => {
    areasRef.current = existingAreas;
  }, [existingAreas]);

  useEffect(() => {
    selectionRef.current = selectedAreaName;
  }, [selectedAreaName]);

  const bounds = useMemo(() => {
    let resolved: { width: number; height: number } | undefined;
    const width =
      typeof imageWidth === "number" && imageWidth > 0 ? imageWidth : naturalSize?.width;
    const height =
      typeof imageHeight === "number" && imageHeight > 0 ? imageHeight : naturalSize?.height;

    if (width && height) {
      resolved = { width, height };
    }

    return resolved;
  }, [imageHeight, imageWidth, naturalSize]);

  const toImagePoint = (event: PointerEvent | React.PointerEvent): Point | undefined => {
    let point: Point | undefined;

    const container = containerRef.current;
    if (container && bounds) {
      const rect = container.getBoundingClientRect();
      if (rect.width && rect.height) {
        const relativeX = clamp(event.clientX - rect.left, 0, rect.width);
        const relativeY = clamp(event.clientY - rect.top, 0, rect.height);

        point = {
          x: roundPx((relativeX / rect.width) * bounds.width),
          y: roundPx((relativeY / rect.height) * bounds.height),
        };
      }
    }

    return point;
  };

  const handlePointerDown = (event: React.PointerEvent) => {
    if (previewMode) {
      return;
    }

    if (!bounds) {
      return;
    }

    if (event.button !== 0) {
      return;
    }

    const start = toImagePoint(event);
    if (!start) {
      return;
    }

    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    setInteraction({
      type: "drawing",
      pointerId: event.pointerId,
      startPoint: start,
      draftRect: { x: start.x, y: start.y, width: 0, height: 0 },
    });
    onSelectedAreaNameChange?.();
  };

  const startMove = (event: React.PointerEvent, area: DesignAreaDTO) => {
    if (previewMode || !bounds) {
      return;
    }

    if (event.button !== 0) {
      return;
    }

    const start = toImagePoint(event);
    if (!start) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    setInteraction({
      type: "moving",
      pointerId: event.pointerId,
      startPoint: start,
      areaName: area.name,
      initialArea: area,
    });
  };

  const startResize = (event: React.PointerEvent, area: DesignAreaDTO, handle: ResizeHandle) => {
    if (previewMode || !bounds || !area.allowResize) {
      return;
    }

    if (event.button !== 0) {
      return;
    }

    const start = toImagePoint(event);
    if (!start) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    setInteraction({
      type: "resizing",
      pointerId: event.pointerId,
      startPoint: start,
      areaName: area.name,
      handle,
      initialArea: area,
      anchor: resolveAnchor(area, handle),
    });
  };

  const deleteArea = (areaName: string) => {
    const nextAreas = areasRef.current.filter((area) => area.name !== areaName);
    onAreasChange(nextAreas);
    if (selectionRef.current === areaName) {
      onSelectedAreaNameChange?.(nextAreas[0]?.name);
    }
  };

  const handleGlobalPointerMove = useCallback(
    (event: PointerEvent) => {
      if (!interaction || !bounds) {
        return;
      }

      if (event.pointerId !== interaction.pointerId) {
        return;
      }

      const currentPoint = toImagePoint(event);
      if (!currentPoint) {
        return;
      }

      const { type, areaName, initialArea, startPoint, anchor } = interaction;

      if (type === "drawing") {
        const draftRect = clampRectToBounds(normalizeRect(startPoint, currentPoint), bounds);
        setInteraction((currentState) => {
          if (currentState?.type !== "drawing") {
            return currentState;
          }
          return { ...currentState, draftRect };
        });
        return;
      }

      if (!areaName || !initialArea) {
        return;
      }

      const currentAreas = areasRef.current;
      const index = currentAreas.findIndex((area) => area.name === areaName);
      if (index < 0) {
        return;
      }

      if (type === "moving") {
        const updatedArea = computeMovedArea(initialArea, startPoint, currentPoint, bounds);
        onAreasChange(updateAreaAtIndex(currentAreas, index, updatedArea));
        return;
      }

      if (type === "resizing" && anchor) {
        const updatedArea = computeResizedArea(initialArea, anchor, currentPoint, bounds);
        onAreasChange(updateAreaAtIndex(currentAreas, index, updatedArea));
      }
    },
    [bounds, interaction, onAreasChange],
  );

  const handleGlobalPointerUp = useCallback(
    (event: PointerEvent) => {
      if (!interaction || !bounds) {
        return;
      }

      if (event.pointerId !== interaction.pointerId) {
        return;
      }

      if (interaction.type === "drawing") {
        const draft = interaction.draftRect;
        if (draft && draft.width >= MIN_AREA_SIZE_PX && draft.height >= MIN_AREA_SIZE_PX) {
          const name = createUniqueAreaName(areasRef.current);
          const clamped = clampRectToBounds(draft, bounds);
          const nextArea = buildDefaultArea(name, {
            x: roundPx(clamped.x),
            y: roundPx(clamped.y),
            width: roundPx(clamped.width),
            height: roundPx(clamped.height),
          });

          onAreasChange([...areasRef.current, nextArea]);
          onSelectedAreaNameChange?.(nextArea.name);
        }
      }

      setInteraction(undefined);
    },
    [bounds, interaction, onAreasChange, onSelectedAreaNameChange],
  );

  useEffect(() => {
    if (!interaction || !bounds) {
      return () => {};
    }

    window.addEventListener("pointermove", handleGlobalPointerMove);
    window.addEventListener("pointerup", handleGlobalPointerUp);

    return () => {
      window.removeEventListener("pointermove", handleGlobalPointerMove);
      window.removeEventListener("pointerup", handleGlobalPointerUp);
    };
  }, [bounds, handleGlobalPointerMove, handleGlobalPointerUp, interaction]);

  const renderArea = (area: DesignAreaDTO) => {
    let element: JSX.Element | undefined;

    if (bounds) {
      const selected = area.name === selectedAreaName;
      const style = {
        left: toPercent(area.x, bounds.width),
        top: toPercent(area.y, bounds.height),
        width: toPercent(area.width, bounds.width),
        height: toPercent(area.height, bounds.height),
      } as const;

      const showHandles = selected && !previewMode;

      element = (
        <div
          key={area.name}
          role="button"
          tabIndex={0}
          className={cn(
            "absolute rounded-xl border-2 transition-colors",
            selected
              ? "border-lumi-primary bg-lumi-primary/5"
              : "border-lumi-text/30 hover:border-lumi-text/50 bg-white/0",
          )}
          style={style}
          onPointerDown={(event) => {
            event.stopPropagation();
            onSelectedAreaNameChange?.(area.name);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              onSelectedAreaNameChange?.(area.name);
            }
          }}
        >
          <div className="pointer-events-none absolute -top-7 left-0 flex items-center gap-2">
            <span className="bg-lumi-bg/90 text-lumi-text-secondary border-lumi-border/70 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] shadow-sm backdrop-blur">
              {area.name}
            </span>
            {selected && (
              <span className="bg-lumi-bg/80 text-lumi-text-secondary border-lumi-border/60 rounded-full border px-2 py-1 text-[10px] font-semibold shadow-sm backdrop-blur">
                {formatRectLabel(area)}
              </span>
            )}
          </div>

          {showHandles && (
            <>
              <button
                type="button"
                className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white shadow-sm transition hover:bg-black/70"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  deleteArea(area.name);
                }}
                aria-label={`Delete ${area.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>

              <button
                type="button"
                className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-black/70 shadow-sm"
                onPointerDown={(event) => startMove(event, area)}
                aria-label={`Move ${area.name}`}
              />

              {area.allowResize && (
                <>
                  <button
                    type="button"
                    className="absolute left-0 top-0 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-black/70 shadow-sm"
                    onPointerDown={(event) => startResize(event, area, "nw")}
                    aria-label={`Resize ${area.name} top left`}
                  />
                  <button
                    type="button"
                    className="absolute right-0 top-0 h-4 w-4 -translate-y-1/2 translate-x-1/2 rounded-full border border-white bg-black/70 shadow-sm"
                    onPointerDown={(event) => startResize(event, area, "ne")}
                    aria-label={`Resize ${area.name} top right`}
                  />
                  <button
                    type="button"
                    className="absolute bottom-0 left-0 h-4 w-4 -translate-x-1/2 translate-y-1/2 rounded-full border border-white bg-black/70 shadow-sm"
                    onPointerDown={(event) => startResize(event, area, "sw")}
                    aria-label={`Resize ${area.name} bottom left`}
                  />
                  <button
                    type="button"
                    className="absolute bottom-0 right-0 h-4 w-4 translate-x-1/2 translate-y-1/2 rounded-full border border-white bg-black/70 shadow-sm"
                    onPointerDown={(event) => startResize(event, area, "se")}
                    aria-label={`Resize ${area.name} bottom right`}
                  />
                </>
              )}
            </>
          )}

          {selected && previewMode && (
            <div className="absolute inset-x-3 bottom-3 rounded-lg bg-black/55 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur">
              {formatRectLabel(area)}
            </div>
          )}
        </div>
      );
    }

    return element;
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <p className="text-sm font-semibold">Design Area Layout</p>
          <p className="text-lumi-text-secondary text-xs">
            Click and drag on the image to draw an area. Use handles to resize or move.
          </p>
        </div>
        {bounds ? (
          <div className="text-lumi-text-secondary text-[10px] font-semibold uppercase tracking-[0.22em]">
            Source: {bounds.width}×{bounds.height}
          </div>
        ) : (
          <div className="text-lumi-text-secondary text-[10px] font-semibold uppercase tracking-[0.22em]">
            Waiting for image size…
          </div>
        )}
      </div>

      <div
        ref={containerRef}
        className={cn(
          "border-lumi-border/70 relative overflow-hidden rounded-2xl border bg-black/5",
          previewMode ? "cursor-default" : "cursor-crosshair",
          "touch-none",
        )}
        onPointerDown={handlePointerDown}
      >
        <img
          ref={imageRef}
          src={productImage}
          alt="Product template"
          className="block h-auto w-full select-none"
          draggable={false}
          onLoad={() => {
            const element = imageRef.current;
            if (!element) {
              return;
            }

            const width = element.naturalWidth;
            const height = element.naturalHeight;
            if (width && height) {
              setNaturalSize({ width, height });
            }
          }}
        />

        <div className="absolute inset-0">
          {existingAreas.map((area) => renderArea(area))}

          {bounds && interaction?.type === "drawing" && interaction.draftRect && (
            <div
              className="absolute rounded-xl border-2 border-dashed border-white bg-white/10"
              style={{
                left: toPercent(interaction.draftRect.x, bounds.width),
                top: toPercent(interaction.draftRect.y, bounds.height),
                width: toPercent(interaction.draftRect.width, bounds.width),
                height: toPercent(interaction.draftRect.height, bounds.height),
              }}
            />
          )}
        </div>
      </div>

      {existingAreas.length === 0 && !previewMode && (
        <div className="border-lumi-border/60 bg-lumi-bg-secondary/40 rounded-xl border p-4 text-sm">
          <p className="font-semibold">No design areas yet</p>
          <p className="text-lumi-text-secondary mt-1 text-sm">
            Draw at least one design area to enable the customization editor for customers.
          </p>
          <div className="mt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 text-[11px] font-semibold uppercase tracking-[0.22em]"
              onClick={() => {
                if (existingAreas.length > 0 || !bounds) {
                  return;
                }
                const name = createUniqueAreaName(existingAreas);
                const next = buildDefaultArea(name, {
                  x: roundPx(bounds.width * 0.25),
                  y: roundPx(bounds.height * 0.25),
                  width: roundPx(bounds.width * 0.5),
                  height: roundPx(bounds.height * 0.5),
                });
                onAreasChange([next]);
                onSelectedAreaNameChange?.(next.name);
              }}
              disabled={!bounds}
            >
              Create starter area
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
