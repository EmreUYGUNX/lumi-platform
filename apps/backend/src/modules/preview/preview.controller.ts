/* istanbul ignore file */

import type { Request, RequestHandler, Response } from "express";

import { ApiError } from "@/errors/api-error.js";
import { asyncHandler } from "@/lib/asyncHandler.js";
import { NotFoundError, ValidationError } from "@/lib/errors.js";
import { successResponse } from "@/lib/response.js";

import type { PreviewService } from "./preview.service.js";
import {
  previewBatchBodySchema,
  previewGenerateBodySchema,
  previewIdParamSchema,
} from "./preview.validators.js";

const AUTHENTICATION_REQUIRED_MESSAGE = "Authentication required.";

export interface PreviewControllerOptions {
  service: PreviewService;
}

export class PreviewController {
  public readonly generate: RequestHandler;

  public readonly batch: RequestHandler;

  public readonly get: RequestHandler;

  private readonly service: PreviewService;

  constructor(options: PreviewControllerOptions) {
    this.service = options.service;

    this.generate = asyncHandler(this.handleGenerate.bind(this));
    this.batch = asyncHandler(this.handleBatch.bind(this));
    this.get = asyncHandler(this.handleGet.bind(this));
  }

  private async handleGenerate(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new ApiError(AUTHENTICATION_REQUIRED_MESSAGE, { status: 401, code: "UNAUTHORIZED" });
    }

    const body = previewGenerateBodySchema.parse(req.body ?? {});
    const result = await this.service.generatePreview(body.productId, body, req.user.id);

    res.json(
      successResponse({
        ...result,
        designLayers: body.layers,
      }),
    );
  }

  private async handleBatch(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new ApiError(AUTHENTICATION_REQUIRED_MESSAGE, { status: 401, code: "UNAUTHORIZED" });
    }

    const body = previewBatchBodySchema.parse(req.body ?? {});

    const previews = await Promise.all(
      body.previews.map((preview) =>
        this.service.generatePreview(preview.productId, preview, req.user!.id),
      ),
    );

    res.json(successResponse(previews));
  }

  private async handleGet(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new ApiError(AUTHENTICATION_REQUIRED_MESSAGE, { status: 401, code: "UNAUTHORIZED" });
    }

    const parsed = previewIdParamSchema.parse(req.params.id);
    const cached = await this.service.getCachedPreview(parsed.previewId);

    if (!cached) {
      throw new NotFoundError("Preview not found or expired.", {
        details: { previewId: parsed.previewId },
      });
    }

    const expiresAtMs = Date.parse(cached.expiresAt);
    if (Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now()) {
      throw new NotFoundError("Preview not found or expired.", {
        details: { previewId: parsed.previewId },
      });
    }

    if (!cached.previewUrl) {
      throw new ValidationError("Preview cache entry is invalid.", {
        issues: [{ path: "id", message: "Cached preview payload is missing previewUrl." }],
      });
    }

    res.json(
      successResponse({
        previewId: parsed.previewId,
        previewUrl: cached.previewUrl,
        productId: parsed.productId,
        designArea: cached.designArea,
        resolution: cached.resolution,
        cachedAt: cached.cachedAt,
        expiresAt: cached.expiresAt,
      }),
    );
  }
}
