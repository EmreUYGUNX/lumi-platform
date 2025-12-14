"use client";

import { useEffect, useMemo, useRef } from "react";

import type * as fabric from "fabric";

type SwipeDirection = "left" | "right";

interface TouchPoint {
  x: number;
  y: number;
}

interface GestureStart {
  distance: number;
  angle: number;
  mid: TouchPoint;
  zoom: number;
  offsetX: number;
  offsetY: number;
  objectAngle: number;
}

interface TouchControlsConfig {
  enabled: boolean;
  minSwipeDistancePx: number;
  maxSwipeVerticalDriftPx: number;
  longPressMs: number;
  maxTapDistancePx: number;
  doubleTapMs: number;
  snapRotationDegrees: number;
}

interface Ref<T> {
  current: T;
}

const clampNumber = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const toDegrees = (radians: number): number => (radians * 180) / Math.PI;

const normalizeAngle = (angle: number): number => {
  if (!Number.isFinite(angle)) return 0;
  const normalized = ((angle % 360) + 360) % 360;
  return normalized > 180 ? normalized - 360 : normalized;
};

const resolveUpperCanvas = (canvas: fabric.Canvas): HTMLCanvasElement | undefined =>
  (canvas as unknown as { upperCanvasEl?: HTMLCanvasElement }).upperCanvasEl;

const isEditableText = (
  object: fabric.Object | undefined,
): object is fabric.Textbox | fabric.IText | fabric.Text => {
  if (!object) return false;
  return object.type === "textbox" || object.type === "i-text" || object.type === "text";
};

interface TouchControlsContext {
  canvas: fabric.Canvas;
  upperCanvas: HTMLCanvasElement;
  config: TouchControlsConfig;
  onSwipeTool?: (direction: SwipeDirection) => void;
  onLongPress?: () => void;
  pointersRef: Ref<Map<number, TouchPoint>>;
  gestureStartRef: Ref<GestureStart | undefined>;
  lastTapRef: Ref<{ at: number; point: TouchPoint } | undefined>;
  longPressTimeoutRef: Ref<number | undefined>;
  longPressTriggeredRef: Ref<boolean>;
  swipeStartRef: Ref<{ at: number; point: TouchPoint } | undefined>;
}

const isTouchPointerEvent = (event: PointerEvent): boolean => {
  const { pointerType } = event as unknown as { pointerType?: unknown };
  return pointerType === undefined || pointerType === "touch";
};

const setPointer = (pointers: Map<number, TouchPoint>, event: PointerEvent): void => {
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
};

const resolvePointerPair = (
  pointers: Map<number, TouchPoint>,
): [TouchPoint, TouchPoint] | undefined => {
  const points = [...pointers.values()];
  const first = points[0];
  const second = points[1];
  let pair: [TouchPoint, TouchPoint] | undefined;
  if (first && second) {
    pair = [first, second];
  }
  return pair;
};

const resolveMidpoint = (
  upperCanvas: HTMLCanvasElement,
  a: TouchPoint,
  b: TouchPoint,
): TouchPoint => {
  const rect = upperCanvas.getBoundingClientRect();
  return {
    x: (a.x + b.x) / 2 - rect.left,
    y: (a.y + b.y) / 2 - rect.top,
  };
};

const resolveViewportOffsets = (canvas: fabric.Canvas): { offsetX: number; offsetY: number } => {
  const vpt = canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0];
  const offsetX = typeof vpt[4] === "number" ? vpt[4] : 0;
  const offsetY = typeof vpt[5] === "number" ? vpt[5] : 0;
  return { offsetX, offsetY };
};

const clearLongPressTimer = (ctx: TouchControlsContext): void => {
  const timeoutId = ctx.longPressTimeoutRef.current;
  if (timeoutId === undefined) return;
  window.clearTimeout(timeoutId);
  ctx.longPressTimeoutRef.current = undefined;
};

const startLongPressTimer = (ctx: TouchControlsContext): void => {
  clearLongPressTimer(ctx);
  ctx.longPressTriggeredRef.current = false;
  if (!ctx.onLongPress) return;

  ctx.longPressTimeoutRef.current = window.setTimeout(() => {
    ctx.longPressTimeoutRef.current = undefined;
    ctx.longPressTriggeredRef.current = true;
    ctx.onLongPress?.();
  }, ctx.config.longPressMs);
};

const cancelTapTracking = (ctx: TouchControlsContext): void => {
  ctx.swipeStartRef.current = undefined;
  clearLongPressTimer(ctx);
};

const enterTextEditing = (canvas: fabric.Canvas): void => {
  const active = canvas.getActiveObject() as
    | (fabric.Object & {
        isEditing?: boolean;
        enterEditing?: () => void;
        selectAll?: () => void;
      })
    | undefined;
  if (!active || !isEditableText(active) || active.isEditing) return;

  active.enterEditing?.();
  active.selectAll?.();
  canvas.requestRenderAll();
};

const setSwipeStart = (ctx: TouchControlsContext, event: PointerEvent): void => {
  const hasSelection = Boolean(ctx.canvas.getActiveObject());
  if (hasSelection) {
    ctx.swipeStartRef.current = undefined;
    return;
  }

  ctx.swipeStartRef.current = {
    at: Date.now(),
    point: { x: event.clientX, y: event.clientY },
  };
};

const setGestureStart = (ctx: TouchControlsContext): void => {
  const pair = resolvePointerPair(ctx.pointersRef.current);
  if (!pair) return;

  const [a, b] = pair;
  const distance = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
  const angle = toDegrees(Math.atan2(b.y - a.y, b.x - a.x));
  const mid = resolveMidpoint(ctx.upperCanvas, a, b);

  const { offsetX, offsetY } = resolveViewportOffsets(ctx.canvas);

  const activeObject = ctx.canvas.getActiveObject();
  const objectAngle =
    activeObject && typeof activeObject.angle === "number" ? activeObject.angle : 0;

  ctx.gestureStartRef.current = {
    distance,
    angle,
    mid,
    zoom: ctx.canvas.getZoom(),
    offsetX,
    offsetY,
    objectAngle,
  };
  ctx.longPressTriggeredRef.current = false;
};

const maybeCancelLongPressOnMove = (ctx: TouchControlsContext, event: PointerEvent): void => {
  if (ctx.pointersRef.current.size !== 1) return;
  const swipeStart = ctx.swipeStartRef.current;
  if (!swipeStart) return;

  const dx = event.clientX - swipeStart.point.x;
  const dy = event.clientY - swipeStart.point.y;
  if (Math.hypot(dx, dy) > ctx.config.maxTapDistancePx) {
    clearLongPressTimer(ctx);
  }
};

const rotateActiveObject = (
  ctx: TouchControlsContext,
  gestureStart: GestureStart,
  a: TouchPoint,
  b: TouchPoint,
): void => {
  const angle = toDegrees(Math.atan2(b.y - a.y, b.x - a.x));
  const rawDelta = normalizeAngle(angle - gestureStart.angle);

  const activeObject = ctx.canvas.getActiveObject() as
    | (fabric.Object & { isEditing?: boolean })
    | undefined;

  const isTextEditing =
    activeObject && isEditableText(activeObject) ? Boolean(activeObject.isEditing) : false;

  if (!activeObject || isTextEditing) return;

  const baseAngle = typeof gestureStart.objectAngle === "number" ? gestureStart.objectAngle : 0;
  const nextAngle = baseAngle + rawDelta;
  const snap = ctx.config.snapRotationDegrees;
  const snapped = snap > 0 ? Math.round(nextAngle / snap) * snap : nextAngle;
  activeObject.set({ angle: snapped });
  activeObject.setCoords();
};

const applyTwoFingerGesture = (
  ctx: TouchControlsContext,
  gestureStart: GestureStart,
  a: TouchPoint,
  b: TouchPoint,
  event: PointerEvent,
): void => {
  const distance = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
  const ratio = distance / gestureStart.distance;
  const nextZoom = clampNumber(gestureStart.zoom * ratio, 0.25, 4);
  const zoomRatio = gestureStart.zoom > 0 ? nextZoom / gestureStart.zoom : 1;

  const mid = resolveMidpoint(ctx.upperCanvas, a, b);

  const offsetAfterZoomX = (1 - zoomRatio) * gestureStart.mid.x + zoomRatio * gestureStart.offsetX;
  const offsetAfterZoomY = (1 - zoomRatio) * gestureStart.mid.y + zoomRatio * gestureStart.offsetY;

  const offsetX = offsetAfterZoomX + (mid.x - gestureStart.mid.x);
  const offsetY = offsetAfterZoomY + (mid.y - gestureStart.mid.y);

  ctx.canvas.setViewportTransform([nextZoom, 0, 0, nextZoom, offsetX, offsetY]);
  rotateActiveObject(ctx, gestureStart, a, b);
  ctx.canvas.requestRenderAll();

  event.preventDefault();
};

const handleDoubleTap = (ctx: TouchControlsContext, now: number, tapPoint: TouchPoint): boolean => {
  const previousTap = ctx.lastTapRef.current;
  ctx.lastTapRef.current = { at: now, point: tapPoint };
  if (!previousTap) return false;

  const elapsed = now - previousTap.at;
  if (elapsed > ctx.config.doubleTapMs) return false;

  const distance = Math.hypot(tapPoint.x - previousTap.point.x, tapPoint.y - previousTap.point.y);
  if (distance > ctx.config.maxTapDistancePx) return false;

  enterTextEditing(ctx.canvas);
  ctx.lastTapRef.current = undefined;
  ctx.swipeStartRef.current = undefined;
  return true;
};

const handleSwipe = (ctx: TouchControlsContext, tapPoint: TouchPoint): void => {
  const swipeStart = ctx.swipeStartRef.current;
  ctx.swipeStartRef.current = undefined;

  if (!swipeStart || !ctx.onSwipeTool) return;

  const dx = tapPoint.x - swipeStart.point.x;
  const dy = tapPoint.y - swipeStart.point.y;

  if (Math.abs(dy) > ctx.config.maxSwipeVerticalDriftPx) return;
  if (Math.abs(dx) < ctx.config.minSwipeDistancePx) return;

  ctx.onSwipeTool(dx > 0 ? "right" : "left");
};

const resetTouchState = (ctx: TouchControlsContext): void => {
  ctx.pointersRef.current.clear();
  ctx.gestureStartRef.current = undefined;
  ctx.lastTapRef.current = undefined;
  ctx.swipeStartRef.current = undefined;
  clearLongPressTimer(ctx);
  ctx.longPressTriggeredRef.current = false;
};

const touchPointerDown = (ctx: TouchControlsContext, event: PointerEvent): void => {
  if (!isTouchPointerEvent(event)) return;

  setPointer(ctx.pointersRef.current, event);
  ctx.upperCanvas.setPointerCapture(event.pointerId);

  if (ctx.pointersRef.current.size === 1) {
    setSwipeStart(ctx, event);
    startLongPressTimer(ctx);
    return;
  }

  if (ctx.pointersRef.current.size !== 2) {
    cancelTapTracking(ctx);
    return;
  }

  clearLongPressTimer(ctx);
  setGestureStart(ctx);
};

const touchPointerMove = (ctx: TouchControlsContext, event: PointerEvent): void => {
  if (!isTouchPointerEvent(event)) return;
  if (!ctx.pointersRef.current.has(event.pointerId)) return;

  setPointer(ctx.pointersRef.current, event);
  maybeCancelLongPressOnMove(ctx, event);

  if (ctx.pointersRef.current.size !== 2) return;

  const gestureStart = ctx.gestureStartRef.current;
  if (!gestureStart) return;

  const pair = resolvePointerPair(ctx.pointersRef.current);
  if (!pair) return;

  const [a, b] = pair;
  applyTwoFingerGesture(ctx, gestureStart, a, b, event);
};

const touchPointerUp = (ctx: TouchControlsContext, event: PointerEvent): void => {
  if (!isTouchPointerEvent(event)) return;

  ctx.pointersRef.current.delete(event.pointerId);

  if (ctx.pointersRef.current.size < 2) {
    ctx.gestureStartRef.current = undefined;
  }

  if (ctx.pointersRef.current.size > 0) return;

  clearLongPressTimer(ctx);

  if (ctx.longPressTriggeredRef.current) {
    ctx.longPressTriggeredRef.current = false;
    ctx.lastTapRef.current = undefined;
    ctx.swipeStartRef.current = undefined;
    return;
  }

  const now = Date.now();
  const tapPoint = { x: event.clientX, y: event.clientY };

  if (handleDoubleTap(ctx, now, tapPoint)) return;
  handleSwipe(ctx, tapPoint);
};

const registerTouchListeners = (ctx: TouchControlsContext): (() => void) => {
  const previousTouchAction = ctx.upperCanvas.style.touchAction;
  ctx.upperCanvas.style.touchAction = "none";

  const handlePointerDown = touchPointerDown.bind(undefined, ctx);
  const handlePointerMove = touchPointerMove.bind(undefined, ctx);
  const handlePointerUp = touchPointerUp.bind(undefined, ctx);

  ctx.upperCanvas.addEventListener("pointerdown", handlePointerDown, { passive: false });
  ctx.upperCanvas.addEventListener("pointermove", handlePointerMove, { passive: false });
  ctx.upperCanvas.addEventListener("pointerup", handlePointerUp, { passive: false });
  ctx.upperCanvas.addEventListener("pointercancel", handlePointerUp, { passive: false });

  return () => {
    ctx.upperCanvas.style.touchAction = previousTouchAction;
    ctx.upperCanvas.removeEventListener("pointerdown", handlePointerDown);
    ctx.upperCanvas.removeEventListener("pointermove", handlePointerMove);
    ctx.upperCanvas.removeEventListener("pointerup", handlePointerUp);
    ctx.upperCanvas.removeEventListener("pointercancel", handlePointerUp);
    resetTouchState(ctx);
  };
};

export interface TouchControlsProps {
  canvas?: fabric.Canvas;
  enabled?: boolean;
  minSwipeDistancePx?: number;
  maxSwipeVerticalDriftPx?: number;
  longPressMs?: number;
  maxTapDistancePx?: number;
  doubleTapMs?: number;
  snapRotationDegrees?: number;
  onSwipeTool?: (direction: SwipeDirection) => void;
  onLongPress?: () => void;
}

export function TouchControls({
  canvas,
  enabled = true,
  minSwipeDistancePx = 56,
  maxSwipeVerticalDriftPx = 40,
  longPressMs = 520,
  maxTapDistancePx = 18,
  doubleTapMs = 320,
  snapRotationDegrees = 15,
  onSwipeTool,
  onLongPress,
}: TouchControlsProps): JSX.Element {
  const pointersRef = useRef<Map<number, TouchPoint>>(new Map());
  const gestureStartRef = useRef<GestureStart | undefined>();
  const lastTapRef = useRef<{ at: number; point: TouchPoint } | undefined>();
  const longPressTimeoutRef = useRef<number | undefined>();
  const longPressTriggeredRef = useRef(false);
  const swipeStartRef = useRef<{ at: number; point: TouchPoint } | undefined>();

  const config = useMemo(
    (): TouchControlsConfig => ({
      enabled,
      minSwipeDistancePx,
      maxSwipeVerticalDriftPx,
      longPressMs,
      maxTapDistancePx,
      doubleTapMs,
      snapRotationDegrees,
    }),
    [
      doubleTapMs,
      enabled,
      longPressMs,
      maxSwipeVerticalDriftPx,
      maxTapDistancePx,
      minSwipeDistancePx,
      snapRotationDegrees,
    ],
  );

  useEffect(() => {
    if (!canvas || !config.enabled) return () => {};

    const upperCanvas = resolveUpperCanvas(canvas);
    if (!upperCanvas) return () => {};

    return registerTouchListeners({
      canvas,
      upperCanvas,
      config,
      onSwipeTool,
      onLongPress,
      pointersRef,
      gestureStartRef,
      lastTapRef,
      longPressTimeoutRef,
      longPressTriggeredRef,
      swipeStartRef,
    });
  }, [canvas, config, onLongPress, onSwipeTool]);

  return <></>;
}
