/* istanbul ignore file */

import type { Request, RequestHandler, Response } from "express";

import { ApiError } from "@/errors/api-error.js";
import { asyncHandler } from "@/lib/asyncHandler.js";
import { ValidationError } from "@/lib/errors.js";
import { paginatedResponse, successResponse } from "@/lib/response.js";

import type { DesignService, PreparedDesignFile } from "./design.service.js";
import {
  designIdParamSchema,
  designListQuerySchema,
  designUpdateBodySchema,
  designUploadBodySchema,
} from "./design.validators.js";

const FILE_FIELD_NAME = "file";
const AUTHENTICATION_REQUIRED_MESSAGE = "Authentication required.";

const extractUploadFile = (req: Request): Express.Multer.File | undefined =>
  (req as Request & { file?: Express.Multer.File }).file;

const toPreparedFile = (file: Express.Multer.File): PreparedDesignFile => ({
  originalName: file.originalname ?? "design",
  mimeType: file.mimetype,
  size: file.size,
  buffer: file.buffer,
});

export interface DesignControllerOptions {
  service: DesignService;
}

export class DesignController {
  public readonly upload: RequestHandler;

  public readonly list: RequestHandler;

  public readonly get: RequestHandler;

  public readonly update: RequestHandler;

  public readonly delete: RequestHandler;

  private readonly service: DesignService;

  constructor(options: DesignControllerOptions) {
    this.service = options.service;

    this.upload = asyncHandler(this.handleUpload.bind(this));
    this.list = asyncHandler(this.handleList.bind(this));
    this.get = asyncHandler(this.handleGet.bind(this));
    this.update = asyncHandler(this.handleUpdate.bind(this));
    this.delete = asyncHandler(this.handleDelete.bind(this));
  }

  private async handleUpload(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new ApiError(AUTHENTICATION_REQUIRED_MESSAGE, { status: 401, code: "UNAUTHORIZED" });
    }

    const file = extractUploadFile(req);
    if (!file) {
      throw new ValidationError("Design file is required.", {
        issues: [{ path: FILE_FIELD_NAME, message: "Attach a design file to upload." }],
      });
    }

    const body = designUploadBodySchema.parse(req.body ?? {});
    const created = await this.service.uploadDesign(toPreparedFile(file), req.user.id, body);

    res.json(successResponse(created));
  }

  private async handleList(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new ApiError(AUTHENTICATION_REQUIRED_MESSAGE, { status: 401, code: "UNAUTHORIZED" });
    }

    const query = designListQuerySchema.parse(req.query ?? {});
    const result = await this.service.getUserDesigns(req.user.id, query);

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
    const designId = designIdParamSchema.parse(req.params.id);
    const design = await this.service.getDesign(designId, req.user?.id);
    res.json(successResponse(design));
  }

  private async handleUpdate(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new ApiError(AUTHENTICATION_REQUIRED_MESSAGE, { status: 401, code: "UNAUTHORIZED" });
    }

    const designId = designIdParamSchema.parse(req.params.id);
    const patch = designUpdateBodySchema.parse(req.body ?? {});

    if (Object.keys(patch).length === 0) {
      throw new ValidationError("Update payload cannot be empty.", {
        issues: [{ path: "body", message: "Provide at least one field to update." }],
      });
    }

    const updated = await this.service.updateDesign(designId, req.user.id, patch);
    res.json(successResponse(updated));
  }

  private async handleDelete(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new ApiError(AUTHENTICATION_REQUIRED_MESSAGE, { status: 401, code: "UNAUTHORIZED" });
    }

    const designId = designIdParamSchema.parse(req.params.id);
    await this.service.deleteDesign(designId, req.user.id);
    res.status(204).end();
  }
}
