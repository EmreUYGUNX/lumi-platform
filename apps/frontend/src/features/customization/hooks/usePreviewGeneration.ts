"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type * as fabric from "fabric";
import { z } from "zod";

import { apiClient } from "@/lib/api-client";

export type PreviewResolution = "draft" | "web" | "production";

export interface PreviewGenerateResult {
  previewId: string;
  previewUrl: string;
  productId: string;
  designArea: string;
  resolution: PreviewResolution;
  timestamp: string;
  cached: boolean;
}

export interface PreviewLayerPosition {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

export interface PreviewLayerEffects {
  shadow?: {
    azimuth?: number;
    elevation?: number;
  };
  outline?: {
    width: number;
    color?: string;
  };
  blur?: number;
  brightness?: number;
  contrast?: number;
}

export interface PreviewLayerBase {
  layerId: string;
  zIndex: number;
  position: PreviewLayerPosition;
  opacity?: number;
  effects?: PreviewLayerEffects;
}

export interface PreviewImageLayer extends PreviewLayerBase {
  type: "image";
  designId?: string;
  publicId?: string;
}

export interface PreviewTextLayer extends PreviewLayerBase {
  type: "text";
  text: string;
  font: string;
  fontSize: number;
  fontWeight?: string | number;
  letterSpacing?: number;
  color?: string;
}

export type PreviewLayer = PreviewImageLayer | PreviewTextLayer;

export interface PreviewGenerateDesignData {
  productId: string;
  designArea: string;
  canvas?: fabric.Canvas;
  resolution?: PreviewResolution;
}

export interface UsePreviewGenerationOptions {
  debounceMs?: number;
  cacheMaxEntries?: number;
}

export interface PreviewGenerationControls {
  previewUrl: string | undefined;
  isGenerating: boolean;
  error: Error | undefined;
  requestPreview: (designData: PreviewGenerateDesignData, resolution?: PreviewResolution) => void;
  generatePreview: (
    designData: PreviewGenerateDesignData,
    forceResolution?: PreviewResolution,
  ) => Promise<void>;
  retry: (resolution?: PreviewResolution) => void;
  cancelPending: () => void;
}

const DEFAULT_DEBOUNCE_MS = 1000;
const DEFAULT_CACHE_MAX_ENTRIES = 50;

const previewGenerateSchema = z
  .object({
    previewId: z.string().min(1),
    previewUrl: z.string().url(),
    productId: z.string().min(1),
    designArea: z.string().min(1),
    resolution: z.enum(["draft", "web", "production"]),
    timestamp: z.string().min(1),
    cached: z.boolean(),
  })
  .strip();

const clampNumber = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const round = (value: number): number => Math.round(value);

const isAbortError = (error: unknown): boolean => {
  const name = error instanceof DOMException || error instanceof Error ? error.name : undefined;
  return name === "AbortError";
};

const stableStringify = (value: unknown): string => {
  if (value === undefined) {
    return '"__undefined__"';
  }

  if (value === null) {
    return "null";
  }

  if (typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));

  return `{${entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
    .join(",")}}`;
};

const HASH_MODULUS = 2n ** 64n;
const HASH_PRIME = 1_099_511_628_211n;
const HASH_OFFSET_BASIS = 14_695_981_039_346_656_037n;

const hashSignature64 = (input: string): string => {
  let hash = HASH_OFFSET_BASIS;

  [...input].forEach((character) => {
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined) return;
    hash = (hash * HASH_PRIME + BigInt(codePoint)) % HASH_MODULUS;
  });

  return hash.toString(16).padStart(16, "0");
};

const normalizeHexColor = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  const match = /^#?([\da-f]{6})$/i.exec(trimmed);
  if (!match) return undefined;
  return `#${match[1]}`;
};

const readBoolean = (value: unknown): boolean =>
  typeof value === "boolean" ? value : Boolean(value);

const readNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const readString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value : undefined;

const resolveLayerId = (raw: Record<string, unknown>, fallback: string): string =>
  typeof raw.layerId === "string" && raw.layerId.trim().length > 0 ? raw.layerId : fallback;

const resolvePosition = (object: fabric.Object): PreviewLayerPosition | undefined => {
  const x = readNumber(object.left) ?? 0;
  const y = readNumber(object.top) ?? 0;
  const width = object.getScaledWidth();
  const height = object.getScaledHeight();
  const rotation = readNumber(object.angle) ?? 0;

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return undefined;
  }

  return {
    x: clampNumber(round(x), 0, 100_000),
    y: clampNumber(round(y), 0, 100_000),
    width: clampNumber(round(width), 1, 100_000),
    height: clampNumber(round(height), 1, 100_000),
    rotation: clampNumber(round(rotation), -360, 360),
  };
};

const resolveOpacity = (object: fabric.Object): number | undefined => {
  const opacity = readNumber(object.opacity);
  if (opacity === undefined) return undefined;
  return clampNumber(round(opacity * 100), 0, 100);
};

const readImageEffects = (object: fabric.Object): PreviewLayerEffects | undefined => {
  const raw = object as unknown as { filters?: unknown };
  if (!raw.filters || !Array.isArray(raw.filters)) return undefined;

  const entries = raw.filters.filter(Boolean) as unknown as Record<string, unknown>[];

  const findByType = (type: string) =>
    entries.find((filter) => typeof filter.type === "string" && filter.type === type);

  const brightnessFilter = findByType("Brightness");
  const contrastFilter = findByType("Contrast");
  const blurFilter = findByType("Blur");

  const brightnessValue = readNumber(brightnessFilter?.brightness);
  const contrastValue = readNumber(contrastFilter?.contrast);
  const blurValue = readNumber(blurFilter?.blur);

  const brightness =
    brightnessValue === undefined
      ? undefined
      : clampNumber(round(brightnessValue * 100), -100, 100);
  const contrast =
    contrastValue === undefined ? undefined : clampNumber(round(contrastValue * 100), -100, 100);
  const blur =
    blurValue === undefined ? undefined : clampNumber(round(blurValue * 10_000), 0, 2000);

  const effects: PreviewLayerEffects = {};
  if (brightness !== undefined && brightness !== 0) effects.brightness = brightness;
  if (contrast !== undefined && contrast !== 0) effects.contrast = contrast;
  if (blur !== undefined && blur !== 0) effects.blur = blur;

  return Object.keys(effects).length > 0 ? effects : undefined;
};

const readTextEffects = (object: fabric.Object): PreviewLayerEffects | undefined => {
  const raw = object as unknown as {
    stroke?: unknown;
    strokeWidth?: unknown;
    shadow?: unknown;
  };

  const strokeWidth = readNumber(raw.strokeWidth);
  const strokeColor = normalizeHexColor(raw.stroke);

  const outline =
    typeof strokeWidth === "number" && strokeWidth > 0
      ? {
          width: clampNumber(round(strokeWidth), 1, 100),
          color: strokeColor,
        }
      : undefined;

  const shadow = raw.shadow as Partial<{
    offsetX: number;
    offsetY: number;
    blur: number;
    color: string;
  }>;

  const offsetX = readNumber(shadow?.offsetX) ?? 0;
  const offsetY = readNumber(shadow?.offsetY) ?? 0;
  const distance = Math.hypot(offsetX, offsetY);

  const shadowEffect =
    distance > 0
      ? {
          azimuth: clampNumber(
            round(((Math.atan2(offsetY, offsetX) * 180) / Math.PI + 360) % 360),
            0,
            360,
          ),
          elevation: clampNumber(round(distance), 0, 100),
        }
      : undefined;

  const effects: PreviewLayerEffects = {};
  if (outline) effects.outline = outline;
  if (shadowEffect) effects.shadow = shadowEffect;

  return Object.keys(effects).length > 0 ? effects : undefined;
};

const resolveTextPayload = (
  object: fabric.Object,
): Omit<PreviewTextLayer, keyof PreviewLayerBase> | undefined => {
  const raw = object as unknown as Record<string, unknown>;
  const text = readString(raw.text)?.trim();
  if (!text) return undefined;

  const font = readString(raw.fontFamily) ?? "Inter";
  const fontSize = readNumber(raw.fontSize) ?? 24;
  const fontWeight =
    typeof raw.fontWeight === "string" || typeof raw.fontWeight === "number"
      ? raw.fontWeight
      : undefined;
  const letterSpacingRaw = readNumber(raw.charSpacing);
  const letterSpacing =
    letterSpacingRaw === undefined ? undefined : clampNumber(round(letterSpacingRaw), -100, 100);
  const color = normalizeHexColor(raw.fill);

  return {
    type: "text",
    text,
    font,
    fontSize: clampNumber(round(fontSize), 1, 512),
    fontWeight,
    letterSpacing,
    color,
  };
};

const resolveImagePayload = (
  object: fabric.Object,
): Omit<PreviewImageLayer, keyof PreviewLayerBase> | undefined => {
  const raw = object as unknown as Record<string, unknown>;
  const designId = readString(raw.designId);
  const publicId = readString(raw.publicId);
  if (!designId && !publicId) return undefined;

  return {
    type: "image",
    designId,
    publicId,
  };
};

export const serializePreviewLayers = (canvas: fabric.Canvas): PreviewLayer[] => {
  const objects = canvas.getObjects();
  const previewLayers: PreviewLayer[] = [];

  objects.forEach((object, index) => {
    const raw = object as unknown as Record<string, unknown>;
    const hidden = readBoolean(raw.isHidden) || object.visible === false;
    if (hidden) return;

    const layerType = typeof raw.layerType === "string" ? raw.layerType : undefined;
    const fallbackId = `layer_${index}`;
    const layerId = resolveLayerId(raw, fallbackId);
    const position = resolvePosition(object);
    if (!position) return;

    const opacity = resolveOpacity(object);

    if (layerType === "text" || (typeof object.type === "string" && object.type.includes("text"))) {
      const textPayload = resolveTextPayload(object);
      if (!textPayload) return;
      const effects = readTextEffects(object);
      previewLayers.push({
        layerId,
        zIndex: index,
        position,
        opacity,
        effects,
        ...textPayload,
      });
      return;
    }

    if (
      layerType === "image" ||
      (typeof object.type === "string" && object.type.includes("image"))
    ) {
      const imagePayload = resolveImagePayload(object);
      if (!imagePayload) return;
      const effects = readImageEffects(object);
      previewLayers.push({
        layerId,
        zIndex: index,
        position,
        opacity,
        effects,
        ...imagePayload,
      });
    }
  });

  return previewLayers;
};

const rememberCacheEntry = (
  cache: Map<string, string>,
  key: string,
  value: string,
  maxEntries: number,
): void => {
  if (cache.has(key)) {
    cache.delete(key);
  }
  cache.set(key, value);

  while (cache.size > maxEntries) {
    const oldest = cache.keys().next().value as string | undefined;
    if (!oldest) return;
    cache.delete(oldest);
  }
};

const buildCacheKey = (payload: {
  productId: string;
  designArea: string;
  resolution: PreviewResolution;
  layers: PreviewLayer[];
}): string => {
  const orderedLayers = [...payload.layers].sort(
    (a, b) => a.zIndex - b.zIndex || a.layerId.localeCompare(b.layerId),
  );

  const signature = stableStringify({
    productId: payload.productId,
    designArea: payload.designArea,
    resolution: payload.resolution,
    layers: orderedLayers,
  });

  return `${payload.productId}:${hashSignature64(signature)}`;
};

export const usePreviewGeneration = (
  options: UsePreviewGenerationOptions = {},
): PreviewGenerationControls => {
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const cacheMaxEntries = options.cacheMaxEntries ?? DEFAULT_CACHE_MAX_ENTRIES;

  const [previewUrl, setPreviewUrl] = useState<string | undefined>();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<Error | undefined>();

  const cacheRef = useRef<Map<string, string>>(new Map());
  const debounceRef = useRef<number | undefined>();
  const abortRef = useRef<AbortController | undefined>();
  const requestIdRef = useRef(0);
  const lastRequestRef = useRef<PreviewGenerateDesignData | undefined>();

  const cancelPending = useCallback(() => {
    if (debounceRef.current !== undefined) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = undefined;
    }

    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = undefined;
    }
  }, []);

  useEffect(() => cancelPending, [cancelPending]);

  const generate = useCallback(
    async (designData: PreviewGenerateDesignData, forceResolution?: PreviewResolution) => {
      if (!designData.productId || !designData.designArea || !designData.canvas) {
        return;
      }

      cancelPending();
      lastRequestRef.current = designData;

      const resolution = forceResolution ?? designData.resolution ?? "web";
      const layers = serializePreviewLayers(designData.canvas);

      if (layers.length === 0) {
        setPreviewUrl(undefined);
        setError(undefined);
        return;
      }

      const cacheKey = buildCacheKey({ ...designData, resolution, layers });
      const cachedUrl = cacheRef.current.get(cacheKey);
      if (cachedUrl) {
        rememberCacheEntry(cacheRef.current, cacheKey, cachedUrl, cacheMaxEntries);
        setPreviewUrl(cachedUrl);
        setError(undefined);
        return;
      }

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      const controller = new AbortController();
      abortRef.current = controller;

      setIsGenerating(true);
      setError(undefined);

      try {
        const response = await apiClient.post("/previews/generate", {
          body: {
            productId: designData.productId,
            designArea: designData.designArea,
            resolution,
            layers,
          },
          dataSchema: previewGenerateSchema,
          signal: controller.signal,
          retry: 2,
        });

        if (requestId !== requestIdRef.current) {
          return;
        }

        rememberCacheEntry(cacheRef.current, cacheKey, response.data.previewUrl, cacheMaxEntries);
        setPreviewUrl(response.data.previewUrl);
      } catch (error_) {
        if (requestId !== requestIdRef.current) {
          return;
        }

        if (isAbortError(error_)) {
          return;
        }

        setError(error_ instanceof Error ? error_ : new Error("Preview generation failed."));
      } finally {
        if (requestId === requestIdRef.current) {
          setIsGenerating(false);
        }

        if (abortRef.current === controller) {
          abortRef.current = undefined;
        }
      }
    },
    [cacheMaxEntries, cancelPending],
  );

  const requestPreview = useCallback(
    (designData: PreviewGenerateDesignData, resolution: PreviewResolution = "draft") => {
      if (!designData.productId || !designData.designArea || !designData.canvas) {
        return;
      }

      lastRequestRef.current = designData;
      cancelPending();

      debounceRef.current = window.setTimeout(() => {
        generate(designData, resolution).catch(() => {});
      }, debounceMs);
    },
    [cancelPending, debounceMs, generate],
  );

  const retry = useCallback(
    (resolution?: PreviewResolution) => {
      const last = lastRequestRef.current;
      if (!last) return;
      generate(last, resolution).catch(() => {});
    },
    [generate],
  );

  return useMemo(
    () => ({
      previewUrl,
      isGenerating,
      error,
      requestPreview,
      generatePreview: generate,
      retry,
      cancelPending,
    }),
    [cancelPending, error, generate, isGenerating, previewUrl, requestPreview, retry],
  );
};
