import * as fabric from "fabric";

import type {
  ClipartLayer,
  GroupLayer,
  ImageLayer,
  Layer,
  LayerPosition,
  LayerType,
  ShapeLayer,
  ShapeKind,
  TextLayer,
} from "../types/layer.types";

const CUSTOM_FABRIC_PROPERTIES = [
  "id",
  "layerId",
  "layerType",
  "layerName",
  "isLocked",
  "isHidden",
  "customData",
  "zIndex",
] as const;

export const createLayerId = (prefix = "layer"): string => {
  const random =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${random}`;
};

const asNumber = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const asBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback;

const asString = (value: unknown, fallback: string): string =>
  typeof value === "string" && value.trim() ? value : fallback;

const readCustomData = (value: unknown): Record<string, unknown> | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
};

export const ensureFabricLayerMetadata = (
  object: fabric.Object,
  overrides: Partial<{
    layerId: string;
    layerType: LayerType;
    layerName: string;
    isLocked: boolean;
    isHidden: boolean;
    zIndex: number;
    customData: Record<string, unknown>;
  }> = {},
): {
  layerId: string;
  layerType: LayerType;
  layerName: string;
  isLocked: boolean;
  isHidden: boolean;
  zIndex: number;
  customData?: Record<string, unknown>;
} => {
  const raw = object as unknown as Record<string, unknown>;

  const layerId = asString(overrides.layerId ?? raw.layerId, createLayerId());
  const layerType = asString(overrides.layerType ?? raw.layerType, "shape") as LayerType;
  const layerName = asString(overrides.layerName ?? raw.layerName, layerType.toUpperCase());
  const isLocked = asBoolean(overrides.isLocked ?? raw.isLocked, false);
  const isHidden = asBoolean(overrides.isHidden ?? raw.isHidden, false);
  const zIndex = asNumber(overrides.zIndex ?? raw.zIndex, 0);
  const customData = readCustomData(overrides.customData ?? raw.customData);

  Object.assign(raw, {
    layerId,
    layerType,
    layerName,
    isLocked,
    isHidden,
    zIndex,
    customData,
  });

  object.set({
    visible: !isHidden,
    selectable: !isLocked,
    evented: !isLocked,
  });

  return { layerId, layerType, layerName, isLocked, isHidden, zIndex, customData };
};

const buildPosition = (object: fabric.Object): LayerPosition => {
  const left = asNumber(object.left, 0);
  const top = asNumber(object.top, 0);
  const width = object.getScaledWidth();
  const height = object.getScaledHeight();
  const rotation = asNumber(object.angle, 0);

  return { x: left, y: top, width, height, rotation };
};

const resolveLayerType = (object: fabric.Object, fallback: LayerType): LayerType => {
  const raw = object as unknown as Record<string, unknown>;
  const candidate = typeof raw.layerType === "string" ? raw.layerType : undefined;
  if (
    candidate === "image" ||
    candidate === "text" ||
    candidate === "shape" ||
    candidate === "clipart"
  ) {
    return candidate;
  }

  if (candidate === "group") {
    return "group";
  }

  const type = typeof object.type === "string" ? object.type : "";
  if (type.includes("text")) return "text";
  if (type.includes("image")) return "image";
  if (type.includes("group")) return "group";

  return fallback;
};

const resolveOpacity = (object: fabric.Object): number | undefined => {
  if (typeof object.opacity !== "number" || !Number.isFinite(object.opacity)) return undefined;
  return Math.round(object.opacity * 100);
};

const toFabricObject = (object: fabric.Object): Record<string, unknown> =>
  object.toObject([...CUSTOM_FABRIC_PROPERTIES]) as unknown as Record<string, unknown>;

const buildBaseLayer = (
  object: fabric.Object,
  overrides: Partial<{ zIndex: number }> = {},
): Omit<Layer, "layerType"> & { layerType: LayerType } => {
  const raw = object as unknown as Record<string, unknown>;

  const meta = ensureFabricLayerMetadata(object, {
    zIndex:
      typeof overrides.zIndex === "number" ? overrides.zIndex : (raw.zIndex as number | undefined),
    layerType: resolveLayerType(object, "shape"),
  });

  return {
    layerId: meta.layerId,
    layerType: meta.layerType,
    layerName: meta.layerName,
    isLocked: meta.isLocked,
    isHidden: meta.isHidden,
    zIndex: meta.zIndex,
    position: buildPosition(object),
    opacity: resolveOpacity(object),
    customData: meta.customData,
    fabricObject: toFabricObject(object),
  };
};

const serializeTextLayer = (
  object: fabric.Object,
  base: ReturnType<typeof buildBaseLayer>,
): TextLayer => {
  const raw = object as unknown as Record<string, unknown>;
  const text = asString(raw.text, "");
  const fontFamily = asString(raw.fontFamily, "Inter");
  const fontSize = asNumber(raw.fontSize, 24);
  const fontWeight =
    typeof raw.fontWeight === "string" || typeof raw.fontWeight === "number"
      ? raw.fontWeight
      : undefined;
  const letterSpacing = typeof raw.charSpacing === "number" ? raw.charSpacing : undefined;
  const color = typeof raw.fill === "string" ? raw.fill : undefined;

  return {
    ...base,
    layerType: "text",
    text,
    fontFamily,
    fontSize,
    fontWeight,
    letterSpacing,
    color,
  };
};

const serializeImageLayer = (
  object: fabric.Object,
  base: ReturnType<typeof buildBaseLayer>,
  type: "image" | "clipart",
): ImageLayer | ClipartLayer => {
  const raw = object as unknown as Record<string, unknown>;
  const src = asString(
    raw.src ??
      (typeof (object as unknown as { getSrc?: () => string }).getSrc === "function"
        ? (object as unknown as { getSrc: () => string }).getSrc()
        : undefined),
    "",
  );
  const designId = typeof raw.designId === "string" ? raw.designId : undefined;
  const publicId = typeof raw.publicId === "string" ? raw.publicId : undefined;

  if (type === "clipart") {
    const clipartId = asString(raw.clipartId, "clipart");
    return {
      ...base,
      layerType: "clipart",
      src,
      clipartId,
    };
  }

  return {
    ...base,
    layerType: "image",
    src,
    designId,
    publicId,
  };
};

const resolveShapeKind = (object: fabric.Object): ShapeKind => {
  const type = typeof object.type === "string" ? object.type : "";
  if (type.includes("circle")) return "circle";
  if (type.includes("polygon")) return "polygon";
  return "rect";
};

const serializeShapeLayer = (
  object: fabric.Object,
  base: ReturnType<typeof buildBaseLayer>,
): ShapeLayer => {
  const raw = object as unknown as Record<string, unknown>;
  const shape = resolveShapeKind(object);
  const fill = typeof raw.fill === "string" ? raw.fill : undefined;
  const stroke = typeof raw.stroke === "string" ? raw.stroke : undefined;
  const strokeWidth = typeof raw.strokeWidth === "number" ? raw.strokeWidth : undefined;

  return {
    ...base,
    layerType: "shape",
    shape,
    fill,
    stroke,
    strokeWidth,
  };
};

const serializeGroupLayer = (
  object: fabric.Object,
  base: ReturnType<typeof buildBaseLayer>,
): GroupLayer => {
  const raw = object as unknown as Record<string, unknown>;
  const groupObjectsKey = "_objects";
  const objects = raw[groupObjectsKey];
  const children = Array.isArray(objects)
    ? objects.map((child) => {
        const childRaw = child as Record<string, unknown>;
        return typeof childRaw.layerId === "string" ? childRaw.layerId : undefined;
      })
    : [];

  return {
    ...base,
    layerType: "group",
    childLayerIds: children.filter(Boolean) as string[],
  };
};

export const serializeLayer = (
  object: fabric.Object,
  options: Partial<{ zIndex: number }> = {},
): Layer => {
  const base = buildBaseLayer(object, options);
  const type = resolveLayerType(object, base.layerType);

  if (type === "text") {
    return serializeTextLayer(object, base);
  }

  if (type === "image") {
    return serializeImageLayer(object, base, "image");
  }

  if (type === "clipart") {
    return serializeImageLayer(object, base, "clipart");
  }

  if (type === "group") {
    return serializeGroupLayer(object, base);
  }

  return serializeShapeLayer(object, base);
};

export const deserializeLayer = async (layer: Layer): Promise<fabric.Object> => {
  const objects = await fabric.util.enlivenObjects([layer.fabricObject], {});
  const [object] = objects as unknown as fabric.Object[];

  if (!object) {
    throw new Error(`Failed to deserialize layer ${layer.layerId}`);
  }

  const raw = object as unknown as Record<string, unknown>;
  Object.assign(raw, {
    layerId: layer.layerId,
    layerType: layer.layerType,
    layerName: layer.layerName,
    isLocked: layer.isLocked,
    isHidden: layer.isHidden,
    zIndex: layer.zIndex,
    customData: layer.customData,
  });

  object.set({
    left: layer.position.x,
    top: layer.position.y,
    angle: layer.position.rotation,
    opacity: typeof layer.opacity === "number" ? layer.opacity / 100 : object.opacity,
    visible: !layer.isHidden,
    selectable: !layer.isLocked,
    evented: !layer.isLocked,
  });

  if (layer.layerType === "text") {
    const target = object as unknown as Record<string, unknown>;
    Object.assign(target, {
      text: layer.text,
      fontFamily: layer.fontFamily,
      fontSize: layer.fontSize,
      fontWeight: layer.fontWeight,
      charSpacing: layer.letterSpacing,
      fill: layer.color,
    });
  }

  if (layer.layerType === "image" || layer.layerType === "clipart") {
    Object.assign(raw, {
      src: layer.src,
    });
  }

  if (layer.layerType === "shape") {
    Object.assign(raw, {
      shape: layer.shape,
      fill: layer.fill,
      stroke: layer.stroke,
      strokeWidth: layer.strokeWidth,
    });
  }

  return object;
};
