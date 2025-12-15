/* istanbul ignore file */

import type { Request, RequestHandler, Response } from "express";

import { asyncHandler } from "@/lib/asyncHandler.js";
import { ValidationError } from "@/lib/errors.js";
import { paginatedResponse, successResponse } from "@/lib/response.js";

import type { ClipartService, PreparedClipartFile } from "./clipart.service.js";
import {
  clipartIdParamSchema,
  clipartListQuerySchema,
  clipartUpdateBodySchema,
  clipartUploadBodySchema,
} from "./clipart.validators.js";

const FILES_FIELD_NAME = "files";

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

const toPreparedFiles = (files: Express.Multer.File[]): PreparedClipartFile[] =>
  files.map((file) => ({
    originalName: file.originalname ?? "clipart.svg",
    mimeType: file.mimetype,
    size: file.size,
    buffer: file.buffer,
  }));

const assertPatchNotEmpty = (patch: Record<string, unknown>) => {
  if (Object.keys(patch).length === 0) {
    throw new ValidationError("Update payload cannot be empty.", {
      issues: [{ path: "body", message: "Provide at least one field to update." }],
    });
  }
};

export interface ClipartControllerOptions {
  service: ClipartService;
}

export class ClipartController {
  public readonly listPublic: RequestHandler;

  public readonly getPublic: RequestHandler;

  public readonly listAdmin: RequestHandler;

  public readonly getAdmin: RequestHandler;

  public readonly upload: RequestHandler;

  public readonly update: RequestHandler;

  public readonly delete: RequestHandler;

  private readonly service: ClipartService;

  constructor(options: ClipartControllerOptions) {
    this.service = options.service;

    this.listPublic = asyncHandler(this.handleListPublic.bind(this));
    this.getPublic = asyncHandler(this.handleGetPublic.bind(this));
    this.listAdmin = asyncHandler(this.handleListAdmin.bind(this));
    this.getAdmin = asyncHandler(this.handleGetAdmin.bind(this));
    this.upload = asyncHandler(this.handleUpload.bind(this));
    this.update = asyncHandler(this.handleUpdate.bind(this));
    this.delete = asyncHandler(this.handleDelete.bind(this));
  }

  private async handleListPublic(req: Request, res: Response): Promise<void> {
    const query = clipartListQuerySchema.parse(req.query ?? {});
    const result = await this.service.listPublicClipart(query);

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

  private async handleGetPublic(req: Request, res: Response): Promise<void> {
    const id = clipartIdParamSchema.parse(req.params.id);
    const asset = await this.service.getPublicClipart(id);
    res.json(successResponse(asset));
  }

  private async handleListAdmin(req: Request, res: Response): Promise<void> {
    const query = clipartListQuerySchema.parse(req.query ?? {});
    const result = await this.service.listAdminClipart(query);

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

  private async handleGetAdmin(req: Request, res: Response): Promise<void> {
    const id = clipartIdParamSchema.parse(req.params.id);
    const asset = await this.service.getAdminClipart(id);
    res.json(successResponse(asset));
  }

  private async handleUpload(req: Request, res: Response): Promise<void> {
    const rawFiles = normaliseFiles((req as Request & { files?: unknown }).files);

    if (rawFiles.length === 0) {
      throw new ValidationError("At least one file must be provided.", {
        issues: [{ path: FILES_FIELD_NAME, message: "Select one or more SVG files to upload." }],
      });
    }

    const body = clipartUploadBodySchema.parse(req.body ?? {});
    const result = await this.service.uploadClipart(toPreparedFiles(rawFiles), body);

    res.json(
      successResponse(result, {
        counts: {
          total: rawFiles.length,
          uploaded: result.uploads.length,
          failed: result.failures.length,
        },
        partialFailure: result.failures.length > 0,
      }),
    );
  }

  private async handleUpdate(req: Request, res: Response): Promise<void> {
    const id = clipartIdParamSchema.parse(req.params.id);
    const patch = clipartUpdateBodySchema.parse(req.body ?? {});
    assertPatchNotEmpty(patch);

    const updated = await this.service.updateClipart(id, patch);
    res.json(successResponse(updated));
  }

  private async handleDelete(req: Request, res: Response): Promise<void> {
    const id = clipartIdParamSchema.parse(req.params.id);
    await this.service.deleteClipart(id);
    res.status(204).end();
  }
}
