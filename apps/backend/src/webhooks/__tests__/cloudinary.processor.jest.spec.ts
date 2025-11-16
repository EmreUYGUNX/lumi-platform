import type { MediaAsset, PrismaClient } from "@prisma/client";

import type { MediaRepository } from "@/modules/media/media.repository.js";
import { CloudinaryWebhookProcessor } from "@/webhooks/cloudinary.processor.js";
import type { CloudinaryWebhookEvent } from "@/webhooks/cloudinary.types.js";

const createAsset = (overrides: Partial<MediaAsset> = {}): MediaAsset => ({
  id: "asset_1",
  publicId: "sample",
  url: "http://example.com/image.jpg",
  secureUrl: "https://example.com/image.jpg",
  format: "jpg",
  resourceType: "image",
  type: "upload",
  width: 100,
  height: 100,
  bytes: 1234,
  folder: "sample",
  version: 1,
  tags: [],
  metadata: {},
  uploadedById: "user_1",
  deletedAt: new Date(0),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const createEvent = (
  type: string,
  payload: Partial<CloudinaryWebhookEvent["payload"]>,
): CloudinaryWebhookEvent => ({
  id: payload.notification_id ?? "evt_123",
  type,
  payload: payload as CloudinaryWebhookEvent["payload"],
  timestamp: Math.floor(Date.now() / 1000),
  signature: "signature",
  rawBodyChecksum: "checksum",
  attempt: 1,
});

describe("CloudinaryWebhookProcessor", () => {
  it("updates assets on upload events", async () => {
    const asset = createAsset();
    const repository: Partial<MediaRepository> = {
      findByPublicId: jest.fn().mockResolvedValue(asset),
      updateMetadata: jest.fn().mockResolvedValue(asset),
    };

    const processor = new CloudinaryWebhookProcessor({
      repository: repository as MediaRepository,
      prisma: {} as PrismaClient,
    });

    await processor.process(
      createEvent("upload", {
        notification_id: "evt_upload",
        public_id: "sample",
        width: 200,
        height: 200,
        bytes: 2000,
      }),
    );

    expect(repository.findByPublicId).toHaveBeenCalledWith("sample");
    expect(repository.updateMetadata).toHaveBeenCalledWith(
      asset.id,
      expect.objectContaining({
        width: 200,
        height: 200,
        bytes: 2000,
      }),
    );
  });

  it("soft deletes assets on delete events", async () => {
    const asset = createAsset();
    const repository: Partial<MediaRepository> = {
      findByPublicId: jest.fn().mockResolvedValue(asset),
      updateMetadata: jest.fn(),
      softDeleteAsset: jest.fn(),
    };

    const processor = new CloudinaryWebhookProcessor({
      repository: repository as MediaRepository,
      prisma: {} as PrismaClient,
    });

    await processor.process(
      createEvent("delete", {
        notification_id: "evt_delete",
        public_id: "sample",
      }),
    );

    expect(repository.softDeleteAsset).toHaveBeenCalledWith(asset.id);
    expect(repository.updateMetadata).toHaveBeenCalled();
  });

  it("records derived transformations", async () => {
    const asset = createAsset();
    const repository: Partial<MediaRepository> = {
      findByPublicId: jest.fn().mockResolvedValue(asset),
      updateMetadata: jest.fn(),
    };

    const processor = new CloudinaryWebhookProcessor({
      repository: repository as MediaRepository,
      prisma: {} as PrismaClient,
    });

    await processor.process(
      createEvent("derived", {
        notification_id: "evt_derived",
        public_id: "sample",
        derived: [
          {
            id: "thumb",
            secure_url: "https://example.com/thumb.jpg",
            transformation: "c_fill,w_300,h_300",
          },
        ],
      }),
    );

    expect(repository.updateMetadata).toHaveBeenCalledWith(
      asset.id,
      expect.objectContaining({
        metadata: expect.objectContaining({
          derived: expect.objectContaining({
            "c_fill,w_300,h_300": expect.objectContaining({
              secureUrl: "https://example.com/thumb.jpg",
            }),
          }),
        }),
      }),
    );
  });

  it("soft deletes on rejected moderation events", async () => {
    const asset = createAsset();
    const repository: Partial<MediaRepository> = {
      findByPublicId: jest.fn().mockResolvedValue(asset),
      updateMetadata: jest.fn(),
      softDeleteAsset: jest.fn(),
    };

    const processor = new CloudinaryWebhookProcessor({
      repository: repository as MediaRepository,
      prisma: {} as PrismaClient,
    });

    await processor.process(
      createEvent("moderation", {
        notification_id: "evt_mod",
        public_id: "sample",
        moderation_status: "rejected",
      }),
    );

    expect(repository.softDeleteAsset).toHaveBeenCalledWith(asset.id);
  });
});
