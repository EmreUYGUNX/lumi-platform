import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type * as fabric from "fabric";

import type { Layer } from "../types/layer.types";
import { deserializeLayer } from "../utils/layer-serialization";

const DEFAULT_MAX_ENTRIES = 40;

const buildSnapshotKey = (layers: Layer[]): string =>
  JSON.stringify(
    layers
      .map((layer) => {
        const base = {
          id: layer.layerId,
          t: layer.layerType,
          z: layer.zIndex,
          x: Math.round(layer.position.x),
          y: Math.round(layer.position.y),
          w: Math.round(layer.position.width),
          h: Math.round(layer.position.height),
          r: Math.round(layer.position.rotation),
          hidden: layer.isHidden,
          locked: layer.isLocked,
          opacity: layer.opacity,
        };

        if (layer.layerType === "text") {
          return { ...base, text: layer.text, font: layer.fontFamily, size: layer.fontSize };
        }

        if (layer.layerType === "image" || layer.layerType === "clipart") {
          return { ...base, src: layer.src };
        }

        if (layer.layerType === "shape") {
          return {
            ...base,
            shape: layer.shape,
            fill: layer.fill,
            stroke: layer.stroke,
          };
        }

        return base;
      })
      .sort((a, b) => a.z - b.z),
  );

const clearDesignObjects = (canvas: fabric.Canvas) => {
  const objects = canvas.getObjects();
  objects.forEach((object) => {
    canvas.remove(object);
  });
  canvas.discardActiveObject();
};

const applyLayersToCanvas = async (canvas: fabric.Canvas, layers: Layer[]) => {
  clearDesignObjects(canvas);

  const ordered = [...layers].sort((a, b) => a.zIndex - b.zIndex);
  // eslint-disable-next-line no-restricted-syntax
  for (const layer of ordered) {
    // eslint-disable-next-line no-await-in-loop -- sequential restore ensures stable stacking order.
    const object = await deserializeLayer(layer);
    canvas.add(object);
  }

  canvas.requestRenderAll();
};

const scheduleRestoreCompletion = (callback: () => void) => {
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(callback);
    return;
  }

  setTimeout(callback, 0);
};

export const useCanvasHistory = (params: {
  canvas?: fabric.Canvas;
  layers: Layer[];
  maxEntries?: number;
}) => {
  const { canvas, layers } = params;
  const maxEntries = Math.max(5, params.maxEntries ?? DEFAULT_MAX_ENTRIES);

  const undoStack = useRef<Layer[][]>([]);
  const redoStack = useRef<Layer[][]>([]);
  const lastKey = useRef<string | undefined>();
  const restoring = useRef(false);

  const [counts, setCounts] = useState({ undo: 0, redo: 0 });

  const canUndo = counts.undo > 1;
  const canRedo = counts.redo > 0;

  const pushSnapshot = useCallback(
    (snapshot: Layer[]) => {
      const next = snapshot.map((layer) => ({ ...layer }));
      undoStack.current.push(next);
      if (undoStack.current.length > maxEntries) {
        undoStack.current.splice(0, undoStack.current.length - maxEntries);
      }
      redoStack.current = [];
      setCounts({ undo: undoStack.current.length, redo: redoStack.current.length });
    },
    [maxEntries],
  );

  useEffect(() => {
    if (!canvas) return;
    if (restoring.current) return;

    const key = buildSnapshotKey(layers);
    if (key === lastKey.current) return;

    lastKey.current = key;
    pushSnapshot(layers);
  }, [canvas, layers, pushSnapshot]);

  const restore = useCallback(
    async (snapshot: Layer[]) => {
      if (!canvas) return;
      restoring.current = true;
      lastKey.current = buildSnapshotKey(snapshot);
      try {
        await applyLayersToCanvas(canvas, snapshot);
      } finally {
        scheduleRestoreCompletion(() => {
          restoring.current = false;
        });
      }
    },
    [canvas],
  );

  const undo = useCallback(async () => {
    if (!canvas) return;
    if (undoStack.current.length < 2) return;

    const current = undoStack.current.pop();
    const previous = undoStack.current.at(-1);
    if (current) {
      redoStack.current.unshift(current);
    }
    setCounts({ undo: undoStack.current.length, redo: redoStack.current.length });
    if (previous) {
      await restore(previous);
    }
  }, [canvas, restore]);

  const redo = useCallback(async () => {
    if (!canvas) return;
    const next = redoStack.current.shift();
    if (!next) return;
    undoStack.current.push(next);
    setCounts({ undo: undoStack.current.length, redo: redoStack.current.length });
    await restore(next);
  }, [canvas, restore]);

  const reset = useCallback(() => {
    undoStack.current = [];
    redoStack.current = [];
    lastKey.current = undefined;
    setCounts({ undo: 0, redo: 0 });
  }, []);

  useEffect(() => {
    if (!canvas) {
      reset();
    }
  }, [canvas, reset]);

  return useMemo(
    () => ({
      canUndo,
      canRedo,
      undo,
      redo,
      reset,
    }),
    [canRedo, canUndo, redo, reset, undo],
  );
};
