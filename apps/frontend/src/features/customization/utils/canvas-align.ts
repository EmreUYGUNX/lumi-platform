import type * as fabric from "fabric";

export type CanvasAlignAction =
  | "left"
  | "center"
  | "right"
  | "top"
  | "middle"
  | "bottom"
  | "center-both";

const readDesignBounds = (canvas: fabric.Canvas): { width: number; height: number } => {
  const designWidth = (canvas as unknown as { lumiDesignWidth?: number }).lumiDesignWidth;
  const designHeight = (canvas as unknown as { lumiDesignHeight?: number }).lumiDesignHeight;

  return {
    width: typeof designWidth === "number" ? designWidth : canvas.getWidth(),
    height: typeof designHeight === "number" ? designHeight : canvas.getHeight(),
  };
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

export const alignActiveSelection = (canvas: fabric.Canvas, action: CanvasAlignAction): void => {
  const active = canvas.getActiveObject();
  if (!active) return;

  const bounds = readDesignBounds(canvas);
  const rect = toDesignRect(canvas, active);

  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  let deltaX = 0;
  let deltaY = 0;

  if (action === "left") deltaX = 0 - rect.left;
  if (action === "center") deltaX = bounds.width / 2 - centerX;
  if (action === "right") deltaX = bounds.width - (rect.left + rect.width);
  if (action === "top") deltaY = 0 - rect.top;
  if (action === "middle") deltaY = bounds.height / 2 - centerY;
  if (action === "bottom") deltaY = bounds.height - (rect.top + rect.height);
  if (action === "center-both") {
    deltaX = bounds.width / 2 - centerX;
    deltaY = bounds.height / 2 - centerY;
  }

  if (deltaX === 0 && deltaY === 0) return;

  const targets = getActiveObjects(canvas);
  targets.forEach((object) => {
    object.set({
      left: (object.left ?? 0) + deltaX,
      top: (object.top ?? 0) + deltaY,
    });
    object.setCoords();
  });

  active.setCoords();
  canvas.requestRenderAll();
};
