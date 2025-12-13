/* eslint-disable unicorn/no-null -- Test fixtures emulate Prisma nullable fields. */

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { DesignSession, PrismaClient } from "@prisma/client";

import { ApiError } from "@/errors/api-error.js";
import type { CloudinaryClient } from "@/integrations/cloudinary/cloudinary.client.js";
import { ConflictError } from "@/lib/errors.js";
import type { PreviewLayerInput } from "@/integrations/cloudinary/cloudinary-overlay.js";
import type { PreviewService } from "@/modules/preview/preview.service.js";

import type { SessionRepository } from "../session.repository.js";
import { SessionService } from "../session.service.js";

const buildDesignSession = (overrides: Partial<DesignSession> = {}): DesignSession => {
  const now = overrides.createdAt ?? new Date("2025-02-01T10:00:00.000Z");

  return {
    id: "cksession0000000000000000000",
    userId: "ckuser0000000000000000000",
    productId: "ckprod0000000000000000000",
    designArea: "front",
    sessionData: { objects: [] },
    previewUrl: "https://cdn.lumi.test/preview.webp",
    thumbnailUrl: "https://cdn.lumi.test/preview-thumb.webp",
    shareToken: null,
    isPublic: false,
    viewCount: 0,
    lastEditedAt: now,
    expiresAt: new Date("2025-03-03T10:00:00.000Z"),
    deletedAt: null,
    purgeAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as DesignSession;
};

interface SessionRepositoryMock {
  createSession: jest.MockedFunction<SessionRepository["createSession"]>;
  getById: jest.MockedFunction<SessionRepository["getById"]>;
  updateSession: jest.MockedFunction<SessionRepository["updateSession"]>;
  findByShareToken: jest.MockedFunction<SessionRepository["findByShareToken"]>;
  incrementViewCount: jest.MockedFunction<SessionRepository["incrementViewCount"]>;
  findByUserId: jest.MockedFunction<SessionRepository["findByUserId"]>;
  softDeleteSession: jest.MockedFunction<SessionRepository["softDeleteSession"]>;
  cleanupExpired: jest.MockedFunction<SessionRepository["cleanupExpired"]>;
}

const buildRepositoryStub = (
  overrides: Partial<SessionRepositoryMock> = {},
): SessionRepositoryMock => ({
  createSession: jest.fn() as SessionRepositoryMock["createSession"],
  getById: jest.fn() as SessionRepositoryMock["getById"],
  updateSession: jest.fn() as SessionRepositoryMock["updateSession"],
  findByShareToken: jest.fn() as SessionRepositoryMock["findByShareToken"],
  incrementViewCount: jest.fn() as SessionRepositoryMock["incrementViewCount"],
  findByUserId: jest.fn() as SessionRepositoryMock["findByUserId"],
  softDeleteSession: jest.fn() as SessionRepositoryMock["softDeleteSession"],
  cleanupExpired: jest.fn() as SessionRepositoryMock["cleanupExpired"],
  ...overrides,
});

describe("SessionService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a new session and stores preview assets", async () => {
    const repository = buildRepositoryStub();

    const previewLayers: PreviewLayerInput[] = [
      {
        type: "text",
        text: "Hello",
        position: { x: 0, y: 0, width: 10, height: 10, rotation: 0 },
        style: { fontFamily: "Helvetica", fontSize: 24 },
      },
    ];

    const previewService = {
      buildCloudinaryTransformation: jest.fn(async () => ({
        basePublicId: "lumi/products/base-1",
        layers: previewLayers,
        resolution: "web",
      })),
    };

    const cloudinary = {
      generateImageUrl: jest
        .fn()
        .mockReturnValueOnce("https://cdn.lumi.test/preview.webp")
        .mockReturnValueOnce("https://cdn.lumi.test/thumb.webp"),
    };

    const created = buildDesignSession({
      previewUrl: "https://cdn.lumi.test/preview.webp",
      thumbnailUrl: "https://cdn.lumi.test/thumb.webp",
    });

    repository.createSession.mockResolvedValue(created);

    const now = new Date("2025-02-01T10:00:00.000Z");
    const service = new SessionService({
      prisma: {} as PrismaClient,
      repository: repository as unknown as SessionRepository,
      previewService: previewService as unknown as PreviewService,
      cloudinary: cloudinary as unknown as CloudinaryClient,
      now: () => now,
    });

    const result = await service.saveSession("ckuser0000000000000000000", {
      productId: "ckprod0000000000000000000",
      designArea: "front",
      layers: [
        {
          layerId: "layer-1",
          type: "text",
          text: "Hello",
          font: "Helvetica",
          fontSize: 24,
          position: { x: 0, y: 0, width: 10, height: 10, rotation: 0 },
          zIndex: 1,
        },
      ],
      sessionData: { objects: [] },
    });

    expect(result.previewUrl).toBe("https://cdn.lumi.test/preview.webp");
    expect(result.thumbnailUrl).toBe("https://cdn.lumi.test/thumb.webp");
    expect(repository.createSession).toHaveBeenCalledTimes(1);
    expect(cloudinary.generateImageUrl).toHaveBeenCalledTimes(2);
  });

  it("updates an existing session when sessionId is provided", async () => {
    const repository = buildRepositoryStub();
    const userId = "ckuser0000000000000000000";
    const existing = buildDesignSession({ id: "cksessionexisting000000000000000", userId });
    repository.getById.mockResolvedValue(existing);
    repository.updateSession.mockResolvedValue(existing);

    const previewService = {
      buildCloudinaryTransformation: jest.fn(async () => ({
        basePublicId: "lumi/products/base-1",
        layers: [],
        resolution: "web",
      })),
    };

    const cloudinary = {
      generateImageUrl: jest.fn().mockReturnValue("https://cdn.lumi.test/preview.webp"),
    };

    const service = new SessionService({
      prisma: {} as PrismaClient,
      repository: repository as unknown as SessionRepository,
      previewService: previewService as unknown as PreviewService,
      cloudinary: cloudinary as unknown as CloudinaryClient,
      now: () => new Date("2025-02-01T10:00:00.000Z"),
    });

    await service.saveSession(userId, {
      sessionId: existing.id,
      productId: existing.productId,
      designArea: existing.designArea,
      layers: [
        {
          layerId: "layer-1",
          type: "text",
          text: "Hello",
          font: "Helvetica",
          fontSize: 24,
          position: { x: 0, y: 0, width: 10, height: 10, rotation: 0 },
          zIndex: 1,
        },
      ],
      sessionData: { objects: [] },
    });

    expect(repository.updateSession).toHaveBeenCalledTimes(1);
  });

  it("rejects session updates from non-owners", async () => {
    const repository = buildRepositoryStub();
    const existing = buildDesignSession({ userId: "owner" });
    repository.getById.mockResolvedValue(existing);

    const previewService = {
      buildCloudinaryTransformation: jest.fn(async () => ({
        basePublicId: "lumi/products/base-1",
        layers: [],
        resolution: "web",
      })),
    };

    const cloudinary = {
      generateImageUrl: jest.fn().mockReturnValue("https://cdn.lumi.test/preview.webp"),
    };

    const service = new SessionService({
      prisma: {} as PrismaClient,
      repository: repository as unknown as SessionRepository,
      previewService: previewService as unknown as PreviewService,
      cloudinary: cloudinary as unknown as CloudinaryClient,
      now: () => new Date("2025-02-01T10:00:00.000Z"),
    });

    await expect(
      service.saveSession("attacker", {
        sessionId: existing.id,
        productId: existing.productId,
        designArea: existing.designArea,
        layers: [
          {
            layerId: "layer-1",
            type: "text",
            text: "Hello",
            font: "Helvetica",
            fontSize: 24,
            position: { x: 0, y: 0, width: 10, height: 10, rotation: 0 },
            zIndex: 1,
          },
        ],
        sessionData: { objects: [] },
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("retries share token generation when collisions occur", async () => {
    const repository = buildRepositoryStub();
    const userId = "ckuser0000000000000000000";
    const existing = buildDesignSession({ id: "cksessionexisting000000000000000", userId });
    repository.getById.mockResolvedValue(existing);

    repository.updateSession
      .mockRejectedValueOnce(new ConflictError("DesignSession already exists."))
      .mockResolvedValueOnce({ ...existing, isPublic: true, shareToken: "share_token" });

    const service = new SessionService({
      prisma: {} as PrismaClient,
      repository: repository as unknown as SessionRepository,
      previewService: {} as unknown as PreviewService,
      cloudinary: {} as unknown as CloudinaryClient,
      now: () => new Date("2025-02-01T10:00:00.000Z"),
    });

    const result = await service.shareSession(existing.id, userId);

    expect(result.shareToken).toBe("share_token");
    expect(repository.updateSession).toHaveBeenCalledTimes(2);
  });

  it("rejects expired shared sessions", async () => {
    const repository = buildRepositoryStub();
    const expired = buildDesignSession({
      isPublic: true,
      shareToken: "share_token",
      expiresAt: new Date("2024-01-01T00:00:00.000Z"),
    });

    repository.findByShareToken.mockResolvedValue(expired);

    const service = new SessionService({
      prisma: {} as PrismaClient,
      repository: repository as unknown as SessionRepository,
      previewService: {} as unknown as PreviewService,
      cloudinary: {} as unknown as CloudinaryClient,
      now: () => new Date("2025-02-01T10:00:00.000Z"),
    });

    await expect(service.getSharedSession("share_token")).rejects.toBeInstanceOf(ApiError);
  });
});
