import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type * as fabric from "fabric";

import type { Layer } from "../types/layer.types";
import {
  createLayerId,
  deserializeLayer,
  ensureFabricLayerMetadata,
  serializeLayer,
} from "../utils/layer-serialization";

const schedule = (callback: () => void): number => {
  if (typeof requestAnimationFrame === "function") {
    return requestAnimationFrame(callback);
  }

  return window.setTimeout(callback, 16);
};

const cancelSchedule = (id: number): void => {
  if (typeof cancelAnimationFrame === "function") {
    cancelAnimationFrame(id);
    return;
  }

  clearTimeout(id);
};

const clampObjectWithinBounds = (
  canvas: fabric.Canvas,
  object: fabric.Object,
  bounds: { width: number; height: number },
): void => {
  const vpt = canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0];
  const scale = typeof vpt[0] === "number" ? vpt[0] : 1;
  const offsetX = typeof vpt[4] === "number" ? vpt[4] : 0;
  const offsetY = typeof vpt[5] === "number" ? vpt[5] : 0;

  const rect = object.getBoundingRect();
  const left = (rect.left - offsetX) / scale;
  const top = (rect.top - offsetY) / scale;
  const right = left + rect.width / scale;
  const bottom = top + rect.height / scale;

  let deltaX = 0;
  let deltaY = 0;

  if (left < 0) deltaX = -left;
  if (top < 0) deltaY = -top;
  if (right > bounds.width) deltaX = bounds.width - right;
  if (bottom > bounds.height) deltaY = bounds.height - bottom;

  if (deltaX !== 0 || deltaY !== 0) {
    object.set({
      left: (object.left ?? 0) + deltaX,
      top: (object.top ?? 0) + deltaY,
    });
    object.setCoords();
  }
};

interface CanvasConstraints {
  minDesignSize?: number;
  maxDesignSize?: number;
  allowResize?: boolean;
  allowRotation?: boolean;
}

const readCanvasConstraints = (canvas: fabric.Canvas): CanvasConstraints => {
  const raw = canvas as unknown as { lumiDesignConstraints?: unknown };
  if (!raw.lumiDesignConstraints || typeof raw.lumiDesignConstraints !== "object") {
    return {};
  }

  return raw.lumiDesignConstraints as CanvasConstraints;
};

const resolveSizeFactor = (
  currentWidth: number,
  currentHeight: number,
  constraints: CanvasConstraints,
): number => {
  const minDesignSize = constraints.minDesignSize ?? 0;
  const maxDesignSize = constraints.maxDesignSize ?? 0;

  if (minDesignSize <= 0 && maxDesignSize <= 0) return 1;

  if (minDesignSize > 0 && (currentWidth < minDesignSize || currentHeight < minDesignSize)) {
    return Math.max(minDesignSize / currentWidth, minDesignSize / currentHeight);
  }

  if (maxDesignSize > 0 && (currentWidth > maxDesignSize || currentHeight > maxDesignSize)) {
    return Math.min(maxDesignSize / currentWidth, maxDesignSize / currentHeight);
  }

  return 1;
};

const clampObjectSize = (object: fabric.Object, constraints: CanvasConstraints): void => {
  if (constraints.allowResize === false) {
    object.set({ scaleX: 1, scaleY: 1 });
    object.setCoords();
    return;
  }

  const currentWidth = object.getScaledWidth();
  const currentHeight = object.getScaledHeight();
  if (
    !Number.isFinite(currentWidth) ||
    !Number.isFinite(currentHeight) ||
    currentWidth <= 0 ||
    currentHeight <= 0
  ) {
    return;
  }

  const factor = resolveSizeFactor(currentWidth, currentHeight, constraints);
  if (!Number.isFinite(factor) || factor === 1) return;

  object.set({
    scaleX: (object.scaleX ?? 1) * factor,
    scaleY: (object.scaleY ?? 1) * factor,
  });
  object.setCoords();
};

export const useCanvasLayers = (canvas: fabric.Canvas | undefined) => {
  const [layers, setLayers] = useState<Layer[]>([]);
  const scheduledRef = useRef<number | undefined>();

  const syncLayers = useCallback(() => {
    if (!canvas) return;
    const objects = canvas.getObjects();
    const nextLayers = objects.map((object, index) => serializeLayer(object, { zIndex: index }));
    setLayers(nextLayers);
  }, [canvas]);

  const scheduleSync = useCallback(() => {
    if (!canvas) return;
    if (scheduledRef.current !== undefined) return;

    scheduledRef.current = schedule(() => {
      scheduledRef.current = undefined;
      syncLayers();
    });
  }, [canvas, syncLayers]);

  useEffect(() => {
    if (!canvas) {
      setLayers([]);
      return () => {};
    }

    const constraints = readCanvasConstraints(canvas);

    const designWidth = (canvas as unknown as { lumiDesignWidth?: number }).lumiDesignWidth;
    const designHeight = (canvas as unknown as { lumiDesignHeight?: number }).lumiDesignHeight;

    const bounds = {
      width: typeof designWidth === "number" ? designWidth : canvas.getWidth(),
      height: typeof designHeight === "number" ? designHeight : canvas.getHeight(),
    };

    const handleMutation = () => {
      scheduleSync();
    };

    const handleMoving = (event: { target?: fabric.Object }) => {
      if (!event.target) return;
      clampObjectWithinBounds(canvas, event.target, bounds);
    };

    const handleScaling = (event: { target?: fabric.Object }) => {
      if (!event.target) return;
      clampObjectSize(event.target, constraints);
      clampObjectWithinBounds(canvas, event.target, bounds);
    };

    const handleRotating = (event: { target?: fabric.Object }) => {
      if (!event.target) return;
      const allowRotation = constraints.allowRotation ?? true;
      if (!allowRotation) {
        event.target.set({ angle: 0 });
        event.target.setCoords();
      }
      clampObjectWithinBounds(canvas, event.target, bounds);
    };

    canvas.on("object:added", handleMutation);
    canvas.on("object:modified", handleMutation);
    canvas.on("object:removed", handleMutation);
    canvas.on("object:moving", handleMoving);
    canvas.on("object:scaling", handleScaling);
    canvas.on("object:rotating", handleRotating);

    scheduleSync();

    return () => {
      canvas.off("object:added", handleMutation);
      canvas.off("object:modified", handleMutation);
      canvas.off("object:removed", handleMutation);
      canvas.off("object:moving", handleMoving);
      canvas.off("object:scaling", handleScaling);
      canvas.off("object:rotating", handleRotating);

      if (scheduledRef.current !== undefined) {
        cancelSchedule(scheduledRef.current);
        scheduledRef.current = undefined;
      }
    };
  }, [canvas, scheduleSync]);

  const indexById = useMemo(() => {
    const map = new Map<string, number>();
    layers.forEach((layer, index) => {
      map.set(layer.layerId, index);
    });
    return map;
  }, [layers]);

  const addLayer = useCallback(
    async (layer: Layer) => {
      if (!canvas) return;
      const object = await deserializeLayer(layer);
      ensureFabricLayerMetadata(object, {
        layerId: layer.layerId,
        layerType: layer.layerType,
        layerName: layer.layerName,
        isLocked: layer.isLocked,
        isHidden: layer.isHidden,
        zIndex: layer.zIndex,
        customData: layer.customData,
      });
      canvas.add(object);
      canvas.requestRenderAll();
      scheduleSync();
    },
    [canvas, scheduleSync],
  );

  const removeLayer = useCallback(
    (layerId: string) => {
      if (!canvas) return;
      const objects = canvas.getObjects();
      const target = objects.find((object) => {
        const raw = object as unknown as Record<string, unknown>;
        return raw.layerId === layerId;
      });

      if (!target) return;
      canvas.remove(target);
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      scheduleSync();
    },
    [canvas, scheduleSync],
  );

  const updateLayer = useCallback(
    (layerId: string, updates: Partial<Layer>) => {
      if (!canvas) return;
      const objects = canvas.getObjects();
      const target = objects.find((object) => {
        const raw = object as unknown as Record<string, unknown>;
        return raw.layerId === layerId;
      });
      if (!target) return;

      const raw = target as unknown as Record<string, unknown>;
      if (typeof updates.layerName === "string") raw.layerName = updates.layerName;
      if (typeof updates.isLocked === "boolean") raw.isLocked = updates.isLocked;
      if (typeof updates.isHidden === "boolean") raw.isHidden = updates.isHidden;
      if (
        updates.customData &&
        typeof updates.customData === "object" &&
        !Array.isArray(updates.customData)
      ) {
        raw.customData = updates.customData;
      }

      if (updates.position) {
        target.set({
          left: updates.position.x,
          top: updates.position.y,
          angle: updates.position.rotation,
        });
      }

      if (typeof updates.opacity === "number") {
        target.set({ opacity: updates.opacity / 100 });
      }

      if (updates.layerType === "text" && "text" in updates) {
        Object.assign(raw, { text: (updates as Layer & { layerType: "text" }).text });
      }

      target.set({
        visible: !(updates.isHidden ?? raw.isHidden),
        selectable: !(updates.isLocked ?? raw.isLocked),
        evented: !(updates.isLocked ?? raw.isLocked),
      });

      target.setCoords();
      canvas.requestRenderAll();
      scheduleSync();
    },
    [canvas, scheduleSync],
  );

  const reorderLayers = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (!canvas) return;
      const objects = canvas.getObjects();
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= objects.length || toIndex >= objects.length)
        return;
      const target = objects[fromIndex];
      if (!target) return;
      canvas.moveObjectTo(target, toIndex);
      canvas.requestRenderAll();
      scheduleSync();
    },
    [canvas, scheduleSync],
  );

  const bringToFront = useCallback(
    (layerId: string) => {
      if (!canvas) return;
      const target = canvas.getObjects().find((object) => {
        const raw = object as unknown as Record<string, unknown>;
        return raw.layerId === layerId;
      });
      if (!target) return;
      canvas.bringObjectToFront(target);
      canvas.requestRenderAll();
      scheduleSync();
    },
    [canvas, scheduleSync],
  );

  const sendToBack = useCallback(
    (layerId: string) => {
      if (!canvas) return;
      const target = canvas.getObjects().find((object) => {
        const raw = object as unknown as Record<string, unknown>;
        return raw.layerId === layerId;
      });
      if (!target) return;
      canvas.sendObjectToBack(target);
      canvas.requestRenderAll();
      scheduleSync();
    },
    [canvas, scheduleSync],
  );

  const duplicateLayer = useCallback(
    async (layerId: string) => {
      if (!canvas) return;
      const target = canvas.getObjects().find((object) => {
        const raw = object as unknown as Record<string, unknown>;
        return raw.layerId === layerId;
      });
      if (!target) return;

      const clone = await (
        target as unknown as { clone: (props?: string[]) => Promise<fabric.Object> }
      ).clone([]);
      const raw = clone as unknown as Record<string, unknown>;
      raw.layerId = createLayerId("layer");
      raw.layerName = `${(target as unknown as Record<string, unknown>).layerName ?? "LAYER"} COPY`;
      raw.isLocked = false;
      raw.isHidden = false;
      raw.zIndex = layers.length;

      clone.set({
        left: (clone.left ?? 0) + 12,
        top: (clone.top ?? 0) + 12,
        selectable: true,
        evented: true,
        visible: true,
      });

      canvas.add(clone);
      canvas.setActiveObject(clone);
      canvas.requestRenderAll();
      scheduleSync();
    },
    [canvas, layers.length, scheduleSync],
  );

  const lockLayer = useCallback(
    (layerId: string, locked: boolean) => {
      if (!canvas) return;
      updateLayer(layerId, { isLocked: locked });
    },
    [canvas, updateLayer],
  );

  const hideLayer = useCallback(
    (layerId: string, hidden: boolean) => {
      if (!canvas) return;
      updateLayer(layerId, { isHidden: hidden });
    },
    [canvas, updateLayer],
  );

  return {
    layers,
    indexById,
    addLayer,
    removeLayer,
    updateLayer,
    reorderLayers,
    bringToFront,
    sendToBack,
    duplicateLayer,
    lockLayer,
    hideLayer,
  };
};
