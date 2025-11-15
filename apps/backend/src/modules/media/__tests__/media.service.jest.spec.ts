import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { MediaAsset } from "@prisma/client";
import type { UploadApiResponse } from "cloudinary";

import { ApiError } from "@/errors/api-error.js";
import type { CloudinaryClient } from "@/integrations/cloudinary/cloudinary.client.js";
import type { ApplicationConfig } from "@lumi/types";

import { createTestConfig } from "../../../testing/config.js";
import type { MediaRepository } from "../media.repository.js";
import type { MediaScanService } from "../media.security.js";
import { MediaService, type PreparedUploadFile } from "../media.service.js";

const createMockAsset = (): MediaAsset => ({
  id: "asset_123",
  publicId: "lumi/products/test",
  url: "http://cdn/image.jpg",
  secureUrl: "https://cdn/image.jpg",
  format: "jpg",
  resourceType: "image",
  type: "upload",
  width: 800,
  height: 600,
  bytes: 1024,
  folder: "lumi/products",
  version: 1,
  tags: [],
  metadata: {},
  uploadedById: "user_1",
  // eslint-disable-next-line unicorn/no-null -- Prisma models use null to represent soft deletions
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const createUploadResponse = (overrides: Partial<UploadApiResponse> = {}): UploadApiResponse =>
  ({
    public_id: "lumi/products/test",
    url: "http://cdn/image.jpg",
    secure_url: "https://cdn/image.jpg",
    format: "jpg",
    resource_type: "image",
    type: "upload",
    width: 800,
    height: 600,
    bytes: 1024,
    folder: "lumi/products",
    version: 1,
    tags: ["sample"],
    eager: [
      { secure_url: "https://cdn/thumb.jpg" },
      { secure_url: "https://cdn/medium.jpg" },
      { secure_url: "https://cdn/large.jpg" },
    ],
    created_at: new Date().toISOString(),
    signature: "sig",
    original_filename: "upload",
    moderation: [],
    access_mode: "public",
    placeholder: false,
    bytes_offset: 0,
    etag: "etag",
    ...overrides,
  }) as UploadApiResponse;

const file = (name: string, mimeType = "image/png"): PreparedUploadFile => ({
  fieldName: "files",
  originalName: name,
  mimeType,
  size: 1024,
  buffer: Buffer.from("binary content"),
});

describe("MediaService", () => {
  let repository: MediaRepository;
  let cloudinary: jest.Mocked<CloudinaryClient>;
  let scanner: jest.Mocked<MediaScanService>;
  let config: ApplicationConfig;
  let createAssetMock: jest.MockedFunction<MediaRepository["createAsset"]>;
  let listMock: jest.MockedFunction<MediaRepository["list"]>;
  let getByIdMock: jest.MockedFunction<MediaRepository["getById"]>;
  let getByIdIncludingDeletedMock: jest.MockedFunction<MediaRepository["getByIdIncludingDeleted"]>;
  let updateMetadataMock: jest.MockedFunction<MediaRepository["updateMetadata"]>;
  let softDeleteMock: jest.MockedFunction<MediaRepository["softDeleteAsset"]>;
  let forceDeleteMock: jest.MockedFunction<MediaRepository["forceDeleteAsset"]>;
  let uploadMock: jest.MockedFunction<CloudinaryClient["upload"]>;
  let deleteAssetMock: jest.MockedFunction<CloudinaryClient["deleteAsset"]>;

  const createService = () =>
    new MediaService({
      repository,
      cloudinaryClient: cloudinary,
      scanService: scanner,
      config,
    });

  beforeEach(() => {
    createAssetMock = jest.fn(async () => createMockAsset());
    listMock = jest.fn(async () => ({
      items: [createMockAsset()],
      meta: {
        totalItems: 1,
        page: 1,
        pageSize: 25,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    }));
    getByIdMock = jest.fn(async () => createMockAsset());
    getByIdIncludingDeletedMock = jest.fn(async () => createMockAsset());
    updateMetadataMock = jest.fn(async () => createMockAsset());
    softDeleteMock = jest.fn(async () => createMockAsset());
    forceDeleteMock = jest.fn(async () => createMockAsset());
    repository = {
      createAsset: createAssetMock,
      list: listMock,
      getById: getByIdMock,
      getByIdIncludingDeleted: getByIdIncludingDeletedMock,
      updateMetadata: updateMetadataMock,
      softDeleteAsset: softDeleteMock,
      forceDeleteAsset: forceDeleteMock,
    } as unknown as MediaRepository;

    uploadMock = jest.fn(async () => createUploadResponse());
    deleteAssetMock = jest.fn(async () => ({}));

    cloudinary = {
      upload: uploadMock,
      deleteAsset: deleteAssetMock,
      regenerateAsset: jest.fn(async () => createUploadResponse()),
      generateImageUrl: jest.fn(() => "https://cdn/responsive.jpg"),
      generateUploadSignature: jest.fn(() => ({
        signature: "signature",
        timestamp: 123,
        expiresAt: new Date().toISOString(),
        folder: "lumi/products",
        apiKey: "key",
        cloudName: "cloud",
        params: {},
      })),
    } as unknown as jest.Mocked<CloudinaryClient>;

    scanner = {
      scan: jest.fn(async () => {}),
    } as unknown as jest.Mocked<MediaScanService>;

    config = createTestConfig();
  });

  it("rejects unsupported mime types before attempting upload", async () => {
    const service = createService();
    await expect(
      service.upload([file("document.pdf", "application/pdf")], {
        folder: "lumi/products",
        tags: [],
        visibility: "public",
        uploadedById: "user_1",
      }),
    ).rejects.toMatchObject({ status: 415 });
    expect(cloudinary.upload).not.toHaveBeenCalled();
  });

  it("uploads media, persists metadata, and returns transformation map", async () => {
    const service = createService();
    const result = await service.upload([file("photo.png")], {
      folder: "lumi/products",
      tags: ["product:123"],
      metadata: { variant: "primary" },
      visibility: "public",
      uploadedById: "user_1",
    });

    expect(scanner.scan).toHaveBeenCalled();
    expect(createAssetMock.mock.calls[0]?.[0]).toMatchObject(
      expect.objectContaining({
        publicId: "lumi/products/test",
        metadata: expect.objectContaining({
          originalFilename: "photo.png",
          visibility: "public",
        }),
      }),
    );
    expect(result.uploads).toHaveLength(1);
    const firstUpload = result.uploads[0];
    expect(firstUpload).toBeDefined();
    expect(firstUpload?.transformations.thumbnail).toBeDefined();
    expect(result.failures).toHaveLength(0);
  });

  it("records partial failures and cleans up orphaned uploads", async () => {
    createAssetMock
      .mockResolvedValueOnce(createMockAsset())
      .mockRejectedValueOnce(new ApiError("database error", { status: 500 }));
    uploadMock
      .mockResolvedValueOnce(createUploadResponse({ public_id: "lumi/products/first" }))
      .mockResolvedValueOnce(createUploadResponse({ public_id: "lumi/products/second" }));

    const service = createService();
    const result = await service.upload([file("first.jpg"), file("second.jpg")], {
      folder: "lumi/products",
      tags: [],
      visibility: "public",
      uploadedById: "user_1",
    });

    expect(result.uploads).toHaveLength(1);
    expect(result.failures).toHaveLength(1);
    expect(deleteAssetMock).toHaveBeenCalledWith("lumi/products/second", {
      invalidate: true,
    });
  });

  it("requires at least one file before attempting upload", async () => {
    const service = createService();
    await expect(
      service.upload([], {
        folder: config.media.cloudinary.folders.products,
        tags: [],
        visibility: "public",
        uploadedById: "user_1",
      }),
    ).rejects.toMatchObject({
      status: 400,
      code: "NO_FILES",
    });
  });

  it("enforces folder-specific file size limits", async () => {
    const service = createService();
    const oversized = {
      ...file("hero.png"),
      size: 11 * 1024 * 1024,
    };

    await expect(
      service.upload([oversized], {
        folder: config.media.cloudinary.folders.banners,
        tags: [],
        visibility: "public",
        uploadedById: "user_1",
      }),
    ).rejects.toMatchObject({
      status: 413,
    });
    expect(cloudinary.upload).not.toHaveBeenCalled();
  });

  it("throws when every upload in the batch fails", async () => {
    uploadMock.mockRejectedValue(new ApiError("ingest-failed", { status: 502 }));
    const service = createService();

    await expect(
      service.upload([file("one.png"), file("two.png")], {
        folder: config.media.cloudinary.folders.products,
        tags: [],
        visibility: "public",
        uploadedById: "user_1",
      }),
    ).rejects.toThrow("ingest-failed");
  });

  it("lists media assets and maps repository payloads", async () => {
    const service = createService();
    const result = await service.listAssets({ page: 1 });

    expect(listMock).toHaveBeenCalledWith(
      expect.objectContaining({ includeDeleted: undefined }),
      expect.objectContaining({ page: 1 }),
    );
    expect(result.items[0]?.transformations.original).toBe("https://cdn/image.jpg");
  });

  it("throws when requesting a missing asset", async () => {
    // eslint-disable-next-line unicorn/no-null -- Repository returns null when record missing
    getByIdMock.mockResolvedValueOnce(null);
    const service = createService();
    await expect(service.getAsset("missing")).rejects.toMatchObject({ status: 404 });
  });

  it("updates asset metadata when actor is uploader", async () => {
    const service = createService();
    await service.updateAsset(
      "asset_123",
      { tags: ["hero"] },
      {
        userId: "user_1",
        roles: ["customer"],
      },
    );

    expect(updateMetadataMock).toHaveBeenCalledWith(
      "asset_123",
      expect.objectContaining({ tags: ["hero"] }),
    );
  });

  it("regenerates assets via Cloudinary explicit API", async () => {
    const service = createService();
    const asset = await service.regenerateAsset("asset_123", {
      userId: "admin_1",
      roles: ["admin"],
    });

    expect(cloudinary.regenerateAsset).toHaveBeenCalledWith(
      "lumi/products/test",
      expect.any(Object),
    );
    expect(asset.transformations.thumbnail).toBeDefined();
  });

  it("prevents soft delete when asset is in use", async () => {
    getByIdMock.mockResolvedValueOnce({
      ...createMockAsset(),
      products: [{ id: "prod", title: "Demo", slug: "demo" }],
    } as never);
    const service = createService();
    await expect(
      service.softDeleteAsset("asset_123", { userId: "admin", roles: ["admin"] }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("hard deletes assets that were previously soft deleted", async () => {
    getByIdIncludingDeletedMock.mockResolvedValueOnce({
      ...createMockAsset(),
      deletedAt: new Date(),
    });
    const service = createService();
    await service.hardDeleteAsset("asset_123", { userId: "admin", roles: ["admin"] });

    expect(cloudinary.deleteAsset).toHaveBeenCalledWith("lumi/products/test", {
      resourceType: "image",
      invalidate: true,
    });
    expect(forceDeleteMock).toHaveBeenCalledWith("asset_123");
  });
});
