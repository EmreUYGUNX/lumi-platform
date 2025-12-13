import { performance } from "node:perf_hooks";

import type { CustomerDesign, Prisma, PrismaClient } from "@prisma/client";

import { ApiError } from "@/errors/api-error.js";
import {
  type CloudinaryClient,
  getCloudinaryClient,
} from "@/integrations/cloudinary/cloudinary.client.js";
import { createChildLogger } from "@/lib/logger.js";
import { getPrismaClient } from "@/lib/prisma.js";
import type { PaginatedResult } from "@/lib/repository/base.repository.js";
import { MediaScanService, sanitizeFilename } from "@/modules/media/media.security.js";

import { DesignRepository, type DesignListFilters } from "./design.repository.js";
import type { DesignListQuery, DesignUpdateBody, DesignUploadBody } from "./design.validators.js";
import { sanitizeSvg } from "./svg-sanitizer.js";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const COMPRESSION_THRESHOLD_BYTES = 2 * 1024 * 1024;
const RETENTION_DAYS = 30;
const MAX_DIMENSION_PX = 2048;

const MIME_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/svg+xml": "svg",
} as const;

type SupportedMime = keyof typeof MIME_EXTENSION;

const isSupportedMime = (mimeType: string): mimeType is SupportedMime =>
  Object.prototype.hasOwnProperty.call(MIME_EXTENSION, mimeType);

const extractDominantColor = (colors: unknown): string | undefined => {
  if (!Array.isArray(colors) || colors.length === 0) {
    return undefined;
  }

  const first = colors[0];
  if (!Array.isArray(first) || typeof first[0] !== "string") {
    return undefined;
  }

  return first[0];
};

export interface PreparedDesignFile {
  originalName: string;
  mimeType: string;
  size: number;
  buffer: Buffer;
}

export interface CustomerDesignView {
  id: string;
  publicId: string;
  url: string;
  secureUrl: string;
  thumbnailUrl: string;
  format: string;
  width?: number | null;
  height?: number | null;
  bytes: number;
  tags: string[];
  userId: string;
  isPublic: boolean;
  usageCount: number;
  viewCount: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface DesignServiceOptions {
  prisma?: PrismaClient;
  repository?: DesignRepository;
  cloudinary?: CloudinaryClient;
  logger?: ReturnType<typeof createChildLogger>;
  scanService?: MediaScanService;
}

const mergeMetadata = (
  current: CustomerDesign["metadata"] | undefined,
  patch: Record<string, unknown> | undefined,
): Prisma.InputJsonValue | undefined => {
  if (!patch) {
    return current ?? undefined;
  }

  const base =
    current && typeof current === "object" && !Array.isArray(current)
      ? (current as Record<string, unknown>)
      : {};

  return { ...base, ...patch } as Prisma.InputJsonValue;
};

const buildTags = (query: DesignListQuery): string[] => {
  const tags = new Set<string>();
  query.tags?.forEach((tag) => tags.add(tag));
  if (query.tag) {
    tags.add(query.tag);
  }
  return [...tags];
};

interface SharpPipeline {
  rotate: () => SharpPipeline;
  resize: (options: {
    width: number;
    height: number;
    fit: "inside";
    withoutEnlargement: boolean;
  }) => SharpPipeline;
  jpeg: (options: { quality: number; mozjpeg: boolean }) => SharpPipeline;
  png: (options: {
    compressionLevel: number;
    adaptiveFiltering: boolean;
    palette?: boolean;
    quality?: number;
  }) => SharpPipeline;
  toBuffer: () => Promise<Buffer>;
}

type SharpFactory = (input: Buffer) => SharpPipeline;

const validateDesignFilePayload = (file: PreparedDesignFile): void => {
  if (!file?.buffer || file.buffer.length === 0) {
    throw new ApiError("Design file is required.", { status: 400, code: "NO_FILE" });
  }

  if (!isSupportedMime(file.mimeType)) {
    throw new ApiError("Unsupported design file type.", {
      status: 415,
      code: "INVALID_MIME_TYPE",
      details: [
        {
          field: "file",
          message: `Supported types: ${Object.keys(MIME_EXTENSION).join(", ")}`,
        },
      ],
    });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ApiError("Design file is too large.", {
      status: 413,
      code: "PAYLOAD_TOO_LARGE",
      details: [
        {
          field: "file",
          message: `Maximum allowed size is ${MAX_UPLOAD_BYTES} bytes.`,
        },
      ],
    });
  }
};

const sanitizeSvgIfNeeded = (file: PreparedDesignFile): PreparedDesignFile => {
  if (file.mimeType !== "image/svg+xml") {
    return file;
  }

  const input = file.buffer.toString("utf8");
  const sanitized = sanitizeSvg(input);
  if (!sanitized) {
    throw new ApiError("SVG upload contains no usable content after sanitization.", {
      status: 422,
      code: "INVALID_SVG",
    });
  }

  const outputBuffer = Buffer.from(sanitized, "utf8");
  return {
    ...file,
    buffer: outputBuffer,
    size: outputBuffer.length,
  };
};

const buildUploadMetadata = (
  file: PreparedDesignFile,
  body: DesignUploadBody,
): Record<string, string> => {
  const metadata: Record<string, string> = { originalFilename: file.originalName };

  if (body.uploadedFrom) {
    metadata.uploadedFrom = body.uploadedFrom;
  }

  if (body.backgroundColor) {
    metadata.backgroundColor = body.backgroundColor;
  }

  if (body.metadata) {
    Object.assign(metadata, body.metadata);
  }

  return metadata;
};

const pickSmallestBuffer = (buffers: Buffer[]): Buffer | undefined => {
  let smallest: Buffer | undefined;

  // eslint-disable-next-line no-restricted-syntax
  for (const buffer of buffers) {
    if (!smallest || buffer.length < smallest.length) {
      smallest = buffer;
    }
  }

  return smallest;
};

const createCompressionPipeline = (sharp: SharpFactory, buffer: Buffer) =>
  sharp(buffer).rotate().resize({
    width: MAX_DIMENSION_PX,
    height: MAX_DIMENSION_PX,
    fit: "inside",
    withoutEnlargement: true,
  });

const compressJpeg = async (sharp: SharpFactory, buffer: Buffer): Promise<Buffer[]> => {
  const results: Buffer[] = [];

  // eslint-disable-next-line no-restricted-syntax
  for (const quality of [85, 78, 70, 62] as const) {
    // eslint-disable-next-line no-await-in-loop -- sequential attempts ensure predictable outcomes.
    const encoded = await createCompressionPipeline(sharp, buffer)
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();

    results.push(encoded);

    if (encoded.length <= COMPRESSION_THRESHOLD_BYTES) {
      break;
    }
  }

  return results;
};

const compressPng = async (sharp: SharpFactory, buffer: Buffer): Promise<Buffer[]> => {
  const results: Buffer[] = [];

  const lossless = await createCompressionPipeline(sharp, buffer)
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
  results.push(lossless);

  if (lossless.length <= COMPRESSION_THRESHOLD_BYTES) {
    return results;
  }

  // eslint-disable-next-line no-restricted-syntax
  for (const quality of [90, 80, 70] as const) {
    // eslint-disable-next-line no-await-in-loop -- sequential attempts ensure predictable outcomes.
    const encoded = await createCompressionPipeline(sharp, buffer)
      .png({ compressionLevel: 9, adaptiveFiltering: true, palette: true, quality })
      .toBuffer();

    results.push(encoded);

    if (encoded.length <= COMPRESSION_THRESHOLD_BYTES) {
      break;
    }
  }

  return results;
};

export class DesignService {
  private readonly prisma: PrismaClient;

  private readonly repository: DesignRepository;

  private readonly cloudinary: CloudinaryClient;

  private readonly logger: ReturnType<typeof createChildLogger>;

  private readonly scanService: MediaScanService;

  constructor(options: DesignServiceOptions = {}) {
    this.prisma = options.prisma ?? getPrismaClient();
    this.repository = options.repository ?? new DesignRepository(this.prisma);
    this.cloudinary = options.cloudinary ?? getCloudinaryClient();
    this.logger = options.logger ?? createChildLogger("design:service");
    this.scanService = options.scanService ?? new MediaScanService();
  }

  // eslint-disable-next-line class-methods-use-this -- Exposed for callers/tests and matches phase spec.
  validateDesignFile(file: PreparedDesignFile): void {
    validateDesignFilePayload(file);
  }

  private async prepareDesignFileForUpload(file: PreparedDesignFile): Promise<PreparedDesignFile> {
    this.validateDesignFile(file);

    const sanitized = sanitizeSvgIfNeeded(file);
    const processed = await this.compressRasterIfNeeded(sanitized);

    await this.scanService.scan({
      buffer: processed.buffer,
      filename: processed.originalName,
    });

    return processed;
  }

  private async compressRasterIfNeeded(file: PreparedDesignFile): Promise<PreparedDesignFile> {
    if (file.size <= COMPRESSION_THRESHOLD_BYTES || file.mimeType === "image/svg+xml") {
      return file;
    }

    try {
      const sharpModule = await import("sharp");
      const sharp = sharpModule.default as unknown as SharpFactory;

      const buffers =
        file.mimeType === "image/jpeg"
          ? await compressJpeg(sharp, file.buffer)
          : await compressPng(sharp, file.buffer);

      const best = pickSmallestBuffer(buffers);

      if (!best || best.length >= file.size) {
        return file;
      }

      if (best.length > COMPRESSION_THRESHOLD_BYTES) {
        this.logger.warn("Design compression target not met", {
          mimeType: file.mimeType,
          originalBytes: file.size,
          compressedBytes: best.length,
        });
      }

      return {
        ...file,
        buffer: best,
        size: best.length,
      };
    } catch (error) {
      throw new ApiError("Unable to process design image.", {
        status: 422,
        code: "INVALID_IMAGE",
        cause: error,
      });
    }
  }

  async uploadDesign(
    file: PreparedDesignFile,
    userId: string,
    body: DesignUploadBody,
  ): Promise<CustomerDesignView> {
    const startedAt = performance.now();
    const processed = await this.prepareDesignFileForUpload(file);

    const extension = MIME_EXTENSION[processed.mimeType as SupportedMime];
    const safeFilename = sanitizeFilename(processed.originalName, extension);
    const folder = `lumi/customer-designs/${userId}`;

    const metadata = buildUploadMetadata(processed, body);

    const uploadResponse = await this.cloudinary.upload(processed.buffer, {
      folder,
      tags: body.tags,
      filenameOverride: safeFilename,
      useFilename: true,
      uniqueFilename: true,
      mimeType: processed.mimeType,
      overwrite: false,
      invalidate: true,
      colors: true,
      imageMetadata: true,
      context: {
        uploader: userId,
        source: body.uploadedFrom ?? "design-upload",
      },
      metadata,
    });

    const publicId = uploadResponse.public_id;
    if (!publicId) {
      throw new ApiError("Cloudinary did not return a public identifier for the upload.", {
        status: 502,
        code: "CLOUDINARY_UPLOAD_FAILED",
      });
    }

    const thumbnailUrl = this.cloudinary.generateImageUrl(publicId, {
      transformation: { width: 300, height: 300, crop: "fill" },
      version: uploadResponse.version,
      resourceType: uploadResponse.resource_type ?? "image",
      type: uploadResponse.type ?? "upload",
    });

    const dominantColor = extractDominantColor(uploadResponse.colors);
    const persistedMetadata = mergeMetadata(undefined, {
      ...metadata,
      ...(dominantColor ? { dominantColor } : {}),
    });

    const created = await this.repository.createDesign({
      publicId,
      url: uploadResponse.url ?? uploadResponse.secure_url ?? "",
      secureUrl: uploadResponse.secure_url ?? uploadResponse.url ?? "",
      thumbnailUrl,
      format: uploadResponse.format ?? extension,
      width: uploadResponse.width,
      height: uploadResponse.height,
      bytes: uploadResponse.bytes ?? processed.size,
      tags: uploadResponse.tags ?? body.tags,
      metadata: persistedMetadata,
      isPublic: false,
      user: { connect: { id: userId } },
    });

    this.logger.info("Customer design uploaded", {
      designId: created.id,
      userId,
      publicId,
      durationMs: performance.now() - startedAt,
    });

    return DesignService.toView(created);
  }

  async getDesign(id: string, userId?: string): Promise<CustomerDesignView> {
    const design = await this.repository.getById(id);
    if (!design) {
      throw new ApiError("Design not found.", { status: 404, code: "NOT_FOUND" });
    }

    const isOwner = Boolean(userId && design.userId === userId);
    if (!isOwner && !design.isPublic) {
      throw new ApiError("You do not have access to this design.", {
        status: userId ? 403 : 401,
        code: userId ? "FORBIDDEN" : "UNAUTHORIZED",
      });
    }

    await this.repository.incrementViewCount(id);
    return DesignService.toView(design);
  }

  async getUserDesigns(
    userId: string,
    query: DesignListQuery,
  ): Promise<PaginatedResult<CustomerDesignView>> {
    const filters: DesignListFilters = {
      tags: buildTags(query),
      sort: query.sort ?? "createdAt",
      order: query.order ?? "desc",
    };

    const result = await this.repository.findByUserId(userId, filters, {
      page: query.page ?? 1,
      pageSize: query.perPage ?? 24,
    });

    return {
      items: result.items.map((item) => DesignService.toView(item)),
      meta: result.meta,
      cursor: result.cursor,
    };
  }

  async updateDesign(
    id: string,
    userId: string,
    patch: DesignUpdateBody,
  ): Promise<CustomerDesignView> {
    const design = await this.repository.getById(id);
    if (!design) {
      throw new ApiError("Design not found.", { status: 404, code: "NOT_FOUND" });
    }

    if (design.userId !== userId) {
      throw new ApiError("You do not have permission to update this design.", {
        status: 403,
        code: "FORBIDDEN",
      });
    }

    const updated = await this.repository.updateDesign(id, {
      ...(patch.tags ? { tags: patch.tags } : {}),
      ...(typeof patch.isPublic === "boolean" ? { isPublic: patch.isPublic } : {}),
      ...(patch.metadata ? { metadata: mergeMetadata(design.metadata, patch.metadata) } : {}),
    });

    return DesignService.toView(updated);
  }

  async deleteDesign(id: string, userId: string): Promise<void> {
    const design = await this.repository.getById(id);
    if (!design) {
      return;
    }

    if (design.userId !== userId) {
      throw new ApiError("You do not have permission to delete this design.", {
        status: 403,
        code: "FORBIDDEN",
      });
    }

    const shouldPurge = design.usageCount === 0;
    const purgeAt = shouldPurge
      ? new Date(Date.now() + RETENTION_DAYS * 24 * 60 * 60 * 1000)
      : undefined;

    await this.repository.softDeleteDesign(id, { purgeAt });

    if (!shouldPurge) {
      this.logger.info("Design retained because it is referenced by usage count", {
        designId: id,
        userId,
        usageCount: design.usageCount,
      });
    }
  }

  async shareDesign(id: string, userId: string): Promise<CustomerDesignView> {
    return this.updateDesign(id, userId, { isPublic: true });
  }

  static toView(record: CustomerDesign): CustomerDesignView {
    return {
      id: record.id,
      publicId: record.publicId,
      url: record.url,
      secureUrl: record.secureUrl,
      thumbnailUrl: record.thumbnailUrl,
      format: record.format,
      width: record.width,
      height: record.height,
      bytes: record.bytes,
      tags: record.tags,
      userId: record.userId,
      isPublic: record.isPublic,
      usageCount: record.usageCount,
      viewCount: record.viewCount,
      metadata:
        record.metadata && typeof record.metadata === "object" && !Array.isArray(record.metadata)
          ? (record.metadata as Record<string, unknown>)
          : undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
