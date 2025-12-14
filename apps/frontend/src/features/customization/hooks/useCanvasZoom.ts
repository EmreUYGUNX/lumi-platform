import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import * as fabric from "fabric";

const clampNumber = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

interface TouchPoint {
  x: number;
  y: number;
}

interface GestureStart {
  distance: number;
  mid: TouchPoint;
  zoom: number;
  offsetX: number;
  offsetY: number;
}

const readDesignBounds = (canvas: fabric.Canvas): { width: number; height: number } => {
  const designWidth = (canvas as unknown as { lumiDesignWidth?: number }).lumiDesignWidth;
  const designHeight = (canvas as unknown as { lumiDesignHeight?: number }).lumiDesignHeight;

  return {
    width: typeof designWidth === "number" ? designWidth : canvas.getWidth(),
    height: typeof designHeight === "number" ? designHeight : canvas.getHeight(),
  };
};

const toDesignRect = (
  canvas: fabric.Canvas,
  object: fabric.Object,
): { left: number; top: number; width: number; height: number } => {
  const rect = object.getBoundingRect();
  const vpt = canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0];
  const scale = typeof vpt[0] === "number" ? vpt[0] : 1;
  const offsetX = typeof vpt[4] === "number" ? vpt[4] : 0;
  const offsetY = typeof vpt[5] === "number" ? vpt[5] : 0;

  return {
    left: (rect.left - offsetX) / scale,
    top: (rect.top - offsetY) / scale,
    width: rect.width / scale,
    height: rect.height / scale,
  };
};

export const useCanvasZoom = (params: {
  canvas?: fabric.Canvas;
  minZoom?: number;
  maxZoom?: number;
  step?: number;
}) => {
  const { canvas } = params;
  const minZoom = params.minZoom ?? 0.25;
  const maxZoom = params.maxZoom ?? 4;
  const step = params.step ?? 0.1;

  const [zoom, setZoom] = useState(1);
  const spacePressedRef = useRef(false);
  const panningRef = useRef(false);
  const panPointerRef = useRef<{ x: number; y: number } | undefined>();
  const restoreSelectionRef = useRef<boolean | undefined>();
  const restoreCursorRef = useRef<string | undefined>();

  useEffect(() => {
    if (!canvas) {
      setZoom(1);
      return () => {};
    }

    setZoom(canvas.getZoom());

    const handleAfterRender = () => {
      const nextZoom = canvas.getZoom();
      setZoom((prev) => (Math.abs(prev - nextZoom) >= 0.001 ? nextZoom : prev));
    };

    canvas.on("after:render", handleAfterRender);

    return () => {
      canvas.off("after:render", handleAfterRender);
    };
  }, [canvas]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      if (event.repeat) return;
      if (event.target instanceof HTMLElement) {
        const tag = event.target.tagName.toLowerCase();
        if (
          tag === "input" ||
          tag === "textarea" ||
          tag === "select" ||
          event.target.isContentEditable
        ) {
          return;
        }
      }
      spacePressedRef.current = true;
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      spacePressedRef.current = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const setViewport = useCallback(
    (nextZoom: number, offsetX: number, offsetY: number) => {
      if (!canvas) return;
      canvas.setViewportTransform([nextZoom, 0, 0, nextZoom, offsetX, offsetY]);
      canvas.requestRenderAll();
      setZoom(nextZoom);
    },
    [canvas],
  );

  const zoomTo = useCallback(
    (value: number) => {
      if (!canvas) return;
      const next = clampNumber(value, minZoom, maxZoom);
      const point = new fabric.Point(canvas.getWidth() / 2, canvas.getHeight() / 2);
      canvas.zoomToPoint(point, next);
      canvas.requestRenderAll();
      setZoom(next);
    },
    [canvas, maxZoom, minZoom],
  );

  const zoomIn = useCallback(() => {
    zoomTo(zoom + step);
  }, [step, zoom, zoomTo]);

  const zoomOut = useCallback(() => {
    zoomTo(zoom - step);
  }, [step, zoom, zoomTo]);

  const zoomToFit = useCallback(() => {
    if (!canvas) return;
    const bounds = readDesignBounds(canvas);
    const viewportWidth = canvas.getWidth();
    const viewportHeight = canvas.getHeight();

    const nextZoom = clampNumber(
      Math.min(viewportWidth / bounds.width, viewportHeight / bounds.height),
      minZoom,
      maxZoom,
    );

    const offsetX = (viewportWidth - bounds.width * nextZoom) / 2;
    const offsetY = (viewportHeight - bounds.height * nextZoom) / 2;
    setViewport(nextZoom, offsetX, offsetY);
  }, [canvas, maxZoom, minZoom, setViewport]);

  const zoomToActualSize = useCallback(() => {
    if (!canvas) return;
    const bounds = readDesignBounds(canvas);
    const viewportWidth = canvas.getWidth();
    const viewportHeight = canvas.getHeight();
    const nextZoom = clampNumber(1, minZoom, maxZoom);
    const offsetX = (viewportWidth - bounds.width * nextZoom) / 2;
    const offsetY = (viewportHeight - bounds.height * nextZoom) / 2;
    setViewport(nextZoom, offsetX, offsetY);
  }, [canvas, maxZoom, minZoom, setViewport]);

  const zoomToSelection = useCallback(() => {
    if (!canvas) return;
    const active = canvas.getActiveObject();
    if (!active) return;

    const rect = toDesignRect(canvas, active);
    const viewportWidth = canvas.getWidth();
    const viewportHeight = canvas.getHeight();

    const padding = 56;
    const usableWidth = Math.max(1, viewportWidth - padding * 2);
    const usableHeight = Math.max(1, viewportHeight - padding * 2);

    const nextZoom = clampNumber(
      Math.min(usableWidth / Math.max(1, rect.width), usableHeight / Math.max(1, rect.height)),
      minZoom,
      maxZoom,
    );

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const offsetX = viewportWidth / 2 - centerX * nextZoom;
    const offsetY = viewportHeight / 2 - centerY * nextZoom;

    setViewport(nextZoom, offsetX, offsetY);
  }, [canvas, maxZoom, minZoom, setViewport]);

  const handleMouseWheel = useCallback(
    (event: { e?: WheelEvent }) => {
      if (!canvas) return;
      const wheel = event.e;
      if (!wheel) return;

      const currentZoom = canvas.getZoom();
      const delta = wheel.deltaY ?? 0;
      const direction = delta > 0 ? -1 : 1;
      const nextZoom = clampNumber(currentZoom + direction * step, minZoom, maxZoom);
      const point = new fabric.Point(wheel.offsetX, wheel.offsetY);

      canvas.zoomToPoint(point, nextZoom);
      canvas.requestRenderAll();
      setZoom(nextZoom);

      wheel.preventDefault();
      wheel.stopPropagation();
    },
    [canvas, maxZoom, minZoom, step],
  );

  const handleMouseDown = useCallback(
    (event: { e?: Event }) => {
      if (!canvas) return;
      const mouse = event.e;
      if (!(mouse instanceof MouseEvent)) return;
      if (!spacePressedRef.current) return;

      const active = canvas.getActiveObject() as unknown as { isEditing?: boolean } | null;
      if (active?.isEditing) return;

      panningRef.current = true;
      panPointerRef.current = { x: mouse.clientX, y: mouse.clientY };
      restoreSelectionRef.current = canvas.selection;
      restoreCursorRef.current = canvas.defaultCursor ?? "default";

      canvas.selection = false;
      canvas.defaultCursor = "grabbing";
      mouse.preventDefault();
    },
    [canvas],
  );

  const handleMouseMove = useCallback(
    (event: { e?: Event }) => {
      if (!canvas) return;
      if (!panningRef.current) return;

      const mouse = event.e;
      if (!(mouse instanceof MouseEvent)) return;
      const pointer = panPointerRef.current;
      if (!pointer) return;

      const vpt = canvas.viewportTransform;
      if (!vpt) return;

      const dx = mouse.clientX - pointer.x;
      const dy = mouse.clientY - pointer.y;

      vpt[4] += dx;
      vpt[5] += dy;
      canvas.setViewportTransform(vpt);
      canvas.requestRenderAll();

      panPointerRef.current = { x: mouse.clientX, y: mouse.clientY };
      mouse.preventDefault();
    },
    [canvas],
  );

  const handleMouseUp = useCallback(() => {
    if (!canvas) return;
    if (!panningRef.current) return;
    panningRef.current = false;
    panPointerRef.current = undefined;

    if (typeof restoreSelectionRef.current === "boolean") {
      canvas.selection = restoreSelectionRef.current;
    }
    if (restoreCursorRef.current) {
      canvas.defaultCursor = restoreCursorRef.current;
    }
    restoreSelectionRef.current = undefined;
    restoreCursorRef.current = undefined;

    canvas.requestRenderAll();
  }, [canvas]);

  useEffect(() => {
    if (!canvas) return () => {};

    canvas.on("mouse:wheel", handleMouseWheel);
    canvas.on("mouse:down", handleMouseDown);
    canvas.on("mouse:move", handleMouseMove);
    canvas.on("mouse:up", handleMouseUp);

    return () => {
      canvas.off("mouse:wheel", handleMouseWheel);
      canvas.off("mouse:down", handleMouseDown);
      canvas.off("mouse:move", handleMouseMove);
      canvas.off("mouse:up", handleMouseUp);
    };
  }, [canvas, handleMouseDown, handleMouseMove, handleMouseUp, handleMouseWheel]);

  const upperCanvasRef = useRef<HTMLCanvasElement | undefined>();
  const pointersRef = useRef<Map<number, TouchPoint>>(new Map());
  const gestureStartRef = useRef<GestureStart | undefined>();

  const handleTouchPointerDown = useCallback(
    (event: PointerEvent) => {
      if (!canvas) return;
      if (event.pointerType !== "touch") return;

      const upperCanvas = upperCanvasRef.current;
      if (!upperCanvas) return;

      pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      upperCanvas.setPointerCapture(event.pointerId);

      if (pointersRef.current.size !== 2) return;
      const [a, b] = [...pointersRef.current.values()];
      if (!a || !b) return;

      const rect = upperCanvas.getBoundingClientRect();
      const mid = {
        x: (a.x + b.x) / 2 - rect.left,
        y: (a.y + b.y) / 2 - rect.top,
      };
      const distance = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));

      const vpt = canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0];
      const offsetX = typeof vpt[4] === "number" ? vpt[4] : 0;
      const offsetY = typeof vpt[5] === "number" ? vpt[5] : 0;

      gestureStartRef.current = {
        distance,
        mid,
        zoom: canvas.getZoom(),
        offsetX,
        offsetY,
      };
    },
    [canvas],
  );

  const handleTouchPointerMove = useCallback(
    (event: PointerEvent) => {
      if (!canvas) return;
      if (event.pointerType !== "touch") return;
      if (!pointersRef.current.has(event.pointerId)) return;

      const upperCanvas = upperCanvasRef.current;
      if (!upperCanvas) return;

      pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

      const gestureStart = gestureStartRef.current;
      if (!gestureStart || pointersRef.current.size !== 2) return;

      const [a, b] = [...pointersRef.current.values()];
      if (!a || !b) return;

      const rect = upperCanvas.getBoundingClientRect();
      const mid = {
        x: (a.x + b.x) / 2 - rect.left,
        y: (a.y + b.y) / 2 - rect.top,
      };
      const distance = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      const ratio = distance / gestureStart.distance;

      const nextZoom = clampNumber(gestureStart.zoom * ratio, minZoom, maxZoom);
      const zoomRatio = gestureStart.zoom > 0 ? nextZoom / gestureStart.zoom : 1;

      const offsetAfterZoomX =
        (1 - zoomRatio) * gestureStart.mid.x + zoomRatio * gestureStart.offsetX;
      const offsetAfterZoomY =
        (1 - zoomRatio) * gestureStart.mid.y + zoomRatio * gestureStart.offsetY;

      const offsetX = offsetAfterZoomX + (mid.x - gestureStart.mid.x);
      const offsetY = offsetAfterZoomY + (mid.y - gestureStart.mid.y);

      canvas.setViewportTransform([nextZoom, 0, 0, nextZoom, offsetX, offsetY]);
      canvas.requestRenderAll();
      setZoom(nextZoom);

      event.preventDefault();
    },
    [canvas, maxZoom, minZoom],
  );

  const handleTouchPointerUp = useCallback((event: PointerEvent) => {
    if (event.pointerType !== "touch") return;
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size < 2) {
      gestureStartRef.current = undefined;
    }
  }, []);

  useEffect(() => {
    if (!canvas) return () => {};

    const upperCanvas = (canvas as unknown as { upperCanvasEl?: HTMLCanvasElement }).upperCanvasEl;
    if (!upperCanvas) return () => {};

    upperCanvasRef.current = upperCanvas;
    upperCanvas.style.touchAction = "none";

    upperCanvas.addEventListener("pointerdown", handleTouchPointerDown, { passive: false });
    upperCanvas.addEventListener("pointermove", handleTouchPointerMove, { passive: false });
    upperCanvas.addEventListener("pointerup", handleTouchPointerUp, { passive: false });
    upperCanvas.addEventListener("pointercancel", handleTouchPointerUp, { passive: false });

    return () => {
      upperCanvas.removeEventListener("pointerdown", handleTouchPointerDown);
      upperCanvas.removeEventListener("pointermove", handleTouchPointerMove);
      upperCanvas.removeEventListener("pointerup", handleTouchPointerUp);
      upperCanvas.removeEventListener("pointercancel", handleTouchPointerUp);
      upperCanvasRef.current = undefined;
      pointersRef.current.clear();
      gestureStartRef.current = undefined;
    };
  }, [canvas, handleTouchPointerDown, handleTouchPointerMove, handleTouchPointerUp]);

  const zoomLabel = useMemo(() => `${Math.round(zoom * 100)}%`, [zoom]);

  return useMemo(
    () => ({
      zoom,
      zoomLabel,
      zoomIn,
      zoomOut,
      zoomTo,
      zoomToFit,
      zoomToActualSize,
      zoomToSelection,
    }),
    [zoom, zoomIn, zoomLabel, zoomOut, zoomTo, zoomToActualSize, zoomToFit, zoomToSelection],
  );
};
