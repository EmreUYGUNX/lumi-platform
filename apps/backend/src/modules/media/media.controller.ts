import { createHash } from "node:crypto";

import type { Request, RequestHandler, Response } from "express";

import { asyncHandler } from "@/lib/asyncHandler.js";
import { UnauthorizedError, ValidationError } from "@/lib/errors.js";
import { paginatedResponse, successResponse } from "@/lib/response.js";
import { mediaMetrics } from "@/observability/media-metrics.js";
import type { ApplicationConfig } from "@lumi/types";

import type {
  MediaActionContext,
  MediaService,
  MediaUploadResult,
  PreparedUploadFile,
} from "./media.service.js";
import {
  createMediaSignatureSchema,
  createMediaUpdateSchema,
  createMediaUploadSchema,
  mediaIdParamSchema,
  mediaLcpMetricSchema,
  mediaListQuerySchema,
} from "./media.validators.js";

const MAX_FILES_PER_REQUEST = 10;

const AUTH_REQUIRED_MESSAGE = "Authentication required.";
const FILES_FIELD_NAME = "files";
const AUDIT_ACTIONS = Object.freeze({
  update: "media.assets.update",
  regenerate: "media.assets.regenerate",
  softDelete: "media.assets.soft-delete",
  hardDelete: "media.assets.hard-delete",
});
const MEDIA_CACHE_HEADER = "private, max-age=300";
const CACHE_CONTROL_HEADER = "Cache-Control";

const computeEtag = (payload: unknown): string =>
  createHash("sha256").update(JSON.stringify(payload)).digest("hex");

const resolveActorContext = (req: Request): MediaActionContext => {
  if (!req.user) {
    throw new UnauthorizedError(AUTH_REQUIRED_MESSAGE);
  }

  return {
    userId: req.user.id,
    roles: (req.user.roles ?? []).map((role) => role.name.toLowerCase()),
  };
};

const normaliseFiles = (input: unknown): Express.Multer.File[] => {
  if (!input) {
    return [];
  }

  if (Array.isArray(input)) {
    return input as Express.Multer.File[];
  }

  if (typeof input === "object") {
    return Object.values(input as Record<string, Express.Multer.File | Express.Multer.File[]>).flat(
      Number.POSITIVE_INFINITY,
    ) as Express.Multer.File[];
  }

  return [];
};

const toPreparedFiles = (files: Express.Multer.File[]): PreparedUploadFile[] =>
  files.map((file) => ({
    fieldName: file.fieldname,
    originalName: file.originalname ?? "upload",
    mimeType: file.mimetype,
    size: file.size,
    buffer: file.buffer,
  }));

const respondWithUploads = (res: Response, result: MediaUploadResult, totalFiles: number): void => {
  const meta = {
    counts: {
      total: totalFiles,
      uploaded: result.uploads.length,
      failed: result.failures.length,
    },
    partialFailure: result.failures.length > 0,
  };

  res.json(successResponse(result, meta));
};

export interface MediaControllerOptions {
  service: MediaService;
  config: ApplicationConfig;
}

export class MediaController {
  public readonly list: RequestHandler;

  public readonly get: RequestHandler;

  public readonly upload: RequestHandler;

  public readonly signature: RequestHandler;

  public readonly update: RequestHandler;

  public readonly regenerate: RequestHandler;

  public readonly softDelete: RequestHandler;

  public readonly hardDelete: RequestHandler;

  public readonly recordLcpMetric: RequestHandler;

  private readonly service: MediaService;

  private readonly uploadSchema: ReturnType<typeof createMediaUploadSchema>;

  private readonly signatureSchema: ReturnType<typeof createMediaSignatureSchema>;

  private readonly updateSchema: ReturnType<typeof createMediaUpdateSchema>;

  private readonly auditEntity: string;

  constructor(options: MediaControllerOptions) {
    this.service = options.service;

    const folders = Object.values(options.config.media.cloudinary.folders);

    this.uploadSchema = createMediaUploadSchema({
      allowedFolders: folders,
      defaultFolder: options.config.media.cloudinary.folders.products,
    });

    this.signatureSchema = createMediaSignatureSchema({
      allowedFolders: folders,
      defaultFolder: options.config.media.cloudinary.folders.products,
    });

    this.updateSchema = createMediaUpdateSchema({
      allowedFolders: folders,
      defaultFolder: options.config.media.cloudinary.folders.products,
    });

    this.auditEntity = this.service.getAuditEntity();

    this.list = asyncHandler(this.handleList.bind(this));
    this.get = asyncHandler(this.handleGet.bind(this));
    this.upload = asyncHandler(this.handleUpload.bind(this));
    this.signature = asyncHandler(this.handleSignature.bind(this));
    this.update = asyncHandler(this.handleUpdate.bind(this));
    this.regenerate = asyncHandler(this.handleRegenerate.bind(this));
    this.softDelete = asyncHandler(this.handleSoftDelete.bind(this));
    this.hardDelete = asyncHandler(this.handleHardDelete.bind(this));
    this.recordLcpMetric = asyncHandler(MediaController.handleRecordLcpMetric);
  }

  private async handleList(req: Request, res: Response): Promise<void> {
    const actor = resolveActorContext(req);
    const query = mediaListQuerySchema.parse(req.query ?? {});
    const result = await this.service.listAssets(query, actor);

    const etagPayload = {
      meta: result.meta,
      updatedAt: result.items.map((item) => item.updatedAt.getTime()),
    };
    const etag = computeEtag(etagPayload);

    if (req.headers["if-none-match"] === etag) {
      res.status(304).end();
      return;
    }

    res.setHeader("ETag", etag);
    res.setHeader(CACHE_CONTROL_HEADER, MEDIA_CACHE_HEADER);

    res.json(
      paginatedResponse(result.items, {
        totalItems: result.meta.totalItems,
        page: result.meta.page,
        pageSize: result.meta.pageSize,
        totalPages: result.meta.totalPages,
        hasNextPage: result.meta.hasNextPage,
        hasPreviousPage: result.meta.hasPreviousPage,
      }),
    );
  }

  private async handleGet(req: Request, res: Response): Promise<void> {
    const assetId = mediaIdParamSchema.parse(req.params.id);
    const actor = resolveActorContext(req);
    const asset = await this.service.getAsset(assetId, actor);

    const etag = computeEtag({ id: asset.id, updatedAt: asset.updatedAt.getTime() });
    if (req.headers["if-none-match"] === etag) {
      res.status(304).end();
      return;
    }

    res.setHeader("ETag", etag);
    res.setHeader(CACHE_CONTROL_HEADER, MEDIA_CACHE_HEADER);
    res.json(successResponse(asset));
  }

  private async handleUpload(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new UnauthorizedError(AUTH_REQUIRED_MESSAGE);
    }

    const rawFiles = normaliseFiles((req as Request & { files?: unknown }).files);

    if (rawFiles.length === 0) {
      throw new ValidationError("At least one file must be provided.", {
        issues: [
          {
            path: FILES_FIELD_NAME,
            message: "Select one or more files to upload.",
          },
        ],
      });
    }

    if (rawFiles.length > MAX_FILES_PER_REQUEST) {
      throw new ValidationError(`A maximum of ${MAX_FILES_PER_REQUEST} files can be uploaded.`, {
        issues: [
          {
            path: FILES_FIELD_NAME,
            message: `Reduce the selection to ${MAX_FILES_PER_REQUEST} files or fewer.`,
          },
        ],
      });
    }

    const actor = resolveActorContext(req);
    const body = this.uploadSchema.parse(req.body);
    const preparedFiles = toPreparedFiles(rawFiles);

    const result = await this.service.upload(preparedFiles, {
      ...body,
      uploadedById: actor.userId,
      ipAddress: req.ip,
      userAgent: req.get("user-agent") ?? undefined,
    });

    respondWithUploads(res, result, preparedFiles.length);
  }

  private async handleSignature(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new UnauthorizedError(AUTH_REQUIRED_MESSAGE);
    }

    const payload = this.signatureSchema.parse(req.body);

    const signature = await this.service.generateUploadSignature(payload);
    res.json(successResponse(signature));
  }

  private async handleUpdate(req: Request, res: Response): Promise<void> {
    const assetId = mediaIdParamSchema.parse(req.params.id);
    const actor = resolveActorContext(req);
    const body = this.updateSchema.parse(req.body ?? {});
    const asset = await this.service.updateAsset(assetId, body, actor);

    res.locals.audit = {
      entity: this.auditEntity,
      entityId: asset.id,
      action: AUDIT_ACTIONS.update,
      after: body,
    };

    res.json(successResponse(asset));
  }

  private async handleRegenerate(req: Request, res: Response): Promise<void> {
    const assetId = mediaIdParamSchema.parse(req.params.id);
    const actor = resolveActorContext(req);
    const asset = await this.service.regenerateAsset(assetId, actor);

    res.locals.audit = {
      entity: this.auditEntity,
      entityId: asset.id,
      action: AUDIT_ACTIONS.regenerate,
    };

    res.json(successResponse(asset));
  }

  private async handleSoftDelete(req: Request, res: Response): Promise<void> {
    const assetId = mediaIdParamSchema.parse(req.params.id);
    const actor = resolveActorContext(req);
    const asset = await this.service.softDeleteAsset(assetId, actor);

    res.locals.audit = {
      entity: this.auditEntity,
      entityId: asset.id,
      action: AUDIT_ACTIONS.softDelete,
    };

    res.json(successResponse(asset));
  }

  private async handleHardDelete(req: Request, res: Response): Promise<void> {
    const assetId = mediaIdParamSchema.parse(req.params.id);
    const actor = resolveActorContext(req);
    const asset = await this.service.hardDeleteAsset(assetId, actor);

    res.locals.audit = {
      entity: this.auditEntity,
      entityId: asset.id,
      action: AUDIT_ACTIONS.hardDelete,
    };

    res.json(successResponse(asset));
  }

  private static async handleRecordLcpMetric(req: Request, res: Response): Promise<void> {
    const payload = mediaLcpMetricSchema.parse(req.body ?? {});
    mediaMetrics.recordLcp(payload.value, payload.route);
    res.setHeader(CACHE_CONTROL_HEADER, "no-store");
    res.status(202).json(successResponse({ recorded: true }));
  }
}
