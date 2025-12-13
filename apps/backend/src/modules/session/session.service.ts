import { randomBytes } from "node:crypto";

import type { DesignSession, Prisma, PrismaClient } from "@prisma/client";

import { ApiError } from "@/errors/api-error.js";
import type {
  CloudinaryClient,
  GenerateImageUrlOptions,
} from "@/integrations/cloudinary/cloudinary.client.js";
import { getCloudinaryClient } from "@/integrations/cloudinary/cloudinary.client.js";
import {
  applyImageOverlay,
  applyTextOverlay,
} from "@/integrations/cloudinary/cloudinary-overlay.js";
import type { PreviewLayerInput } from "@/integrations/cloudinary/cloudinary-overlay.js";
import { ConflictError } from "@/lib/errors.js";
import { createChildLogger } from "@/lib/logger.js";
import { getPrismaClient } from "@/lib/prisma.js";
import type { PaginatedResult } from "@/lib/repository/base.repository.js";
import { PreviewService } from "@/modules/preview/preview.service.js";

import { SessionRepository, type SessionListFilters } from "./session.repository.js";
import type { SessionListQuery, SessionSaveBody } from "./session.validators.js";

const SESSION_TTL_DAYS = 30;
const DELETE_RETENTION_DAYS = 7;
const SHARE_TOKEN_BYTES = 24;
const SHARE_TOKEN_MAX_ATTEMPTS = 5;

const addDays = (date: Date, days: number): Date =>
  new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

const toIso = (value: Date): string => value.toISOString();

const mergeSessionData = (
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Prisma.InputJsonValue => ({ ...base, ...patch }) as Prisma.InputJsonValue;

const buildShareUrl = (token: string): string => `/editor/shared/${token}`;

type TransformationDefinition = NonNullable<GenerateImageUrlOptions["transformation"]>;

const buildOverlaySteps = (layers: PreviewLayerInput[]): Record<string, unknown>[] =>
  layers.map((layer) => {
    if (layer.type === "text") {
      return applyTextOverlay(layer.text, layer.style, layer.position);
    }

    return applyImageOverlay(layer.publicId, layer.transform, layer.position);
  });

const WEB_OUTPUT_STEP = {
  width: 1200,
  crop: "limit",
  quality: "80",
  format: "webp",
  fetch_format: "webp",
} as const;

const THUMBNAIL_OUTPUT_STEP = {
  width: 300,
  height: 300,
  crop: "fill",
  gravity: "auto",
  quality: "70",
  format: "webp",
  fetch_format: "webp",
} as const;

const createShareToken = (): string => randomBytes(SHARE_TOKEN_BYTES).toString("base64url");

export interface DesignSessionView {
  id: string;
  userId?: string | null;
  productId: string;
  designArea: string;
  sessionData: unknown;
  previewUrl?: string | null;
  thumbnailUrl?: string | null;
  shareToken?: string | null;
  isPublic: boolean;
  viewCount: number;
  lastEditedAt: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface DesignSessionSummaryView {
  id: string;
  productId: string;
  designArea: string;
  previewUrl?: string | null;
  thumbnailUrl?: string | null;
  isPublic: boolean;
  shareToken?: string | null;
  lastEditedAt: string;
  expiresAt: string;
}

export interface DesignSessionShareResult {
  sessionId: string;
  shareToken: string;
  shareUrl: string;
  expiresAt: string;
}

export interface SessionServiceOptions {
  prisma?: PrismaClient;
  repository?: SessionRepository;
  previewService?: PreviewService;
  cloudinary?: CloudinaryClient;
  logger?: ReturnType<typeof createChildLogger>;
  now?: () => Date;
}

export class SessionService {
  private readonly prisma: PrismaClient;

  private readonly repository: SessionRepository;

  private readonly previewService: PreviewService;

  private readonly cloudinary: CloudinaryClient;

  private readonly logger: ReturnType<typeof createChildLogger>;

  private readonly now: () => Date;

  constructor(options: SessionServiceOptions = {}) {
    this.prisma = options.prisma ?? getPrismaClient();
    this.repository = options.repository ?? new SessionRepository(this.prisma);
    this.previewService = options.previewService ?? new PreviewService({ prisma: this.prisma });
    this.cloudinary = options.cloudinary ?? getCloudinaryClient();
    this.logger = options.logger ?? createChildLogger("session:service");
    this.now = options.now ?? (() => new Date());
  }

  private static toView(session: DesignSession): DesignSessionView {
    return {
      id: session.id,
      userId: session.userId,
      productId: session.productId,
      designArea: session.designArea,
      sessionData: session.sessionData,
      previewUrl: session.previewUrl,
      thumbnailUrl: session.thumbnailUrl,
      shareToken: session.shareToken,
      isPublic: session.isPublic,
      viewCount: session.viewCount,
      lastEditedAt: toIso(session.lastEditedAt),
      expiresAt: toIso(session.expiresAt),
      createdAt: toIso(session.createdAt),
      updatedAt: toIso(session.updatedAt),
    };
  }

  private static toSummary(session: DesignSession): DesignSessionSummaryView {
    return {
      id: session.id,
      productId: session.productId,
      designArea: session.designArea,
      previewUrl: session.previewUrl,
      thumbnailUrl: session.thumbnailUrl,
      shareToken: session.shareToken,
      isPublic: session.isPublic,
      lastEditedAt: toIso(session.lastEditedAt),
      expiresAt: toIso(session.expiresAt),
    };
  }

  private async generatePreviewAssets(
    userId: string,
    input: Pick<SessionSaveBody, "productId" | "designArea" | "layers">,
  ): Promise<{ previewUrl: string; thumbnailUrl: string }> {
    const transformation = await this.previewService.buildCloudinaryTransformation(
      input.productId,
      {
        designArea: input.designArea,
        resolution: "web",
        layers: input.layers,
      },
      userId,
    );

    const { basePublicId, layers } = transformation;
    const overlaySteps = buildOverlaySteps(layers);

    const previewUrl = this.cloudinary.generateImageUrl(basePublicId, {
      transformation: [...overlaySteps, WEB_OUTPUT_STEP] as unknown as TransformationDefinition,
      secure: true,
    });

    const thumbnailUrl = this.cloudinary.generateImageUrl(basePublicId, {
      transformation: [
        ...overlaySteps,
        THUMBNAIL_OUTPUT_STEP,
      ] as unknown as TransformationDefinition,
      secure: true,
    });

    return { previewUrl, thumbnailUrl };
  }

  async saveSession(userId: string, input: SessionSaveBody): Promise<DesignSessionView> {
    const now = this.now();
    const expiresAt = addDays(now, SESSION_TTL_DAYS);

    const assets = await this.generatePreviewAssets(userId, input);

    const sessionData = mergeSessionData(input.sessionData, {
      layers: input.layers,
      productId: input.productId,
      designArea: input.designArea,
    });

    if (input.sessionId) {
      const existing = await this.repository.getById(input.sessionId);
      if (!existing) {
        throw new ApiError("Session not found.", { status: 404, code: "NOT_FOUND" });
      }

      if (!existing.userId || existing.userId !== userId) {
        throw new ApiError("You do not have access to this session.", {
          status: 403,
          code: "FORBIDDEN",
        });
      }

      const updated = await this.repository.updateSession(existing.id, {
        product: { connect: { id: input.productId } },
        designArea: input.designArea,
        sessionData,
        previewUrl: assets.previewUrl,
        thumbnailUrl: assets.thumbnailUrl,
        lastEditedAt: now,
        expiresAt,
      });

      return SessionService.toView(updated);
    }

    const created = await this.repository.createSession({
      user: { connect: { id: userId } },
      product: { connect: { id: input.productId } },
      designArea: input.designArea,
      sessionData,
      previewUrl: assets.previewUrl,
      thumbnailUrl: assets.thumbnailUrl,
      lastEditedAt: now,
      expiresAt,
      isPublic: false,
    });

    return SessionService.toView(created);
  }

  async getSession(id: string, userId?: string): Promise<DesignSessionView> {
    const session = await this.repository.getById(id);
    if (!session) {
      throw new ApiError("Session not found.", { status: 404, code: "NOT_FOUND" });
    }

    const now = this.now();
    if (session.expiresAt.getTime() <= now.getTime()) {
      throw new ApiError("Session not found or expired.", { status: 404, code: "NOT_FOUND" });
    }

    const isOwner = Boolean(userId && session.userId === userId);
    if (!isOwner && !session.isPublic) {
      throw new ApiError("You do not have access to this session.", {
        status: userId ? 403 : 401,
        code: userId ? "FORBIDDEN" : "UNAUTHORIZED",
      });
    }

    return SessionService.toView(session);
  }

  async getSharedSession(token: string): Promise<DesignSessionView> {
    const session = await this.repository.findByShareToken(token);
    if (!session) {
      throw new ApiError("Shared session not found.", { status: 404, code: "NOT_FOUND" });
    }

    const now = this.now();
    if (session.expiresAt.getTime() <= now.getTime()) {
      throw new ApiError("Shared session expired.", { status: 404, code: "NOT_FOUND" });
    }

    const updated = await this.repository.incrementViewCount(session.id);
    return SessionService.toView(updated);
  }

  async listUserSessions(
    userId: string,
    query: SessionListQuery,
  ): Promise<PaginatedResult<DesignSessionSummaryView>> {
    const filters: SessionListFilters = {
      productId: query.productId,
      order: query.order ?? "desc",
    };

    const result = await this.repository.findByUserId(
      userId,
      filters,
      {
        page: query.page ?? 1,
        pageSize: query.perPage ?? 24,
      },
      {
        now: this.now(),
      },
    );

    return {
      items: result.items.map((session) => SessionService.toSummary(session)),
      meta: result.meta,
    };
  }

  async deleteSession(id: string, userId: string): Promise<void> {
    const session = await this.repository.getById(id);
    if (!session) {
      throw new ApiError("Session not found.", { status: 404, code: "NOT_FOUND" });
    }

    if (!session.userId || session.userId !== userId) {
      throw new ApiError("You do not have access to this session.", {
        status: 403,
        code: "FORBIDDEN",
      });
    }

    const purgeAt = addDays(this.now(), DELETE_RETENTION_DAYS);
    await this.repository.softDeleteSession(id, { purgeAt });

    this.logger.info("Design session soft-deleted", {
      sessionId: id,
      userId,
      purgeAt: purgeAt.toISOString(),
    });
  }

  private async rotateShareToken(sessionId: string, expiresAt: Date): Promise<DesignSession> {
    let lastError: unknown;

    for (let attempt = 0; attempt < SHARE_TOKEN_MAX_ATTEMPTS; attempt += 1) {
      const shareToken = createShareToken();

      try {
        // eslint-disable-next-line no-await-in-loop -- Retrying on unique constraint collisions is bounded and sequential.
        return await this.repository.updateSession(sessionId, {
          shareToken,
          isPublic: true,
          expiresAt,
        });
      } catch (error) {
        lastError = error;
        if (!(error instanceof ConflictError)) {
          throw error;
        }
      }
    }

    throw new ApiError("Unable to generate a unique share token.", {
      status: 500,
      code: "INTERNAL_SERVER_ERROR",
      cause: lastError,
    });
  }

  async shareSession(id: string, userId: string): Promise<DesignSessionShareResult> {
    const session = await this.repository.getById(id);
    if (!session) {
      throw new ApiError("Session not found.", { status: 404, code: "NOT_FOUND" });
    }

    if (!session.userId || session.userId !== userId) {
      throw new ApiError("You do not have access to this session.", {
        status: 403,
        code: "FORBIDDEN",
      });
    }

    const now = this.now();
    if (session.expiresAt.getTime() <= now.getTime()) {
      throw new ApiError("Session not found or expired.", { status: 404, code: "NOT_FOUND" });
    }

    const expiresAt = addDays(now, SESSION_TTL_DAYS);
    const updated = await this.rotateShareToken(id, expiresAt);

    if (!updated.shareToken) {
      throw new ApiError("Failed to generate share link.", {
        status: 500,
        code: "INTERNAL_SERVER_ERROR",
      });
    }

    return {
      sessionId: updated.id,
      shareToken: updated.shareToken,
      shareUrl: buildShareUrl(updated.shareToken),
      expiresAt: updated.expiresAt.toISOString(),
    };
  }

  cleanupExpired = async (): Promise<{ deleted: number }> => {
    return this.repository.cleanupExpired(this.now());
  };
}
