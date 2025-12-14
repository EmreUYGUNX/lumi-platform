import type * as fabric from "fabric";

export type CanvasAlignAction =
  | "left"
  | "center"
  | "right"
  | "top"
  | "middle"
  | "bottom"
  | "center-both";

export type CanvasDistributeAction = "horizontal" | "vertical";

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

const hasMultipleSelection = (canvas: fabric.Canvas): boolean => {
  const active = canvas.getActiveObject();
  if (!active) return false;
  return active.type === "activeSelection";
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

const readSelectionBounds = (
  canvas: fabric.Canvas,
  objects: fabric.Object[],
): {
  left: number;
  top: number;
  right: number;
  bottom: number;
  centerX: number;
  centerY: number;
} => {
  const rects = objects.map((object) => toDesignRect(canvas, object));
  const left = Math.min(...rects.map((rect) => rect.left));
  const top = Math.min(...rects.map((rect) => rect.top));
  const right = Math.max(...rects.map((rect) => rect.left + rect.width));
  const bottom = Math.max(...rects.map((rect) => rect.top + rect.height));

  return {
    left,
    top,
    right,
    bottom,
    centerX: left + (right - left) / 2,
    centerY: top + (bottom - top) / 2,
  };
};

const buildCanvasReferenceBounds = (canvas: fabric.Canvas) => {
  const bounds = readDesignBounds(canvas);
  return {
    left: 0,
    top: 0,
    right: bounds.width,
    bottom: bounds.height,
    centerX: bounds.width / 2,
    centerY: bounds.height / 2,
  };
};

const resolveAlignmentDelta = (
  action: CanvasAlignAction,
  rect: { left: number; top: number; width: number; height: number },
  reference: {
    left: number;
    top: number;
    right: number;
    bottom: number;
    centerX: number;
    centerY: number;
  },
): { deltaX: number; deltaY: number } => {
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  switch (action) {
    case "left": {
      return { deltaX: reference.left - rect.left, deltaY: 0 };
    }
    case "center": {
      return { deltaX: reference.centerX - centerX, deltaY: 0 };
    }
    case "right": {
      return { deltaX: reference.right - (rect.left + rect.width), deltaY: 0 };
    }
    case "top": {
      return { deltaX: 0, deltaY: reference.top - rect.top };
    }
    case "middle": {
      return { deltaX: 0, deltaY: reference.centerY - centerY };
    }
    case "bottom": {
      return { deltaX: 0, deltaY: reference.bottom - (rect.top + rect.height) };
    }
    case "center-both": {
      return { deltaX: reference.centerX - centerX, deltaY: reference.centerY - centerY };
    }
    default: {
      return { deltaX: 0, deltaY: 0 };
    }
  }
};

export const alignActiveSelection = (canvas: fabric.Canvas, action: CanvasAlignAction): void => {
  const active = canvas.getActiveObject();
  if (!active) return;

  const targets = getActiveObjects(canvas);
  if (targets.length === 0) return;

  const reference = hasMultipleSelection(canvas)
    ? readSelectionBounds(canvas, targets)
    : buildCanvasReferenceBounds(canvas);

  targets.forEach((object) => {
    const rect = toDesignRect(canvas, object);
    const { deltaX, deltaY } = resolveAlignmentDelta(action, rect, reference);
    if (deltaX === 0 && deltaY === 0) return;

    object.set({
      left: (object.left ?? 0) + deltaX,
      top: (object.top ?? 0) + deltaY,
    });
    object.setCoords();
  });

  active.setCoords();
  canvas.requestRenderAll();
  canvas.fire("object:modified", { target: active });
};

interface DistributionEntry {
  object: fabric.Object;
  rect: { left: number; top: number; width: number; height: number };
}

const distributeHorizontally = (entries: DistributionEntry[]): void => {
  const sorted = [...entries].sort(
    (a, b) => a.rect.left + a.rect.width / 2 - (b.rect.left + b.rect.width / 2),
  );

  const first = sorted[0];
  const last = sorted.at(-1);
  if (!first || !last) return;

  const start = first.rect.left + first.rect.width / 2;
  const end = last.rect.left + last.rect.width / 2;
  const step = (end - start) / (sorted.length - 1);

  sorted.forEach((entry, index) => {
    const targetCenter = start + step * index;
    const currentCenter = entry.rect.left + entry.rect.width / 2;
    const delta = targetCenter - currentCenter;
    if (delta === 0) return;

    entry.object.set({ left: (entry.object.left ?? 0) + delta });
    entry.object.setCoords();
  });
};

const distributeVertically = (entries: DistributionEntry[]): void => {
  const sorted = [...entries].sort(
    (a, b) => a.rect.top + a.rect.height / 2 - (b.rect.top + b.rect.height / 2),
  );

  const first = sorted[0];
  const last = sorted.at(-1);
  if (!first || !last) return;

  const start = first.rect.top + first.rect.height / 2;
  const end = last.rect.top + last.rect.height / 2;
  const step = (end - start) / (sorted.length - 1);

  sorted.forEach((entry, index) => {
    const targetCenter = start + step * index;
    const currentCenter = entry.rect.top + entry.rect.height / 2;
    const delta = targetCenter - currentCenter;
    if (delta === 0) return;

    entry.object.set({ top: (entry.object.top ?? 0) + delta });
    entry.object.setCoords();
  });
};

export const distributeActiveSelection = (
  canvas: fabric.Canvas,
  direction: CanvasDistributeAction,
): void => {
  const active = canvas.getActiveObject();
  if (!active || active.type !== "activeSelection") return;

  const targets = getActiveObjects(canvas);
  if (targets.length < 3) return;

  const rects = targets.map((object) => ({
    object,
    rect: toDesignRect(canvas, object),
  }));

  if (direction === "horizontal") {
    distributeHorizontally(rects);
  } else {
    distributeVertically(rects);
  }

  active.setCoords();
  canvas.requestRenderAll();
  canvas.fire("object:modified", { target: active });
};
