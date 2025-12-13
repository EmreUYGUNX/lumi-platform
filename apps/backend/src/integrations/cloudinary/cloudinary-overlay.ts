import type { UploadApiOptions } from "cloudinary";

import { getCloudinaryClient } from "./cloudinary.client.js";

export type PreviewQualityTier = "draft" | "web" | "production";

export interface LayerPosition {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

export interface LayerEffects {
  /**
   * Cloudinary example: e_shadow:azimuth_315,elevation_45
   */
  shadow?: {
    azimuth?: number;
    elevation?: number;
  };
  /**
   * Cloudinary example: co_rgb:000000,e_outline:5
   */
  outline?: {
    width: number;
    color?: string;
  };
  blur?: number;
  brightness?: number;
  contrast?: number;
}

export interface TextOverlayStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight?: number | string;
  letterSpacing?: number;
  color?: string;
  opacity?: number;
  effects?: LayerEffects;
}

export interface ImageOverlayTransform {
  opacity?: number;
  effects?: LayerEffects;
}

export interface ImageLayerInput {
  type: "image";
  publicId: string;
  position: LayerPosition;
  transform?: ImageOverlayTransform;
}

export interface TextLayerInput {
  type: "text";
  text: string;
  position: LayerPosition;
  style: TextOverlayStyle;
}

export type PreviewLayerInput = ImageLayerInput | TextLayerInput;

export interface LayeredPreviewConfig {
  basePublicId: string;
  layers: PreviewLayerInput[];
  tier?: PreviewQualityTier;
  secure?: boolean;
}

type TransformationDefinition = Exclude<NonNullable<UploadApiOptions["transformation"]>, string>;
type TransformationStep = Record<string, unknown>;

const DRAFT_PRESET = { width: 800, quality: "60", format: "webp", fetchFormat: "webp" } as const;
const WEB_PRESET = { width: 1200, quality: "80", format: "webp", fetchFormat: "webp" } as const;
const PRODUCTION_PRESET = {
  width: 5000,
  quality: "100",
  format: "png",
  fetchFormat: "png",
} as const;

const getQualityPreset = (tier: PreviewQualityTier) => {
  switch (tier) {
    case "draft": {
      return DRAFT_PRESET;
    }
    case "web": {
      return WEB_PRESET;
    }
    case "production": {
      return PRODUCTION_PRESET;
    }
    default: {
      return WEB_PRESET;
    }
  }
};

const normaliseHexColor = (value?: string): string | undefined => {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  const withoutHash = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
  const upper = withoutHash.toUpperCase();
  return /^[\dA-F]{6}$/.test(upper) ? upper : undefined;
};

const clampNumber = (value: number | undefined, min: number, max: number): number | undefined => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.min(max, Math.max(min, value));
};

const buildEffectsTransformation = (effects?: LayerEffects): string | undefined => {
  if (!effects) {
    return undefined;
  }

  const segments: string[] = [];

  const shadowAzimuth = clampNumber(effects.shadow?.azimuth, 0, 360);
  const shadowElevation = clampNumber(effects.shadow?.elevation, -100, 100);
  if (shadowAzimuth !== undefined) {
    segments.push(`e_shadow:azimuth_${Math.round(shadowAzimuth)}`);
  }
  if (shadowElevation !== undefined) {
    segments.push(`elevation_${Math.round(shadowElevation)}`);
  }

  const outlineWidth = clampNumber(effects.outline?.width, 0, 100);
  if (outlineWidth !== undefined && outlineWidth > 0) {
    const outlineColor = normaliseHexColor(effects.outline?.color) ?? "000000";
    segments.push(`co_rgb:${outlineColor}`, `e_outline:${Math.round(outlineWidth)}`);
  }

  const blur = clampNumber(effects.blur, 0, 2000);
  if (blur !== undefined && blur > 0) {
    segments.push(`e_blur:${Math.round(blur)}`);
  }

  const brightness = clampNumber(effects.brightness, -100, 100);
  if (brightness !== undefined && brightness !== 0) {
    segments.push(`e_brightness:${Math.round(brightness)}`);
  }

  const contrast = clampNumber(effects.contrast, -100, 100);
  if (contrast !== undefined && contrast !== 0) {
    segments.push(`e_contrast:${Math.round(contrast)}`);
  }

  return segments.length > 0 ? segments.join(",") : undefined;
};

export const applyTextOverlay = (
  text: string,
  style: TextOverlayStyle,
  position: LayerPosition,
): TransformationStep => {
  const rawEffects = buildEffectsTransformation(style.effects);

  const overlay: Record<string, unknown> = {
    text,
    font_family: style.fontFamily,
    font_size: Math.round(style.fontSize),
  };

  if (style.fontWeight !== undefined) {
    overlay.font_weight = style.fontWeight;
  }

  if (style.letterSpacing !== undefined) {
    overlay.letter_spacing = Math.round(style.letterSpacing);
  }

  const transformation: TransformationStep = {
    overlay,
    x: Math.round(position.x),
    y: Math.round(position.y),
    gravity: "north_west",
    flags: "layer_apply",
  };

  if (style.color) {
    transformation.color = style.color;
  }

  if (style.opacity !== undefined) {
    transformation.opacity = Math.round(style.opacity);
  }

  if (position.rotation !== undefined) {
    transformation.angle = Math.round(position.rotation);
  }

  if (rawEffects) {
    transformation.raw_transformation = rawEffects;
  }

  return transformation;
};

export const applyImageOverlay = (
  imageId: string,
  transform: ImageOverlayTransform | undefined,
  position: LayerPosition,
): TransformationStep => {
  const rawEffects = buildEffectsTransformation(transform?.effects);

  const transformation: TransformationStep = {
    overlay: imageId,
    width: Math.round(position.width),
    height: Math.round(position.height),
    x: Math.round(position.x),
    y: Math.round(position.y),
    gravity: "north_west",
    flags: "layer_apply",
  };

  if (position.rotation !== undefined) {
    transformation.angle = Math.round(position.rotation);
  }

  if (transform?.opacity !== undefined) {
    transformation.opacity = Math.round(transform.opacity);
  }

  if (rawEffects) {
    transformation.raw_transformation = rawEffects;
  }

  return transformation;
};

export const compositeMultipleLayers = (layers: TransformationStep[]): TransformationStep[] =>
  layers;

const buildOutputOptimizationStep = (tier: PreviewQualityTier): TransformationStep => {
  const preset = getQualityPreset(tier);
  return {
    width: preset.width,
    crop: "limit",
    quality: preset.quality,
    format: preset.format,
    fetch_format: preset.fetchFormat,
  };
};

export const generateLayeredPreview = (config: LayeredPreviewConfig): string => {
  const cloudinary = getCloudinaryClient();
  const tier = config.tier ?? "web";

  const layers = compositeMultipleLayers(
    config.layers.map((layer) => {
      if (layer.type === "text") {
        return applyTextOverlay(layer.text, layer.style, layer.position);
      }

      return applyImageOverlay(layer.publicId, layer.transform, layer.position);
    }),
  );

  const transformation = [...layers, buildOutputOptimizationStep(tier)] as TransformationDefinition;

  return cloudinary.generateImageUrl(config.basePublicId, {
    transformation,
    secure: config.secure,
  });
};

export const optimizeForWeb = (url: string, tier: PreviewQualityTier = "web"): string => {
  const preset = getQualityPreset(tier);
  const injection = `f_${preset.format},q_${preset.quality},w_${preset.width},c_limit`;

  const [prefix, rest] = url.split("/upload/");
  if (!rest) {
    return url;
  }

  if (rest.startsWith(`${injection}/`)) {
    return url;
  }

  return `${prefix}/upload/${injection}/${rest}`;
};
