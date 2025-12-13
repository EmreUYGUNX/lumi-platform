/* eslint-disable unicorn/no-null */
import { createHash } from "node:crypto";

import { MediaProvider } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

import type {
  ImageLayerInput,
  PreviewLayerInput,
  PreviewQualityTier,
  TextLayerInput,
} from "@/integrations/cloudinary/cloudinary-overlay.js";
import { generateLayeredPreview } from "@/integrations/cloudinary/cloudinary-overlay.js";
import { NotFoundError, ValidationError } from "@/lib/errors.js";
import { createChildLogger } from "@/lib/logger.js";
import { getPrismaClient } from "@/lib/prisma.js";
import type { DesignArea } from "@/modules/customization/customization.types.js";

import {
  createPreviewCache,
  type CachedPreviewPayload,
  type PreviewCache,
} from "./preview.cache.js";
import type { PreviewGenerateBody, PreviewLayer, PreviewResolution } from "./preview.validators.js";

const DEFAULT_PREVIEW_TTL_SECONDS = 5 * 60;
const REFRESH_THRESHOLD_SECONDS = 60;

const stableStringify = (value: unknown): string => {
  if (value === null || value === undefined) {
    return JSON.stringify(value);
  }

  if (typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return `{${entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
    .join(",")}}`;
};

const computeDesignHash = (payload: unknown): string => {
  const normalised = stableStringify(payload);
  return createHash("sha256").update(normalised).digest("hex");
};

const buildPreviewId = (productId: string, designHash: string): string =>
  `${productId}:${designHash}`;

const normaliseResolution = (resolution: PreviewResolution): PreviewQualityTier => resolution;

const round = (value: number): number => Math.round(value);

const offsetPosition = (
  position: PreviewLayer["position"],
  area: Pick<DesignArea, "x" | "y">,
): PreviewLayer["position"] => ({
  ...position,
  x: round(position.x + area.x),
  y: round(position.y + area.y),
  width: round(position.width),
  height: round(position.height),
  rotation: position.rotation,
});

const sortLayersForHash = (layers: PreviewLayer[]): PreviewLayer[] =>
  [...layers].sort((a, b) => a.zIndex - b.zIndex || a.layerId.localeCompare(b.layerId));

export interface PreviewResult {
  previewId: string;
  previewUrl: string;
  productId: string;
  designArea: string;
  resolution: PreviewResolution;
  timestamp: string;
  cached: boolean;
}

export interface PreviewServiceOptions {
  prisma?: PrismaClient;
  cache?: PreviewCache;
  logger?: ReturnType<typeof createChildLogger>;
  ttlSeconds?: number;
}

export class PreviewService {
  private readonly prisma: PrismaClient;

  private readonly cache: PreviewCache;

  private readonly logger: ReturnType<typeof createChildLogger>;

  private readonly ttlSeconds: number;

  constructor(options: PreviewServiceOptions = {}) {
    this.prisma = options.prisma ?? getPrismaClient();
    this.cache = options.cache ?? createPreviewCache();
    this.logger = options.logger ?? createChildLogger("preview:service");
    this.ttlSeconds = options.ttlSeconds ?? DEFAULT_PREVIEW_TTL_SECONDS;
  }

  generatePreview = async (
    productId: string,
    designData: Pick<PreviewGenerateBody, "layers" | "designArea" | "resolution">,
    userId: string,
  ): Promise<PreviewResult> => {
    const { resolution } = designData;
    const orderedLayers = sortLayersForHash(designData.layers);
    const designHash = computeDesignHash({
      designArea: designData.designArea,
      resolution,
      layers: orderedLayers,
    });
    const previewId = buildPreviewId(productId, designHash);

    const cached = await this.getCachedPreview(previewId);
    if (cached) {
      return {
        previewId,
        previewUrl: cached.previewUrl,
        productId,
        designArea: cached.designArea,
        resolution,
        timestamp: cached.cachedAt,
        cached: true,
      };
    }

    const [basePublicId, designArea] = await Promise.all([
      this.resolveProductBasePublicId(productId),
      this.resolveDesignArea(productId, designData.designArea, designData.layers),
    ]);

    const overlayLayers = await this.buildOverlayLayers(orderedLayers, designArea, userId);
    const previewUrl = generateLayeredPreview({
      basePublicId,
      layers: overlayLayers,
      tier: normaliseResolution(resolution),
    });

    await this.cachePreview(previewId, previewUrl, this.ttlSeconds, {
      resolution,
      designArea: designData.designArea,
    });

    return {
      previewId,
      previewUrl,
      productId,
      designArea: designData.designArea,
      resolution,
      timestamp: new Date().toISOString(),
      cached: false,
    };
  };

  buildCloudinaryTransformation = async (
    productId: string,
    designData: Pick<PreviewGenerateBody, "layers" | "designArea" | "resolution">,
    userId: string,
  ): Promise<{
    basePublicId: string;
    layers: PreviewLayerInput[];
    resolution: PreviewQualityTier;
  }> => {
    const [basePublicId, designArea] = await Promise.all([
      this.resolveProductBasePublicId(productId),
      this.resolveDesignArea(productId, designData.designArea, designData.layers),
    ]);

    const orderedLayers = [...designData.layers].sort(
      (a, b) => a.zIndex - b.zIndex || a.layerId.localeCompare(b.layerId),
    );
    const overlayLayers = await this.buildOverlayLayers(orderedLayers, designArea, userId);

    return {
      basePublicId,
      layers: overlayLayers,
      resolution: normaliseResolution(designData.resolution),
    };
  };

  cachePreview = async (
    previewId: string,
    url: string,
    ttlSeconds: number,
    metadata: Pick<CachedPreviewPayload, "designArea" | "resolution">,
  ): Promise<void> => {
    const expiresAt = new Date(Date.now() + Math.max(1, ttlSeconds) * 1000).toISOString();
    await this.cache.set(
      previewId,
      {
        previewUrl: url,
        cachedAt: new Date().toISOString(),
        expiresAt,
        resolution: metadata.resolution,
        designArea: metadata.designArea,
      },
      ttlSeconds,
    );
  };

  getCachedPreview = async (previewId: string): Promise<CachedPreviewPayload | undefined> => {
    const cached = await this.cache.get(previewId);
    if (!cached) {
      return undefined;
    }

    const expiresAtMs = Date.parse(cached.expiresAt);
    if (Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now()) {
      return undefined;
    }

    const secondsRemaining = Number.isFinite(expiresAtMs)
      ? Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000))
      : 0;

    if (secondsRemaining > 0 && secondsRemaining <= REFRESH_THRESHOLD_SECONDS) {
      await this.cache.set(
        previewId,
        {
          ...cached,
          cachedAt: cached.cachedAt ?? new Date().toISOString(),
          expiresAt: new Date(Date.now() + this.ttlSeconds * 1000).toISOString(),
        },
        this.ttlSeconds,
      );
    }

    return cached;
  };

  invalidatePreviewCache = async (productId: string): Promise<void> => {
    await this.cache.invalidateByProduct(productId);
  };

  private resolveProductBasePublicId = async (productId: string): Promise<string> => {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, deletedAt: null },
      select: {
        id: true,
        productMedia: {
          orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
          take: 1,
          select: {
            media: {
              select: {
                assetId: true,
                provider: true,
              },
            },
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundError("Product not found.", { details: { productId } });
    }

    const media = product.productMedia[0]?.media;
    if (!media?.assetId) {
      throw new NotFoundError("Product image not found.", { details: { productId } });
    }

    if (media.provider !== MediaProvider.CLOUDINARY) {
      throw new ValidationError("Preview generation requires a Cloudinary product image.", {
        issues: [
          {
            path: "productId",
            message: "Product image provider does not support preview generation.",
          },
        ],
      });
    }

    return media.assetId;
  };

  private resolveDesignArea = async (
    productId: string,
    designAreaName: string,
    layers: PreviewLayer[],
  ): Promise<DesignArea> => {
    const customization = await this.prisma.productCustomization.findFirst({
      where: { productId },
      select: {
        enabled: true,
        designAreas: true,
        maxLayers: true,
        allowImages: true,
        allowText: true,
        allowedFonts: true,
      },
    });

    if (!customization || !customization.enabled) {
      throw new NotFoundError("Product customization is not enabled.", {
        details: { productId },
      });
    }

    if (layers.length > customization.maxLayers) {
      throw new ValidationError("Too many layers for this product.", {
        issues: [
          {
            path: "layers",
            message: `Maximum allowed layers: ${customization.maxLayers}.`,
          },
        ],
      });
    }

    if (!customization.allowImages && layers.some((layer) => layer.type === "image")) {
      throw new ValidationError("Image layers are not allowed for this product.", {
        issues: [{ path: "layers", message: "Image layers are disabled for this product." }],
      });
    }

    if (!customization.allowText && layers.some((layer) => layer.type === "text")) {
      throw new ValidationError("Text layers are not allowed for this product.", {
        issues: [{ path: "layers", message: "Text layers are disabled for this product." }],
      });
    }

    const allowedFonts = customization.allowedFonts ?? [];
    if (allowedFonts.length > 0) {
      const forbiddenFont = layers.find(
        (layer) => layer.type === "text" && !allowedFonts.includes(layer.font),
      ) as Extract<PreviewLayer, { type: "text" }> | undefined;

      if (forbiddenFont) {
        throw new ValidationError("Selected font is not allowed for this product.", {
          issues: [
            {
              path: `layers.${forbiddenFont.layerId}.font`,
              message: "Font is not in the allowed fonts list.",
            },
          ],
        });
      }
    }

    const designAreas = customization.designAreas as unknown;
    if (!Array.isArray(designAreas)) {
      throw new ValidationError("Product customization areas are misconfigured.", {
        issues: [{ path: "designArea", message: "Design area configuration is invalid." }],
      });
    }

    const match = designAreas.find(
      (entry) =>
        entry && typeof entry === "object" && (entry as { name?: unknown }).name === designAreaName,
    ) as DesignArea | undefined;

    if (!match) {
      throw new ValidationError("Unknown design area.", {
        issues: [
          { path: "designArea", message: `Design area "${designAreaName}" is not configured.` },
        ],
      });
    }

    return match;
  };

  private buildOverlayLayers = async (
    layers: PreviewLayer[],
    area: DesignArea,
    userId: string,
  ): Promise<PreviewLayerInput[]> => {
    const designIds = layers
      .filter((layer): layer is Extract<PreviewLayer, { type: "image" }> => layer.type === "image")
      .map((layer) => layer.designId)
      .filter((id): id is string => typeof id === "string" && id.length > 0);

    const designs =
      designIds.length > 0
        ? await this.prisma.customerDesign.findMany({
            where: {
              id: { in: designIds },
              deletedAt: null,
              OR: [{ userId }, { isPublic: true }],
            },
            select: { id: true, publicId: true },
          })
        : [];

    const publicIdByDesignId = new Map(designs.map((design) => [design.id, design.publicId]));

    const overlays: PreviewLayerInput[] = [];

    layers.forEach((layer) => {
      if (layer.type === "image") {
        const publicId =
          layer.publicId ?? (layer.designId ? publicIdByDesignId.get(layer.designId) : undefined);

        if (!publicId) {
          throw new NotFoundError("Design asset not found for preview layer.", {
            details: { layerId: layer.layerId },
          });
        }

        overlays.push({
          type: "image",
          publicId,
          position: offsetPosition(layer.position, area),
          transform: {
            opacity: layer.opacity,
            effects: layer.effects,
          },
        } satisfies ImageLayerInput);
        return;
      }

      overlays.push({
        type: "text",
        text: layer.text,
        position: offsetPosition(layer.position, area),
        style: {
          fontFamily: layer.font,
          fontSize: layer.fontSize,
          fontWeight: layer.fontWeight,
          letterSpacing: layer.letterSpacing,
          color: layer.color,
          opacity: layer.opacity,
          effects: layer.effects,
        },
      } satisfies TextLayerInput);
    });

    return overlays;
  };
}
