"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import type * as fabric from "fabric";

import { cn } from "@/lib/utils";

import type { DesignArea } from "../../types/design-area.types";
import type { Layer } from "../../types/layer.types";
import { useCanvasLayers } from "../../hooks/useCanvasLayers";
import {
  disposeCanvas,
  fitCanvasToContainer,
  initializeCanvas,
  setCanvasBackground,
} from "../../utils/fabric-canvas";

interface DesignCanvasProps {
  productImageUrl: string;
  designArea: DesignArea;
  initialLayers?: Layer[];
  onLayerChange: (layers: Layer[]) => void;
  onSelectionChange: (layer?: Layer) => void;
  readOnly?: boolean;
  className?: string;
}

const buildSafeId = (value: string): string => value.replaceAll(":", "_");

export function DesignCanvas({
  productImageUrl,
  designArea,
  initialLayers,
  onLayerChange,
  onSelectionChange,
  readOnly = false,
  className,
}: DesignCanvasProps): JSX.Element {
  const reactId = useId();
  const containerId = useMemo(() => buildSafeId(`design-canvas-${reactId}`), [reactId]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const designAreaRef = useRef(designArea);
  const [canvas, setCanvas] = useState<fabric.Canvas | undefined>();
  const initialLayersRef = useRef<Layer[] | undefined>(initialLayers);

  const layerApi = useCanvasLayers(canvas);

  useEffect(() => {
    designAreaRef.current = designArea;
  }, [designArea]);

  useEffect(() => {
    if (!containerRef.current) return () => {};

    const created = initializeCanvas(containerId, { designArea, readOnly });
    (created as unknown as { lumiDesignWidth?: number }).lumiDesignWidth = designArea.width;
    (created as unknown as { lumiDesignHeight?: number }).lumiDesignHeight = designArea.height;
    setCanvas(created);

    const observer = new ResizeObserver(() => {
      if (!containerRef.current) return;
      fitCanvasToContainer(created, containerRef.current, designAreaRef.current);
    });

    observer.observe(containerRef.current);
    fitCanvasToContainer(created, containerRef.current, designAreaRef.current);

    return () => {
      observer.disconnect();
      disposeCanvas(created, containerId);
      setCanvas(undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Canvas lifecycle is intentionally tied to first mount.
  }, []);

  useEffect(() => {
    if (!canvas) return;
    (canvas as unknown as { lumiDesignWidth?: number }).lumiDesignWidth = designArea.width;
    (canvas as unknown as { lumiDesignHeight?: number }).lumiDesignHeight = designArea.height;
    (canvas as unknown as { lumiDesignConstraints?: unknown }).lumiDesignConstraints = {
      minDesignSize: designArea.minDesignSize,
      maxDesignSize: designArea.maxDesignSize,
      allowResize: designArea.allowResize,
      allowRotation: designArea.allowRotation,
    };

    if (containerRef.current) {
      fitCanvasToContainer(canvas, containerRef.current, designArea);
    }

    canvas.selection = !readOnly;
    canvas.skipTargetFind = readOnly;
    canvas.forEachObject((object) => {
      const locked = readOnly || Boolean((object as unknown as Record<string, unknown>).isLocked);

      object.set({
        selectable: !locked,
        evented: !locked,
        lockScalingX: locked || !designArea.allowResize,
        lockScalingY: locked || !designArea.allowResize,
        lockRotation: locked || !designArea.allowRotation,
      });
    });
    canvas.requestRenderAll();
  }, [canvas, designArea, readOnly]);

  useEffect(() => {
    if (!canvas) return () => {};
    let cancelled = false;

    const applyBackground = async () => {
      try {
        await setCanvasBackground(canvas, productImageUrl, designArea);
      } catch {
        if (cancelled) return;
        canvas.set({ backgroundImage: undefined });
        canvas.requestRenderAll();
      }
    };

    applyBackground();

    return () => {
      cancelled = true;
    };
  }, [canvas, productImageUrl, designArea]);

  useEffect(() => {
    onLayerChange(layerApi.layers);
  }, [layerApi.layers, onLayerChange]);

  useEffect(() => {
    if (!canvas) {
      onSelectionChange();
      return () => {};
    }

    const updateSelection = () => {
      const active = canvas.getActiveObject();
      if (!active) {
        onSelectionChange();
        return;
      }

      if (active.type === "activeSelection") {
        onSelectionChange();
        return;
      }

      const raw = active as unknown as Record<string, unknown>;
      const layerId = typeof raw.layerId === "string" ? raw.layerId : undefined;
      if (!layerId) {
        onSelectionChange();
        return;
      }

      const layer = layerApi.layers.find((candidate) => candidate.layerId === layerId);
      onSelectionChange(layer);
    };

    canvas.on("selection:created", updateSelection);
    canvas.on("selection:updated", updateSelection);
    canvas.on("selection:cleared", updateSelection);

    return () => {
      canvas.off("selection:created", updateSelection);
      canvas.off("selection:updated", updateSelection);
      canvas.off("selection:cleared", updateSelection);
    };
  }, [canvas, layerApi.layers, onSelectionChange]);

  useEffect(() => {
    if (!canvas) return () => {};
    const layers = initialLayersRef.current;
    if (!layers || layers.length === 0) return () => {};

    let cancelled = false;

    const loadLayers = async () => {
      await Promise.all(layers.map((layer) => layerApi.addLayer(layer)));
      if (!cancelled) {
        initialLayersRef.current = undefined;
      }
    };

    loadLayers();

    return () => {
      cancelled = true;
    };
  }, [canvas, layerApi]);

  return (
    <div
      ref={containerRef}
      id={containerId}
      className={cn(
        "relative h-full w-full overflow-hidden rounded-2xl border border-white/10 bg-black/5",
        className,
      )}
      aria-label="Design canvas"
      role="application"
    />
  );
}
