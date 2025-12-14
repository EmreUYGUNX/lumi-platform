import * as fabric from "fabric";

import type { DesignArea } from "../types/design-area.types";
import { setAlignmentGuidesEnabled } from "./alignment-guides";
import {
  DEFAULT_GRID_COLOR,
  DEFAULT_GRID_SIZE,
  setGridOverlayEnabled as setGridOverlayEnabledInternal,
  setSnapToGridEnabled as setSnapToGridEnabledInternal,
} from "./snap-to-grid";

export interface CanvasViewport {
  scale: number;
  offsetX: number;
  offsetY: number;
  designWidth: number;
  designHeight: number;
}

export interface InitializeCanvasOptions {
  designArea: DesignArea;
  readOnly?: boolean;
  enableSnapToGrid?: boolean;
  gridSize?: number;
}

const clampNumber = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const toCanvasViewport = (canvas: fabric.Canvas, designArea: DesignArea): CanvasViewport => {
  const vpt = canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0];
  const scale = typeof vpt[0] === "number" ? vpt[0] : 1;
  const offsetX = typeof vpt[4] === "number" ? vpt[4] : 0;
  const offsetY = typeof vpt[5] === "number" ? vpt[5] : 0;

  return {
    scale,
    offsetX,
    offsetY,
    designWidth: designArea.width,
    designHeight: designArea.height,
  };
};

export const configureCanvasDefaults = (canvas: fabric.Canvas): void => {
  canvas.set({
    preserveObjectStacking: true,
    stopContextMenu: true,
    fireRightClick: true,
    renderOnAddRemove: false,
  });
};

export const fitCanvasToContainer = (
  canvas: fabric.Canvas,
  container: HTMLElement,
  designArea: DesignArea,
): CanvasViewport => {
  const containerWidth = clampNumber(container.clientWidth, 1, 10_000);
  const containerHeight = clampNumber(container.clientHeight, 1, 10_000);

  const scale = Math.min(containerWidth / designArea.width, containerHeight / designArea.height);
  const normalizedScale = clampNumber(scale, 0.1, 6);

  const offsetX = (containerWidth - designArea.width * normalizedScale) / 2;
  const offsetY = (containerHeight - designArea.height * normalizedScale) / 2;

  canvas.setWidth(containerWidth);
  canvas.setHeight(containerHeight);
  canvas.setViewportTransform([normalizedScale, 0, 0, normalizedScale, offsetX, offsetY]);
  canvas.requestRenderAll();

  return toCanvasViewport(canvas, designArea);
};

export const setCanvasBackground = async (
  canvas: fabric.Canvas,
  imageUrl: string,
  designArea: DesignArea,
): Promise<void> => {
  if (!imageUrl) {
    canvas.set({ backgroundImage: undefined });
    canvas.requestRenderAll();
    return;
  }

  const image = await fabric.Image.fromURL(imageUrl, {
    crossOrigin: "anonymous",
  });

  image.set({
    selectable: false,
    evented: false,
    left: -designArea.x,
    top: -designArea.y,
    originX: "left",
    originY: "top",
  });

  canvas.set({ backgroundImage: image });
  canvas.requestRenderAll();
};

const findContainer = (containerId: string): HTMLElement => {
  const escaped =
    typeof globalThis.CSS?.escape === "function" ? globalThis.CSS.escape(containerId) : containerId;
  const container = document.querySelector<HTMLElement>(`#${escaped}`);
  if (!container) {
    throw new Error(`Canvas container not found: ${containerId}`);
  }
  return container;
};

const createCanvasElement = (): HTMLCanvasElement => {
  const canvasElement = document.createElement("canvas");
  canvasElement.style.width = "100%";
  canvasElement.style.height = "100%";
  canvasElement.style.display = "block";
  canvasElement.dataset.lumi = "design-canvas";
  return canvasElement;
};

const installShiftMultiSelect = (canvas: fabric.Canvas): void => {
  canvas.on("mouse:down", (event) => {
    const mouseEvent = event.e as MouseEvent | undefined;
    if (!mouseEvent?.shiftKey) return;

    const { target } = event;
    if (!target) return;

    const active = canvas.getActiveObject();
    if (!active) return;

    if (active.type === "activeSelection") {
      const selection = active as unknown as {
        getObjects: () => fabric.Object[];
        add: (obj: fabric.Object) => void;
        remove: (obj: fabric.Object) => void;
      };

      const objects = selection.getObjects();
      if (objects.includes(target)) {
        selection.remove(target);
      } else {
        selection.add(target);
      }

      canvas.requestRenderAll();
      return;
    }

    if (active !== target) {
      const selection = new fabric.ActiveSelection([active, target], { canvas });
      canvas.setActiveObject(selection);
      canvas.requestRenderAll();
    }
  });
};

export const initializeCanvas = (
  containerId: string,
  options: InitializeCanvasOptions,
): fabric.Canvas => {
  const container = findContainer(containerId);

  container.innerHTML = "";

  const canvasElement = createCanvasElement();
  container.append(canvasElement);

  const canvas = new fabric.Canvas(canvasElement, {
    selection: !(options.readOnly ?? false),
  });

  configureCanvasDefaults(canvas);
  installShiftMultiSelect(canvas);
  setAlignmentGuidesEnabled(canvas, !(options.readOnly ?? false));

  const gridSize = options.gridSize ?? DEFAULT_GRID_SIZE;
  const enableSnapToGrid = options.enableSnapToGrid ?? false;

  if (enableSnapToGrid) {
    setSnapToGridEnabledInternal(canvas, true, gridSize);
  }

  return canvas;
};

export const setSnapToGridEnabled = (
  canvas: fabric.Canvas,
  enabled: boolean,
  gridSize = DEFAULT_GRID_SIZE,
): void => {
  setSnapToGridEnabledInternal(canvas, enabled, gridSize);
};

export const setGridOverlayEnabled = (
  canvas: fabric.Canvas,
  enabled: boolean,
  gridSize = DEFAULT_GRID_SIZE,
  color = DEFAULT_GRID_COLOR,
): void => {
  setGridOverlayEnabledInternal(canvas, enabled, gridSize, color);
};

export const disposeCanvas = (canvas: fabric.Canvas, containerId?: string): void => {
  canvas.off();
  canvas.dispose();

  if (!containerId) return;
  const container = document.querySelector<HTMLElement>(
    `#${typeof globalThis.CSS?.escape === "function" ? globalThis.CSS.escape(containerId) : containerId}`,
  );
  if (!container) return;

  container.innerHTML = "";
};
