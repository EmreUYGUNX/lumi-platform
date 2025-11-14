import type { Request, RequestHandler, Response } from "express";

import { asyncHandler } from "@/lib/asyncHandler.js";
import { UnauthorizedError, ValidationError } from "@/lib/errors.js";
import { successResponse } from "@/lib/response.js";
import type { ApplicationConfig } from "@lumi/types";

import type { MediaService, MediaUploadResult, PreparedUploadFile } from "./media.service.js";
import { createMediaSignatureSchema, createMediaUploadSchema } from "./media.validators.js";

const MAX_FILES_PER_REQUEST = 10;

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
  public readonly upload: RequestHandler;

  public readonly signature: RequestHandler;

  private readonly service: MediaService;

  private readonly uploadSchema: ReturnType<typeof createMediaUploadSchema>;

  private readonly signatureSchema: ReturnType<typeof createMediaSignatureSchema>;

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

    this.upload = asyncHandler(this.handleUpload.bind(this));
    this.signature = asyncHandler(this.handleSignature.bind(this));
  }

  private async handleUpload(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new UnauthorizedError("Authentication required.");
    }

    const rawFiles = normaliseFiles((req as Request & { files?: unknown }).files);

    if (rawFiles.length === 0) {
      throw new ValidationError("At least one file must be provided.", {
        issues: [
          {
            path: "files",
            message: "Select one or more files to upload.",
          },
        ],
      });
    }

    if (rawFiles.length > MAX_FILES_PER_REQUEST) {
      throw new ValidationError(`A maximum of ${MAX_FILES_PER_REQUEST} files can be uploaded.`, {
        issues: [
          {
            path: "files",
            message: `Reduce the selection to ${MAX_FILES_PER_REQUEST} files or fewer.`,
          },
        ],
      });
    }

    const body = this.uploadSchema.parse(req.body);
    const preparedFiles = toPreparedFiles(rawFiles);

    const result = await this.service.upload(preparedFiles, {
      ...body,
      uploadedById: req.user.id,
    });

    respondWithUploads(res, result, preparedFiles.length);
  }

  private async handleSignature(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new UnauthorizedError("Authentication required.");
    }

    const payload = this.signatureSchema.parse(req.body);

    const signature = await this.service.generateUploadSignature(payload);
    res.json(successResponse(signature));
  }
}
