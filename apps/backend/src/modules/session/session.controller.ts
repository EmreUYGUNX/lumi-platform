/* istanbul ignore file */

import type { Request, RequestHandler, Response } from "express";

import { recordAuditLog } from "@/audit/audit-log.service.js";
import { ApiError } from "@/errors/api-error.js";
import { asyncHandler } from "@/lib/asyncHandler.js";
import { createChildLogger } from "@/lib/logger.js";
import { paginatedResponse, successResponse } from "@/lib/response.js";

import type { SessionService } from "./session.service.js";
import {
  sessionIdParamSchema,
  sessionListQuerySchema,
  sessionSaveBodySchema,
  sessionShareTokenParamSchema,
} from "./session.validators.js";

const AUTHENTICATION_REQUIRED_MESSAGE = "Authentication required.";
const USER_AGENT_HEADER = "user-agent";

export interface SessionControllerOptions {
  service: SessionService;
}

export class SessionController {
  public readonly save: RequestHandler;

  public readonly get: RequestHandler;

  public readonly list: RequestHandler;

  public readonly delete: RequestHandler;

  public readonly share: RequestHandler;

  public readonly getShared: RequestHandler;

  private readonly service: SessionService;

  private readonly logger: ReturnType<typeof createChildLogger>;

  constructor(options: SessionControllerOptions) {
    this.service = options.service;
    this.logger = createChildLogger("session:controller");

    this.save = asyncHandler(this.handleSave.bind(this));
    this.get = asyncHandler(this.handleGet.bind(this));
    this.list = asyncHandler(this.handleList.bind(this));
    this.delete = asyncHandler(this.handleDelete.bind(this));
    this.share = asyncHandler(this.handleShare.bind(this));
    this.getShared = asyncHandler(this.handleGetShared.bind(this));
  }

  private async handleSave(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new ApiError(AUTHENTICATION_REQUIRED_MESSAGE, { status: 401, code: "UNAUTHORIZED" });
    }

    const body = sessionSaveBodySchema.parse(req.body ?? {});
    const result = await this.service.saveSession(req.user.id, body);

    try {
      await recordAuditLog({
        action: "design_session.save",
        entity: "design_session",
        entityId: result.id,
        userId: req.user.id,
        actorType: "CUSTOMER",
        ipAddress: req.ip,
        userAgent: req.get(USER_AGENT_HEADER) ?? undefined,
        metadata: {
          requestId: req.id,
          productId: result.productId,
          designArea: result.designArea,
        },
      });
    } catch (error) {
      this.logger.warn("Failed to record design session save audit trail", {
        error,
        sessionId: result.id,
        userId: req.user.id,
        requestId: req.id,
      });
    }

    res.json(successResponse(result));
  }

  private async handleGet(req: Request, res: Response): Promise<void> {
    const sessionId = sessionIdParamSchema.parse(req.params.id);
    const result = await this.service.getSession(sessionId, req.user?.id);
    res.json(successResponse(result));
  }

  private async handleList(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new ApiError(AUTHENTICATION_REQUIRED_MESSAGE, { status: 401, code: "UNAUTHORIZED" });
    }

    const query = sessionListQuerySchema.parse(req.query ?? {});
    const result = await this.service.listUserSessions(req.user.id, query);

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

  private async handleDelete(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new ApiError(AUTHENTICATION_REQUIRED_MESSAGE, { status: 401, code: "UNAUTHORIZED" });
    }

    const sessionId = sessionIdParamSchema.parse(req.params.id);
    await this.service.deleteSession(sessionId, req.user.id);

    try {
      await recordAuditLog({
        action: "design_session.delete",
        entity: "design_session",
        entityId: sessionId,
        userId: req.user.id,
        actorType: "CUSTOMER",
        ipAddress: req.ip,
        userAgent: req.get(USER_AGENT_HEADER) ?? undefined,
        metadata: {
          requestId: req.id,
        },
      });
    } catch (error) {
      this.logger.warn("Failed to record design session delete audit trail", {
        error,
        sessionId,
        userId: req.user.id,
        requestId: req.id,
      });
    }

    res.status(204).end();
  }

  private async handleShare(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new ApiError(AUTHENTICATION_REQUIRED_MESSAGE, { status: 401, code: "UNAUTHORIZED" });
    }

    const sessionId = sessionIdParamSchema.parse(req.params.id);
    const result = await this.service.shareSession(sessionId, req.user.id);

    try {
      await recordAuditLog({
        action: "design_session.share",
        entity: "design_session",
        entityId: sessionId,
        userId: req.user.id,
        actorType: "CUSTOMER",
        ipAddress: req.ip,
        userAgent: req.get(USER_AGENT_HEADER) ?? undefined,
        metadata: {
          requestId: req.id,
          shareToken: result.shareToken,
          expiresAt: result.expiresAt,
        },
      });
    } catch (error) {
      this.logger.warn("Failed to record design session share audit trail", {
        error,
        sessionId,
        userId: req.user.id,
        requestId: req.id,
      });
    }

    res.json(successResponse(result));
  }

  private async handleGetShared(req: Request, res: Response): Promise<void> {
    const token = sessionShareTokenParamSchema.parse(req.params.token);
    const result = await this.service.getSharedSession(token);

    try {
      await recordAuditLog({
        action: "design_session.view",
        entity: "design_session",
        entityId: result.id,
        actorType: req.user ? "CUSTOMER" : "ANONYMOUS",
        userId: req.user?.id,
        ipAddress: req.ip,
        userAgent: req.get(USER_AGENT_HEADER) ?? undefined,
        metadata: {
          requestId: req.id,
          shareToken: token,
        },
      });
    } catch (error) {
      this.logger.warn("Failed to record design session view audit trail", {
        error,
        sessionId: result.id,
        requestId: req.id,
      });
    }

    res.json(successResponse(result));
  }
}
