import * as fabric from "fabric";

import type { CustomerDesignView } from "../types/design.types";
import { createLayerId, ensureFabricLayerMetadata } from "./layer-serialization";

const readDesignBounds = (canvas: fabric.Canvas): { width: number; height: number } => {
  const designWidth = (canvas as unknown as { lumiDesignWidth?: number }).lumiDesignWidth;
  const designHeight = (canvas as unknown as { lumiDesignHeight?: number }).lumiDesignHeight;

  return {
    width: typeof designWidth === "number" ? designWidth : canvas.getWidth(),
    height: typeof designHeight === "number" ? designHeight : canvas.getHeight(),
  };
};

const scaleToFit = (
  object: fabric.Object,
  bounds: { width: number; height: number },
  ratio = 0.85,
) => {
  const maxWidth = bounds.width * ratio;
  const maxHeight = bounds.height * ratio;

  const naturalWidth = object.getScaledWidth();
  const naturalHeight = object.getScaledHeight();
  const widthScale = naturalWidth > 0 ? maxWidth / naturalWidth : 1;
  const heightScale = naturalHeight > 0 ? maxHeight / naturalHeight : 1;
  const scale = Math.min(1, widthScale, heightScale);

  if (!Number.isFinite(scale) || scale <= 0 || scale >= 1) return;

  object.set({
    scaleX: (object.scaleX ?? 1) * scale,
    scaleY: (object.scaleY ?? 1) * scale,
  });
};

export const addImageUrlToCanvas = async (params: {
  canvas: fabric.Canvas;
  url: string;
  layerName: string;
  layerType: "image" | "clipart";
  metadata?: Record<string, unknown>;
  designId?: string;
  publicId?: string;
  clipartId?: string;
}) => {
  const { canvas, url, layerName, layerType } = params;

  const image = await fabric.Image.fromURL(url, { crossOrigin: "anonymous" });
  const bounds = readDesignBounds(canvas);

  image.set({
    originX: "center",
    originY: "center",
    left: bounds.width / 2,
    top: bounds.height / 2,
    selectable: true,
    evented: true,
  });

  scaleToFit(image, bounds);

  const raw = image as unknown as Record<string, unknown>;
  raw.src = url;
  if (params.designId) raw.designId = params.designId;
  if (params.publicId) raw.publicId = params.publicId;
  if (params.clipartId) raw.clipartId = params.clipartId;

  ensureFabricLayerMetadata(image, {
    layerId: createLayerId(layerType),
    layerType,
    layerName,
    zIndex: canvas.getObjects().length,
    customData: params.metadata,
  });

  canvas.add(image);
  canvas.setActiveObject(image);
  image.setCoords();
  canvas.requestRenderAll();
};

export const addCustomerDesignToCanvas = async (params: {
  canvas: fabric.Canvas;
  design: CustomerDesignView;
  layerName: string;
}) =>
  addImageUrlToCanvas({
    canvas: params.canvas,
    url: params.design.secureUrl,
    layerName: params.layerName,
    layerType: "image",
    designId: params.design.id,
    publicId: params.design.publicId,
    metadata: { uploadedFrom: "library" },
  });

export const addClipartSvgToCanvas = async (params: {
  canvas: fabric.Canvas;
  svg: string;
  layerName: string;
  clipartId: string;
  isPaid: boolean;
}) =>
  addImageUrlToCanvas({
    canvas: params.canvas,
    url: `data:image/svg+xml;utf8,${encodeURIComponent(params.svg)}`,
    layerName: params.layerName,
    layerType: "clipart",
    clipartId: params.clipartId,
    metadata: { source: "clipart", paid: params.isPaid },
  });
