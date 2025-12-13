/* istanbul ignore file */

import type { Request, RequestHandler, Response } from "express";

import { recordAuditLog } from "@/audit/audit-log.service.js";
import { ApiError } from "@/errors/api-error.js";
import { asyncHandler } from "@/lib/asyncHandler.js";
import { createChildLogger } from "@/lib/logger.js";
import { successResponse } from "@/lib/response.js";

import type { ProductionService } from "./production.service.js";
import {
  productionDownloadIdParamSchema,
  productionGenerateBodySchema,
  productionOrderIdParamSchema,
} from "./production.validators.js";

const AUTHENTICATION_REQUIRED_MESSAGE = "Authentication required.";
const USER_AGENT_HEADER = "user-agent";

export interface ProductionControllerOptions {
  service: ProductionService;
}

export class ProductionController {
  public readonly generate: RequestHandler;

  public readonly download: RequestHandler;

  public readonly listOrder: RequestHandler;

  private readonly service: ProductionService;

  private readonly logger: ReturnType<typeof createChildLogger>;

  constructor(options: ProductionControllerOptions) {
    this.service = options.service;
    this.logger = createChildLogger("production:controller");

    this.generate = asyncHandler(this.handleGenerate.bind(this));
    this.download = asyncHandler(this.handleDownload.bind(this));
    this.listOrder = asyncHandler(this.handleListOrder.bind(this));
  }

  private async handleGenerate(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new ApiError(AUTHENTICATION_REQUIRED_MESSAGE, { status: 401, code: "UNAUTHORIZED" });
    }

    const body = productionGenerateBodySchema.parse(req.body ?? {});

    const result = await this.service.generateProductionFile(body.orderItemId, {
      force: body.force,
    });

    res.json(successResponse(result));
  }

  private async handleDownload(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new ApiError(AUTHENTICATION_REQUIRED_MESSAGE, { status: 401, code: "UNAUTHORIZED" });
    }

    const customizationId = productionDownloadIdParamSchema.parse(req.params.id);
    const result = await this.service.getDownloadUrl(customizationId);

    try {
      await recordAuditLog({
        action: "production.download",
        entity: "order_item_customization",
        entityId: customizationId,
        userId: req.user.id,
        ipAddress: req.ip,
        userAgent: req.get(USER_AGENT_HEADER) ?? undefined,
        metadata: {
          requestId: req.id,
          expiresAt: result.expiresAt,
        },
      });
    } catch (error) {
      this.logger.warn("Failed to record production download audit trail", {
        error,
        customizationId,
        userId: req.user.id,
        requestId: req.id,
      });
    }

    res.json(successResponse(result));
  }

  private async handleListOrder(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new ApiError(AUTHENTICATION_REQUIRED_MESSAGE, { status: 401, code: "UNAUTHORIZED" });
    }

    const orderId = productionOrderIdParamSchema.parse(req.params.orderId);
    const result = await this.service.getOrderProductionFiles(orderId);

    res.json(successResponse(result));
  }
}
