import type { MediaAsset, Prisma, PrismaClient } from "@prisma/client";

import { createChildLogger } from "@/lib/logger.js";
import { getPrismaClient } from "@/lib/prisma.js";
import { MediaRepository } from "@/modules/media/media.repository.js";

import type { CloudinaryDerivedAsset, CloudinaryWebhookEvent } from "./cloudinary.types.js";

const MODERATION_REJECTED_STATUSES = new Set(["rejected", "blocked", "pending_review"]);

type JsonMetadata = Prisma.InputJsonValue;

const normaliseJsonValue = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return { ...(value as Record<string, unknown>) };
};

const mergeMetadata = (current: unknown, next: Record<string, unknown>): JsonMetadata => {
  const base = normaliseJsonValue(current);
  return {
    ...base,
    ...next,
  } as JsonMetadata;
};

const normaliseTransformationKey = (value: string): string =>
  value.replaceAll(/[^a-z0-9:_-]+/giu, "-");

const toTransformationMap = (entries: CloudinaryDerivedAsset[] = []): Record<string, unknown> => {
  const map: Record<string, unknown> = {};

  entries.forEach((entry) => {
    if (!entry) {
      return;
    }

    const key = entry.transformation ?? entry.id;
    if (!key) {
      return;
    }

    const safeKey = normaliseTransformationKey(key);

    // eslint-disable-next-line security/detect-object-injection -- keys are normalised to a safe character set.
    map[safeKey] = {
      url: entry.url ?? entry.secure_url,
      secureUrl: entry.secure_url ?? entry.url,
      bytes: entry.bytes,
      width: entry.width,
      height: entry.height,
      format: entry.format,
    };
  });

  return map;
};

const buildUploadUpdatePayload = (
  asset: MediaAsset,
  event: CloudinaryWebhookEvent,
): Prisma.MediaAssetUpdateInput => {
  const { payload } = event;

  return {
    url: payload.url ?? asset.url,
    secureUrl: payload.secure_url ?? payload.url ?? asset.secureUrl,
    bytes: payload.bytes ?? asset.bytes,
    format: payload.format ?? asset.format,
    width: payload.width ?? asset.width ?? undefined,
    height: payload.height ?? asset.height ?? undefined,
    version: payload.version ?? asset.version,
    resourceType: payload.resource_type ?? asset.resourceType,
    type: payload.type ?? asset.type,
    tags: Array.isArray(payload.tags) && payload.tags.length > 0 ? payload.tags : asset.tags,
    folder: payload.folder ?? asset.folder,
    metadata: mergeMetadata(asset.metadata, {
      webhook: {
        lastEventId: event.id,
        lastEventType: event.type,
        lastEventAt: new Date(event.timestamp * 1000).toISOString(),
      },
      context: payload.context ?? undefined,
      exif: payload.metadata ?? undefined,
    }),
  };
};

export interface CloudinaryWebhookProcessorOptions {
  prisma?: PrismaClient;
  repository?: MediaRepository;
  logger?: ReturnType<typeof createChildLogger>;
}

export class CloudinaryWebhookProcessor {
  private readonly repository: MediaRepository;

  private readonly logger: ReturnType<typeof createChildLogger>;

  constructor(options: CloudinaryWebhookProcessorOptions = {}) {
    const prisma = options.prisma ?? getPrismaClient();
    this.repository = options.repository ?? new MediaRepository(prisma);
    this.logger = options.logger ?? createChildLogger("media:webhook:processor");
  }

  async process(event: CloudinaryWebhookEvent): Promise<void> {
    const type = (event.type ?? "").toLowerCase();

    this.logger.info("Processing Cloudinary webhook event", {
      eventId: event.id,
      type,
      timestamp: event.timestamp,
      attempt: event.attempt,
      publicId: event.payload.public_id,
    });

    const handler = this.resolveHandler(type);
    await handler(event);
  }

  private resolveHandler(type: string) {
    switch (type) {
      case "upload":
      case "updateresult": {
        return this.handleUpload.bind(this);
      }
      case "delete":
      case "destroy": {
        return this.handleDelete.bind(this);
      }
      case "derived":
      case "transformation":
      case "eager-transformation": {
        return this.handleTransformation.bind(this);
      }
      case "moderation":
      case "ai_moderation": {
        return this.handleModeration.bind(this);
      }
      default: {
        return async (event: CloudinaryWebhookEvent) => {
          this.logger.warn("Unhandled Cloudinary webhook event type", {
            eventId: event.id,
            type,
          });
        };
      }
    }
  }

  private async handleUpload(event: CloudinaryWebhookEvent): Promise<void> {
    const publicId = event.payload.public_id;
    if (!publicId) {
      this.logger.warn("Upload webhook missing public_id", { eventId: event.id });
      return;
    }

    const asset = await this.repository.findByPublicId(publicId);
    if (!asset) {
      this.logger.warn("Upload webhook referenced unknown asset", {
        publicId,
        eventId: event.id,
      });
      return;
    }

    await this.repository.updateMetadata(asset.id, buildUploadUpdatePayload(asset, event));
  }

  private async handleDelete(event: CloudinaryWebhookEvent): Promise<void> {
    const publicId = event.payload.public_id;
    if (!publicId) {
      this.logger.warn("Delete webhook missing public_id", { eventId: event.id });
      return;
    }

    const asset = await this.repository.findByPublicId(publicId);
    if (!asset) {
      this.logger.warn("Delete webhook referenced unknown asset", { publicId, eventId: event.id });
      return;
    }

    if (!asset.deletedAt) {
      await this.repository.softDeleteAsset(asset.id);
    }

    await this.repository.updateMetadata(asset.id, {
      metadata: mergeMetadata(asset.metadata, {
        webhook: {
          lastDeletionId: event.id,
          deletedAt: new Date().toISOString(),
        },
      }),
    });
  }

  private async handleTransformation(event: CloudinaryWebhookEvent): Promise<void> {
    const publicId = event.payload.public_id;
    if (!publicId) {
      this.logger.warn("Transformation webhook missing public_id", { eventId: event.id });
      return;
    }

    const asset = await this.repository.findByPublicId(publicId);
    if (!asset) {
      this.logger.warn("Transformation webhook referenced unknown asset", {
        publicId,
        eventId: event.id,
      });
      return;
    }

    const derivedAssets = Array.isArray(event.payload.derived)
      ? event.payload.derived
      : ([] as CloudinaryDerivedAsset[]);

    const derivedMap = toTransformationMap(derivedAssets);

    await this.repository.updateMetadata(asset.id, {
      metadata: mergeMetadata(asset.metadata, {
        derived: derivedMap,
        webhook: {
          lastTransformationId: event.id,
          lastTransformationAt: new Date(event.timestamp * 1000).toISOString(),
        },
      }),
    });
  }

  private async handleModeration(event: CloudinaryWebhookEvent): Promise<void> {
    const publicId = event.payload.public_id;
    if (!publicId) {
      this.logger.warn("Moderation webhook missing public_id", { eventId: event.id });
      return;
    }

    const asset = await this.repository.findByPublicId(publicId);
    if (!asset) {
      this.logger.warn("Moderation webhook referenced unknown asset", {
        publicId,
        eventId: event.id,
      });
      return;
    }

    const status = (event.payload.moderation_status ?? "").toLowerCase();

    await this.repository.updateMetadata(asset.id, {
      metadata: mergeMetadata(asset.metadata, {
        moderation: {
          status: event.payload.moderation_status,
          response: event.payload.moderation_response,
          lastUpdatedAt: new Date().toISOString(),
          lastEventId: event.id,
        },
      }),
    });

    if (MODERATION_REJECTED_STATUSES.has(status) && !asset.deletedAt) {
      await this.repository.softDeleteAsset(asset.id);
      this.logger.warn("Media asset soft deleted due to moderation status", {
        assetId: asset.id,
        status,
      });
    }
  }
}
