/* istanbul ignore file */

import type { Request, RequestHandler, Response } from "express";

import { asyncHandler } from "@/lib/asyncHandler.js";
import { ValidationError } from "@/lib/errors.js";
import { paginatedResponse, successResponse } from "@/lib/response.js";

import type { TemplateService } from "./template.service.js";
import {
  templateCreateBodySchema,
  templateIdParamSchema,
  templateListQuerySchema,
  templateUpdateBodySchema,
} from "./template.validators.js";

const assertPatchNotEmpty = (patch: Record<string, unknown>) => {
  if (Object.keys(patch).length === 0) {
    throw new ValidationError("Update payload cannot be empty.", {
      issues: [{ path: "body", message: "Provide at least one field to update." }],
    });
  }
};

export interface TemplateControllerOptions {
  service: TemplateService;
}

export class TemplateController {
  public readonly listPublic: RequestHandler;

  public readonly getPublic: RequestHandler;

  public readonly listAdmin: RequestHandler;

  public readonly getAdmin: RequestHandler;

  public readonly create: RequestHandler;

  public readonly update: RequestHandler;

  public readonly delete: RequestHandler;

  private readonly service: TemplateService;

  constructor(options: TemplateControllerOptions) {
    this.service = options.service;

    this.listPublic = asyncHandler(this.handleListPublic.bind(this));
    this.getPublic = asyncHandler(this.handleGetPublic.bind(this));
    this.listAdmin = asyncHandler(this.handleListAdmin.bind(this));
    this.getAdmin = asyncHandler(this.handleGetAdmin.bind(this));
    this.create = asyncHandler(this.handleCreate.bind(this));
    this.update = asyncHandler(this.handleUpdate.bind(this));
    this.delete = asyncHandler(this.handleDelete.bind(this));
  }

  private async handleListPublic(req: Request, res: Response): Promise<void> {
    const query = templateListQuerySchema.parse(req.query ?? {});
    const result = await this.service.listPublicTemplates(query);

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
    const id = templateIdParamSchema.parse(req.params.id);
    const template = await this.service.getPublicTemplate(id);
    res.json(successResponse(template));
  }

  private async handleListAdmin(req: Request, res: Response): Promise<void> {
    const query = templateListQuerySchema.parse(req.query ?? {});
    const result = await this.service.listAdminTemplates(query);

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
    const id = templateIdParamSchema.parse(req.params.id);
    const template = await this.service.getAdminTemplate(id);
    res.json(successResponse(template));
  }

  private async handleCreate(req: Request, res: Response): Promise<void> {
    const body = templateCreateBodySchema.parse(req.body ?? {});
    const created = await this.service.createTemplate(body);
    res.status(201).json(successResponse(created));
  }

  private async handleUpdate(req: Request, res: Response): Promise<void> {
    const id = templateIdParamSchema.parse(req.params.id);
    const patch = templateUpdateBodySchema.parse(req.body ?? {});
    assertPatchNotEmpty(patch);

    const updated = await this.service.updateTemplate(id, patch);
    res.json(successResponse(updated));
  }

  private async handleDelete(req: Request, res: Response): Promise<void> {
    const id = templateIdParamSchema.parse(req.params.id);
    await this.service.deleteTemplate(id);
    res.status(204).end();
  }
}
