import { useCallback, useEffect, useMemo, useRef } from "react";

import * as fabric from "fabric";

import type { Layer } from "../types/layer.types";
import { createLayerId, deserializeLayer, serializeLayer } from "../utils/layer-serialization";

interface ClipboardPayload {
  layers: Layer[];
}

const clampLayerName = (value: string) => value.trim().slice(0, 32);

const runSafe = (fn?: () => void | Promise<void>) => {
  if (!fn) return;
  try {
    Promise.resolve(fn()).catch(() => {});
  } catch {
    // ignore
  }
};

const isTypingSurface = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select";
};

const isTextEditing = (canvas: fabric.Canvas): boolean => {
  const active = canvas.getActiveObject() as unknown as { isEditing?: boolean } | null;
  return Boolean(active?.isEditing);
};

const getActiveObjects = (canvas: fabric.Canvas): fabric.Object[] => {
  const active = canvas.getActiveObject();
  if (!active) return [];

  if (active.type === "activeSelection") {
    const selection = active as unknown as { getObjects?: () => fabric.Object[] };
    return selection.getObjects?.() ?? [];
  }

  return [active];
};

export const useCanvasShortcuts = (params: {
  canvas?: fabric.Canvas;
  readOnly?: boolean;
  disabled?: boolean;
  undo?: () => void | Promise<void>;
  redo?: () => void | Promise<void>;
  zoomIn?: () => void;
  zoomOut?: () => void;
}) => {
  const { canvas, redo, undo, zoomIn, zoomOut } = params;
  const readOnly = params.readOnly ?? false;
  const disabled = params.disabled ?? false;

  const clipboardRef = useRef<ClipboardPayload | undefined>();
  const pasteStepRef = useRef(0);

  const copySelection = useCallback(() => {
    if (!canvas) return;
    const objects = getActiveObjects(canvas);
    if (objects.length === 0) return;

    const allObjects = canvas.getObjects();
    const layers = objects
      .map((object) => serializeLayer(object, { zIndex: allObjects.indexOf(object) }))
      .sort((a, b) => a.zIndex - b.zIndex);

    clipboardRef.current = { layers };
    pasteStepRef.current = 0;
  }, [canvas]);

  const removeSelection = useCallback(() => {
    if (!canvas) return;
    const objects = getActiveObjects(canvas);
    if (objects.length === 0) return;

    objects.forEach((object) => {
      canvas.remove(object);
    });

    canvas.discardActiveObject();
    canvas.requestRenderAll();
  }, [canvas]);

  const pasteLayers = useCallback(
    async (layers: Layer[], opts: { advanceStep: boolean }) => {
      if (!canvas) return;
      if (layers.length === 0) return;

      const baseOffset = 14;
      const pasteStep = opts.advanceStep ? pasteStepRef.current + 1 : pasteStepRef.current;
      const offset = baseOffset * Math.max(1, pasteStep);

      const baseZ = canvas.getObjects().length;
      const created: fabric.Object[] = [];

      // eslint-disable-next-line no-restricted-syntax
      for (const [index, layer] of layers.entries()) {
        const nextLayer: Layer = {
          ...layer,
          layerId: createLayerId(layer.layerType),
          layerName: clampLayerName(`${layer.layerName} COPY`),
          zIndex: baseZ + index,
          position: {
            ...layer.position,
            x: layer.position.x + offset,
            y: layer.position.y + offset,
          },
        };

        // eslint-disable-next-line no-await-in-loop -- sequential paste preserves stacking order.
        const object = await deserializeLayer(nextLayer);
        created.push(object);
        canvas.add(object);
      }

      if (opts.advanceStep) {
        pasteStepRef.current = pasteStep;
      }

      if (created.length === 1) {
        const first = created[0];
        if (first) {
          canvas.setActiveObject(first);
        }
      } else if (created.length > 1) {
        canvas.setActiveObject(new fabric.ActiveSelection(created, { canvas }));
      }

      canvas.requestRenderAll();
      const active = canvas.getActiveObject();
      if (active) {
        canvas.fire("object:modified", { target: active } as unknown as never);
      }
    },
    [canvas],
  );

  const pasteSelection = useCallback(() => {
    if (readOnly) return;
    const clipboard = clipboardRef.current;
    if (!clipboard) return;
    runSafe(() => pasteLayers(clipboard.layers, { advanceStep: true }));
  }, [pasteLayers, readOnly]);

  const duplicateSelection = useCallback(() => {
    if (!canvas) return;
    if (readOnly) return;
    const objects = getActiveObjects(canvas);
    if (objects.length === 0) return;

    const allObjects = canvas.getObjects();
    const layers = objects
      .map((object) => serializeLayer(object, { zIndex: allObjects.indexOf(object) }))
      .sort((a, b) => a.zIndex - b.zIndex);

    runSafe(() => pasteLayers(layers, { advanceStep: false }));
  }, [canvas, pasteLayers, readOnly]);

  const selectAll = useCallback(() => {
    if (!canvas) return;
    const objects = canvas.getObjects().filter((object) => object.selectable && object.visible);
    if (objects.length === 0) return;
    canvas.setActiveObject(new fabric.ActiveSelection(objects, { canvas }));
    canvas.requestRenderAll();
  }, [canvas]);

  const nudgeSelection = useCallback(
    (dx: number, dy: number) => {
      if (!canvas) return;
      if (readOnly) return;
      const active = canvas.getActiveObject();
      const objects = getActiveObjects(canvas);
      if (!active || objects.length === 0) return;

      objects.forEach((object) => {
        object.set({
          left: (object.left ?? 0) + dx,
          top: (object.top ?? 0) + dy,
        });
        object.setCoords();
      });

      active.setCoords();
      canvas.requestRenderAll();
      canvas.fire("object:modified", { target: active });
    },
    [canvas, readOnly],
  );

  const modHandlers = useMemo(
    () => ({
      a: () => selectAll(),
      c: () => copySelection(),
      d: () => {
        if (readOnly) return;
        duplicateSelection();
      },
      v: () => {
        if (readOnly) return;
        pasteSelection();
      },
      x: () => {
        if (readOnly) return;
        copySelection();
        removeSelection();
      },
      y: () => runSafe(redo),
      z: (event: KeyboardEvent) => {
        if (event.shiftKey) {
          runSafe(redo);
          return;
        }
        runSafe(undo);
      },
    }),
    [
      copySelection,
      duplicateSelection,
      pasteSelection,
      readOnly,
      redo,
      removeSelection,
      selectAll,
      undo,
    ],
  );

  const plainHandlers = useMemo(
    () => ({
      Escape: () => {
        canvas?.discardActiveObject();
        canvas?.requestRenderAll();
      },
      Delete: () => {
        if (readOnly) return;
        removeSelection();
      },
      Backspace: () => {
        if (readOnly) return;
        removeSelection();
      },
      "+": () => zoomIn?.(),
      "=": () => zoomIn?.(),
      "-": () => zoomOut?.(),
      _: () => zoomOut?.(),
    }),
    [canvas, readOnly, removeSelection, zoomIn, zoomOut],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!canvas || disabled || isTypingSurface(event.target) || isTextEditing(canvas)) return;

      const modKey = event.ctrlKey || event.metaKey;
      if (modKey) {
        const handler = modHandlers[event.key.toLowerCase() as keyof typeof modHandlers];
        if (handler) {
          event.preventDefault();
          handler(event);
          return;
        }
      }

      const handler = plainHandlers[event.key as keyof typeof plainHandlers];
      if (handler) {
        event.preventDefault();
        handler();
        return;
      }

      const factor = event.shiftKey ? 10 : 1;
      const arrows = {
        ArrowUp: { dx: 0, dy: -1 },
        ArrowDown: { dx: 0, dy: 1 },
        ArrowLeft: { dx: -1, dy: 0 },
        ArrowRight: { dx: 1, dy: 0 },
      } as const;

      const delta = arrows[event.key as keyof typeof arrows];
      if (!delta) return;

      event.preventDefault();
      nudgeSelection(delta.dx * factor, delta.dy * factor);
    },
    [canvas, disabled, modHandlers, nudgeSelection, plainHandlers],
  );

  useEffect(() => {
    if (!canvas) return () => {};
    if (disabled) return () => {};

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [canvas, disabled, handleKeyDown]);
};
