import * as fabric from "fabric";

export const DEFAULT_GRID_SIZE = 10;
export const DEFAULT_GRID_COLOR = "rgba(255, 255, 255, 0.14)";

interface SnapToGridInternals {
  lumiSnapToGridMoving?: (event: { target?: fabric.Object }) => void;
  lumiSnapToGridScaling?: (event: { target?: fabric.Object }) => void;
}

const snapValue = (value: number, gridSize: number): number => {
  if (!Number.isFinite(value) || gridSize <= 0) return value;
  return Math.round(value / gridSize) * gridSize;
};

const snapObjectPosition = (object: fabric.Object, gridSize: number): void => {
  const left = typeof object.left === "number" ? object.left : 0;
  const top = typeof object.top === "number" ? object.top : 0;

  object.set({
    left: snapValue(left, gridSize),
    top: snapValue(top, gridSize),
  });
  object.setCoords();
};

const snapObjectSize = (object: fabric.Object, gridSize: number): void => {
  const baseWidth = typeof object.width === "number" ? object.width : 0;
  const baseHeight = typeof object.height === "number" ? object.height : 0;
  if (
    !Number.isFinite(baseWidth) ||
    !Number.isFinite(baseHeight) ||
    baseWidth <= 0 ||
    baseHeight <= 0
  ) {
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

  const targetWidth = Math.max(gridSize, snapValue(currentWidth, gridSize));
  const targetHeight = Math.max(gridSize, snapValue(currentHeight, gridSize));

  const currentScaleX = typeof object.scaleX === "number" ? object.scaleX : 1;
  const currentScaleY = typeof object.scaleY === "number" ? object.scaleY : 1;

  const signX = currentScaleX < 0 ? -1 : 1;
  const signY = currentScaleY < 0 ? -1 : 1;

  const nextScaleX = (targetWidth / baseWidth) * signX;
  const nextScaleY = (targetHeight / baseHeight) * signY;

  if (!Number.isFinite(nextScaleX) || !Number.isFinite(nextScaleY)) return;

  object.set({
    scaleX: nextScaleX,
    scaleY: nextScaleY,
  });
  object.setCoords();
};

export const setSnapToGridEnabled = (
  canvas: fabric.Canvas,
  enabled: boolean,
  gridSize = DEFAULT_GRID_SIZE,
): void => {
  const raw = canvas as unknown as SnapToGridInternals;

  if (raw.lumiSnapToGridMoving) {
    canvas.off("object:moving", raw.lumiSnapToGridMoving);
    raw.lumiSnapToGridMoving = undefined;
  }

  if (raw.lumiSnapToGridScaling) {
    canvas.off("object:scaling", raw.lumiSnapToGridScaling);
    raw.lumiSnapToGridScaling = undefined;
  }

  if (!enabled) return;

  const resolvedGridSize = Math.max(1, gridSize);

  const moving = (event: { target?: fabric.Object }) => {
    if (!event.target) return;
    snapObjectPosition(event.target, resolvedGridSize);
  };

  const scaling = (event: { target?: fabric.Object }) => {
    if (!event.target) return;
    snapObjectSize(event.target, resolvedGridSize);
    snapObjectPosition(event.target, resolvedGridSize);
  };

  raw.lumiSnapToGridMoving = moving;
  raw.lumiSnapToGridScaling = scaling;

  canvas.on("object:moving", moving);
  canvas.on("object:scaling", scaling);
};

export const setGridOverlayEnabled = (
  canvas: fabric.Canvas,
  enabled: boolean,
  gridSize = DEFAULT_GRID_SIZE,
  color = DEFAULT_GRID_COLOR,
): void => {
  if (!enabled) {
    canvas.set({ overlayColor: undefined });
    canvas.requestRenderAll();
    return;
  }

  const resolvedGridSize = Math.max(2, Math.round(gridSize));

  const overlayCanvas = document.createElement("canvas");
  overlayCanvas.width = resolvedGridSize;
  overlayCanvas.height = resolvedGridSize;

  const ctx = overlayCanvas.getContext("2d");
  if (!ctx) {
    canvas.set({ overlayColor: undefined });
    canvas.requestRenderAll();
    return;
  }

  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(resolvedGridSize, 0);
  ctx.lineTo(0, 0);
  ctx.lineTo(0, resolvedGridSize);
  ctx.stroke();

  const pattern = new fabric.Pattern({ source: overlayCanvas, repeat: "repeat" });
  const overlayConfig = canvas as unknown as { overlayVpt?: boolean };
  overlayConfig.overlayVpt = true;

  canvas.set({ overlayColor: pattern as unknown as string });
  canvas.requestRenderAll();
};
