import type * as fabric from "fabric";

export interface AlignmentGuidesOptions {
  thresholdPx?: number;
  strokeStyle?: string;
}

interface AlignmentGuidesInternals {
  lumiAlignmentGuides?: {
    beforeRender: () => void;
    afterRender: () => void;
    objectMoving: (event: { target?: fabric.Object }) => void;
    mouseUp: () => void;
  };
}

type GuideLine = { orientation: "vertical"; x: number } | { orientation: "horizontal"; y: number };

const DEFAULT_THRESHOLD_PX = 8;
const DEFAULT_STROKE_STYLE = "rgba(255, 0, 255, 0.75)";

const readViewport = (
  canvas: fabric.Canvas,
): { scale: number; offsetX: number; offsetY: number } => {
  const vpt = canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0];
  const scale = typeof vpt[0] === "number" ? vpt[0] : 1;
  const offsetX = typeof vpt[4] === "number" ? vpt[4] : 0;
  const offsetY = typeof vpt[5] === "number" ? vpt[5] : 0;
  return { scale, offsetX, offsetY };
};

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
  const { scale, offsetX, offsetY } = readViewport(canvas);

  return {
    left: (rect.left - offsetX) / scale,
    top: (rect.top - offsetY) / scale,
    width: rect.width / scale,
    height: rect.height / scale,
  };
};

const clearTopContext = (canvas: fabric.Canvas): void => {
  const raw = canvas as unknown as {
    contextTop?: CanvasRenderingContext2D;
    clearContext?: (context: CanvasRenderingContext2D) => void;
  };
  const { contextTop: ctx } = raw;
  if (!ctx) return;

  const { clearContext } = raw;

  if (typeof clearContext === "function") {
    clearContext(ctx);
    return;
  }

  ctx.clearRect(0, 0, canvas.getWidth(), canvas.getHeight());
};

const drawGuides = (canvas: fabric.Canvas, guides: GuideLine[], strokeStyle: string): void => {
  const raw = canvas as unknown as { contextTop?: CanvasRenderingContext2D };
  const ctx = raw.contextTop;
  if (!ctx) return;

  const { scale, offsetX, offsetY } = readViewport(canvas);

  ctx.save();
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = 1;

  guides.forEach((guide) => {
    ctx.beginPath();
    if (guide.orientation === "vertical") {
      const x = guide.x * scale + offsetX;
      ctx.moveTo(Math.round(x) + 0.5, 0);
      ctx.lineTo(Math.round(x) + 0.5, canvas.getHeight());
    } else {
      const y = guide.y * scale + offsetY;
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(canvas.getWidth(), Math.round(y) + 0.5);
    }
    ctx.stroke();
  });

  ctx.restore();
};

const findActiveObjects = (active: fabric.Object): fabric.Object[] => {
  if (active.type !== "activeSelection") return [active];
  const selection = active as unknown as { getObjects?: () => fabric.Object[] };
  return selection.getObjects?.() ?? [];
};

const buildCandidateLines = (
  canvas: fabric.Canvas,
  excluded: Set<fabric.Object>,
): { xLines: number[]; yLines: number[] } => {
  const bounds = readDesignBounds(canvas);
  const xLines = new Set<number>([0, bounds.width / 2, bounds.width]);
  const yLines = new Set<number>([0, bounds.height / 2, bounds.height]);

  canvas.getObjects().forEach((object) => {
    if (excluded.has(object)) return;
    const rect = toDesignRect(canvas, object);
    xLines.add(rect.left);
    xLines.add(rect.left + rect.width / 2);
    xLines.add(rect.left + rect.width);
    yLines.add(rect.top);
    yLines.add(rect.top + rect.height / 2);
    yLines.add(rect.top + rect.height);
  });

  return { xLines: [...xLines], yLines: [...yLines] };
};

const findBestSnap = (params: {
  points: number[];
  candidates: number[];
  threshold: number;
}): { delta: number; line: number } | undefined => {
  let best: { delta: number; line: number; distance: number } | undefined;

  params.points.forEach((point) => {
    params.candidates.forEach((candidate) => {
      const delta = candidate - point;
      const distance = Math.abs(delta);
      if (distance > params.threshold) return;
      if (!best || distance < best.distance) {
        best = { delta, line: candidate, distance };
      }
    });
  });

  if (!best) return undefined;
  return { delta: best.delta, line: best.line };
};

const buildExcludedTargets = (target: fabric.Object): Set<fabric.Object> => {
  const excluded = new Set<fabric.Object>();
  if (target.type === "activeSelection") {
    findActiveObjects(target).forEach((object) => excluded.add(object));
    return excluded;
  }

  excluded.add(target);
  return excluded;
};

const resolveThreshold = (canvas: fabric.Canvas, thresholdPx: number): number => {
  const { scale } = readViewport(canvas);
  if (scale <= 0) return thresholdPx;
  return thresholdPx / scale;
};

const createObjectMovingHandler =
  (
    canvas: fabric.Canvas,
    guides: GuideLine[],
    thresholdPx: number,
  ): ((event: { target?: fabric.Object }) => void) =>
  (event) => {
    const { target } = event;
    if (!target) return;

    const excluded = buildExcludedTargets(target);
    const threshold = resolveThreshold(canvas, thresholdPx);

    const rect = toDesignRect(canvas, target);
    const pointsX = [rect.left, rect.left + rect.width / 2, rect.left + rect.width];
    const pointsY = [rect.top, rect.top + rect.height / 2, rect.top + rect.height];

    const candidates = buildCandidateLines(canvas, excluded);

    const snapX = findBestSnap({ points: pointsX, candidates: candidates.xLines, threshold });
    const snapY = findBestSnap({ points: pointsY, candidates: candidates.yLines, threshold });

    guides.splice(0, guides.length);

    if (snapX) {
      target.set({ left: (target.left ?? 0) + snapX.delta });
      target.setCoords();
      guides.push({ orientation: "vertical", x: snapX.line });
    }

    if (snapY) {
      target.set({ top: (target.top ?? 0) + snapY.delta });
      target.setCoords();
      guides.push({ orientation: "horizontal", y: snapY.line });
    }
  };

export const setAlignmentGuidesEnabled = (
  canvas: fabric.Canvas,
  enabled: boolean,
  options: AlignmentGuidesOptions = {},
): void => {
  const raw = canvas as unknown as AlignmentGuidesInternals;

  if (raw.lumiAlignmentGuides) {
    canvas.off("before:render", raw.lumiAlignmentGuides.beforeRender);
    canvas.off("after:render", raw.lumiAlignmentGuides.afterRender);
    canvas.off("object:moving", raw.lumiAlignmentGuides.objectMoving);
    canvas.off("mouse:up", raw.lumiAlignmentGuides.mouseUp);
    raw.lumiAlignmentGuides = undefined;
  }

  if (!enabled) return;

  const thresholdPx = options.thresholdPx ?? DEFAULT_THRESHOLD_PX;
  const strokeStyle = options.strokeStyle ?? DEFAULT_STROKE_STYLE;

  const guides: GuideLine[] = [];

  const beforeRender = () => {
    clearTopContext(canvas);
  };

  const afterRender = () => {
    drawGuides(canvas, guides, strokeStyle);
  };

  const objectMoving = createObjectMovingHandler(canvas, guides, thresholdPx);

  const mouseUp = () => {
    if (guides.length === 0) return;
    guides.splice(0, guides.length);
    canvas.requestRenderAll();
  };

  raw.lumiAlignmentGuides = { beforeRender, afterRender, objectMoving, mouseUp };

  canvas.on("before:render", beforeRender);
  canvas.on("after:render", afterRender);
  canvas.on("object:moving", objectMoving);
  canvas.on("mouse:up", mouseUp);
};
