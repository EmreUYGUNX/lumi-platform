/* eslint-disable max-classes-per-file */

/* eslint-disable class-methods-use-this */

/* eslint-disable @typescript-eslint/no-empty-function */

/* eslint-disable no-useless-constructor */
import { randomUUID } from "node:crypto";
import { type promises as fsPromises } from "node:fs";

import { describe, expect, it, jest } from "@jest/globals";
import type { UploadApiResponse } from "cloudinary";

import { ApiError } from "@/errors/api-error.js";
import { runMediaCleanupJob } from "@/jobs/media-cleanup.job.js";
import type { MediaRepository } from "@/modules/media/media.repository.js";
import { MediaScanService } from "@/modules/media/media.security.js";
import type { MediaServiceOptions, PreparedUploadFile } from "@/modules/media/media.service.js";
import { MediaService } from "@/modules/media/media.service.js";
import { MediaThreatService } from "@/modules/media/media.threats.js";
import { createMediaQueueController } from "@/queues/media.queue.js";
import type { ApplicationConfig } from "@lumi/types";

import { createTestConfig } from "../../src/testing/config.js";

const queueAddMock = jest.fn();
const workerHandlers: Record<
  string,
  (job: { name: string; data: unknown; attemptsMade: number }) => Promise<void>
> = {};

jest.mock("bullmq", () => {
  class Queue {
    public readonly name: string;

    public readonly options: unknown;

    constructor(name: string, options: unknown) {
      this.name = name;
      this.options = options;
    }

    async add(name: string, data: unknown, opts: unknown) {
      queueAddMock(name, data, opts);
      return { id: `${name}-${Date.now()}` };
    }

    async close() {}
  }

  class Worker {
    public readonly on = jest.fn();

    constructor(
      name: string,
      handler: (job: { name: string; data: unknown; attemptsMade: number }) => Promise<void>,
    ) {
      workerHandlers[name] = handler;
    }

    async close() {}
  }

  class QueueEvents {
    public readonly on = jest.fn();

    constructor() {}

    async close() {}
  }

  return {
    Queue,
    Worker,
    QueueEvents,
  };
});

const idempotencyStore = {
  isDuplicate: jest.fn(async () => false),
  remember: jest.fn(async () => {}),
  shutdown: jest.fn(async () => {}),
};

const cloudinaryProcessor = {
  process: jest.fn(async () => {}),
};

jest.mock("@/webhooks/cloudinary.processor.js", () => ({
  CloudinaryWebhookProcessor: jest.fn(() => cloudinaryProcessor),
}));

jest.mock("@/webhooks/cloudinary.idempotency.js", () => ({
  createWebhookIdempotencyStore: () => idempotencyStore,
}));

const createMediaService = (overrides: Partial<MediaServiceOptions> = {}) => {
  const repository: MediaRepository = {
    createAsset: jest.fn(),
    list: jest.fn(),
    getById: jest.fn(),
    getByIdIncludingDeleted: jest.fn(),
    updateMetadata: jest.fn(),
    softDeleteAsset: jest.fn(),
    forceDeleteAsset: jest.fn(),
  } as unknown as MediaRepository;

  type UploadFn = (data: Buffer, options?: unknown) => Promise<UploadApiResponse>;
  const uploadMock = jest.fn() as jest.MockedFunction<UploadFn>;
  const deleteAssetMock = jest.fn() as jest.MockedFunction<
    (publicId: string, options?: Record<string, unknown>) => Promise<void>
  >;

  const cloudinaryClient = {
    upload: uploadMock,
    deleteAsset: deleteAssetMock,
    regenerateAsset: jest.fn(),
    generateImageUrl: jest.fn(),
    generateUploadSignature: jest.fn(),
  };

  const config = overrides.config ?? createTestConfig();

  const scanService =
    overrides.scanService ??
    new MediaScanService({
      enabled: false,
    });
  jest.spyOn(scanService, "scan").mockResolvedValue();

  type FileSystemSubset = Pick<typeof fsPromises, "mkdir" | "writeFile">;
  const noopFs: FileSystemSubset = {
    mkdir: async () => {},
    writeFile: async () => {},
  };

  const threatService =
    overrides.threatService ??
    new MediaThreatService({
      fileSystem: noopFs,
    });
  jest.spyOn(threatService, "quarantineUpload").mockResolvedValue({ storedAt: "/tmp/quarantine" });

  const service = new MediaService({
    repository: overrides.repository ?? repository,
    cloudinaryClient: overrides.cloudinaryClient ?? (cloudinaryClient as never),
    scanService,
    threatService,
    config,
  });

  return {
    service,
    repository: repository as jest.Mocked<MediaRepository>,
    cloudinaryClient,
    config,
  };
};

const createPreparedFile = (name: string, mimeType = "image/png"): PreparedUploadFile => ({
  fieldName: "files",
  originalName: name,
  size: 512 * 1024,
  mimeType,
  buffer: Buffer.from(name),
});

describe("media recovery scenarios", () => {
  beforeEach(() => {
    queueAddMock.mockClear();
    jest.clearAllMocks();
  });

  it("enqueues webhook events with retry metadata to withstand Cloudinary outages", async () => {
    const config = createTestConfig({
      runtime: { ci: false },
      app: { environment: "production" },
    }) as ApplicationConfig;
    const controller = createMediaQueueController({ config, driver: "bullmq" });
    const event = {
      id: randomUUID(),
      type: "upload",
      timestamp: Math.floor(Date.now() / 1000),
      signature: "signature",
      rawBodyChecksum: "checksum",
      attempt: 1,
      payload: {
        public_id: "lumi/products/demo",
      },
    };

    await controller.enqueueWebhookEvent({ event });

    expect(queueAddMock).toHaveBeenCalledWith(
      "media-webhook-event",
      { event },
      expect.objectContaining({
        attempts: 5,
        backoff: expect.objectContaining({ delay: 2000, type: "exponential" }),
      }),
    );
  });

  it("increments webhook attempt metadata on subsequent retries", async () => {
    const config = createTestConfig({
      runtime: { ci: false },
      app: { environment: "production" },
    }) as ApplicationConfig;
    createMediaQueueController({ config, driver: "bullmq" });
    const handler = workerHandlers["media-tasks"];
    expect(handler).toBeDefined();

    const event = {
      id: randomUUID(),
      type: "upload",
      timestamp: Math.floor(Date.now() / 1000),
      payload: {
        public_id: "lumi/products/demo",
      },
    };

    cloudinaryProcessor.process.mockRejectedValueOnce(new Error("temporary outage"));
    await expect(
      handler?.({
        name: "media-webhook-event",
        data: { event },
        attemptsMade: 1,
      }),
    ).rejects.toThrow("temporary outage");

    await handler?.({
      name: "media-webhook-event",
      data: { event },
      attemptsMade: 2,
    });

    expect(cloudinaryProcessor.process).toHaveBeenLastCalledWith(
      expect.objectContaining({ attempt: 3 }),
    );
  });

  it("rolls back orphaned uploads when persistence fails mid-flight", async () => {
    const { service, repository, cloudinaryClient, config } = createMediaService();
    const uploadResponse = {
      public_id: "lumi/products/rollback",
      secure_url: "https://cdn/rollback.png",
      url: "https://cdn/rollback.png",
      format: "png",
      resource_type: "image",
      type: "upload",
      bytes: 1024,
      width: 100,
      height: 100,
      version: 1,
      eager: [],
      tags: [],
    } as unknown as UploadApiResponse;

    cloudinaryClient.upload.mockResolvedValueOnce(uploadResponse);
    repository.createAsset.mockRejectedValueOnce(new ApiError("database offline", { status: 503 }));

    await expect(
      service.upload([createPreparedFile("rollback.png")], {
        folder: config.media.cloudinary.folders.products,
        tags: [],
        visibility: "public",
        metadata: {},
        uploadedById: "user_rollback",
      }),
    ).rejects.toThrow("database offline");

    expect(cloudinaryClient.deleteAsset).toHaveBeenCalledWith(uploadResponse.public_id, {
      invalidate: true,
    });
  });

  it("soft deletes orphaned media assets through the cleanup job", async () => {
    const orphanAssets = [{ id: "orphan_1" }, { id: "orphan_2" }];
    const repositoryMock = {
      findOrphans: jest.fn(async () => orphanAssets as never),
      softDeleteAsset: jest.fn(async () => {}),
    };

    const result = await runMediaCleanupJob(
      { dryRun: false, limit: 100, triggeredBy: "test" },
      {
        repository: repositoryMock as unknown as MediaRepository,
        prisma: {
          mediaAsset: {
            count: jest.fn(async () => 5),
          },
        } as never,
      },
    );

    expect(repositoryMock.findOrphans).toHaveBeenCalledWith(100);
    expect(repositoryMock.softDeleteAsset).toHaveBeenCalledTimes(orphanAssets.length);
    expect(result.orphansDeleted).toBe(orphanAssets.length);
  });
});
