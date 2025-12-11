/* istanbul ignore file */

import type { Request, RequestHandler, Response } from "express";

import { asyncHandler } from "@/lib/asyncHandler.js";
import { NotFoundError, ValidationError } from "@/lib/errors.js";
import { successResponse } from "@/lib/response.js";

import type { CustomizationService } from "./customization.service.js";
import {
  productCustomizationConfigSchema,
  productCustomizationParamsSchema,
  productCustomizationUpdateSchema,
} from "./customization.validators.js";

export interface CustomizationControllerOptions {
  service: CustomizationService;
}

export class CustomizationController {
  public readonly getCustomization: RequestHandler;

  public readonly createCustomization: RequestHandler;

  public readonly updateCustomization: RequestHandler;

  public readonly deleteCustomization: RequestHandler;

  private readonly service: CustomizationService;

  constructor(options: CustomizationControllerOptions) {
    this.service = options.service;

    this.getCustomization = asyncHandler(this.handleGetCustomization.bind(this));
    this.createCustomization = asyncHandler(this.handleCreateCustomization.bind(this));
    this.updateCustomization = asyncHandler(this.handleUpdateCustomization.bind(this));
    this.deleteCustomization = asyncHandler(this.handleDeleteCustomization.bind(this));
  }

  private async handleGetCustomization(req: Request, res: Response): Promise<void> {
    const { id } = productCustomizationParamsSchema.parse(req.params);

    const config = await this.service.getProductCustomization(id);
    if (!config) {
      throw new NotFoundError("Customization configuration not found.", {
        details: { productId: id },
      });
    }

    res.json(successResponse(config));
  }

  private async handleCreateCustomization(req: Request, res: Response): Promise<void> {
    const { id } = productCustomizationParamsSchema.parse(req.params);
    const body = productCustomizationConfigSchema.parse(req.body);

    const config = await this.service.enableCustomization(id, body);

    res.status(201).json(successResponse(config));
  }

  private async handleUpdateCustomization(req: Request, res: Response): Promise<void> {
    const { id } = productCustomizationParamsSchema.parse(req.params);
    const body = productCustomizationUpdateSchema.parse(req.body);

    if (Object.keys(body).length === 0) {
      throw new ValidationError("Update payload cannot be empty.", {
        issues: [
          {
            path: "body",
            message: "Provide at least one field to update.",
          },
        ],
      });
    }

    const config = await this.service.updateCustomization(id, body);

    res.json(successResponse(config));
  }

  private async handleDeleteCustomization(req: Request, res: Response): Promise<void> {
    const { id } = productCustomizationParamsSchema.parse(req.params);

    await this.service.disableCustomization(id);

    res.status(204).end();
  }
}
