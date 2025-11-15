import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Express, Request, Response } from "express";

import { UnauthorizedError, ValidationError } from "@/lib/errors.js";
import { successResponse } from "@/lib/response.js";

import { createTestConfig } from "../../../testing/config.js";
import { MediaController } from "../media.controller.js";
import type { MediaService, MediaUploadResult } from "../media.service.js";

const config = createTestConfig();

const createMockResponse = () => {
  const res = {
    json: jest.fn().mockImplementation((payload) => payload),
    setHeader: jest.fn(),
    status: jest.fn().mockReturnThis(),
    end: jest.fn(),
    locals: {},
  } as Partial<Response>;
  return res as Response;
};

const createExpressFile = (): Express.Multer.File =>
  ({
    buffer: Buffer.from("test"),
    fieldname: "files",
    mimetype: "image/png",
    originalname: "product.png",
    size: 512,
    destination: "",
    encoding: "7bit",
    filename: "product.png",
    path: "",
    stream: undefined,
  }) as unknown as Express.Multer.File;

const buildAssetView = () => ({
  id: "cktestasset000000000000000",
  publicId: "lumi/products/demo",
  folder: "lumi/products",
  format: "png",
  width: 800,
  height: 600,
  bytes: 1024,
  url: "http://cdn/image.jpg",
  secureUrl: "https://cdn/image.jpg",
  metadata: {},
  resourceType: "image",
  type: "upload",
  tags: ["hero"],
  version: 1,
  transformations: {},
  createdAt: new Date("2025-01-01T00:00:00Z"),
  updatedAt: new Date("2025-01-02T00:00:00Z"),
  deletedAt: undefined,
  usage: { products: [], variants: [] },
});

describe("media.controller", () => {
  let service: jest.Mocked<MediaService>;
  let controller: MediaController;

  beforeEach(() => {
    service = {
      upload: jest.fn(),
      generateUploadSignature: jest.fn(),
      listAssets: jest.fn(),
      getAsset: jest.fn(),
      updateAsset: jest.fn(),
      regenerateAsset: jest.fn(),
      softDeleteAsset: jest.fn(),
      hardDeleteAsset: jest.fn(),
      getAuditEntity: jest.fn().mockReturnValue("media.assets"),
    } as unknown as jest.Mocked<MediaService>;
    controller = new MediaController({
      service,
      config,
    });
  });

  it("handles successful uploads and forwards parsed payload", async () => {
    const req = {
      body: { tags: " hero " },
      files: [createExpressFile()],
      user: { id: "user_1" },
    } as unknown as Request;

    const responsePayload: MediaUploadResult = {
      uploads: [
        {
          id: "asset_1",
          publicId: "lumi/products/demo",
          folder: "lumi/products",
          format: "png",
          width: 100,
          height: 100,
          bytes: 512,
          url: "http://example.com",
          secureUrl: "https://example.com",
          metadata: {},
          resourceType: "image",
          type: "upload",
          tags: ["hero"],
          version: 1,
          transformations: {},
        },
      ],
      failures: [],
    };

    service.upload.mockResolvedValueOnce(responsePayload);
    const res = createMockResponse();
    const next = jest.fn();

    await controller.upload(req, res, next);
    expect(service.upload).toHaveBeenCalledWith(
      [expect.objectContaining({ originalName: "product.png" })],
      expect.objectContaining({ uploadedById: "user_1" }),
    );

    expect(res.json).toHaveBeenCalledWith(
      successResponse(responsePayload, {
        counts: { total: 1, uploaded: 1, failed: 0 },
        partialFailure: false,
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("handles partial failures and aggregates meta counts", async () => {
    const req = {
      body: {},
      files: {
        hero: [createExpressFile()],
        gallery: createExpressFile(),
      },
      user: { id: "user_2" },
    } as unknown as Request;

    const partial: MediaUploadResult = {
      uploads: [
        {
          id: "asset_success",
          publicId: "lumi/products/success",
          folder: "lumi/products",
          format: "png",
          width: 200,
          height: 200,
          bytes: 512,
          url: "http://example.com/success",
          secureUrl: "https://example.com/success",
          metadata: {},
          resourceType: "image",
          type: "upload",
          tags: ["hero"],
          version: 1,
          transformations: {},
        },
      ],
      failures: [
        {
          fileName: "failed.png",
          message: "Virus detected",
          code: "MALWARE",
        },
      ],
    };

    service.upload.mockResolvedValueOnce(partial);
    const res = createMockResponse();

    await controller.upload(req, res, jest.fn());

    expect(service.upload).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ originalName: "product.png" }),
        expect.objectContaining({ originalName: "product.png" }),
      ]),
      expect.objectContaining({ uploadedById: "user_2" }),
    );

    expect(res.json).toHaveBeenCalledWith(
      successResponse(partial, {
        counts: { total: 2, uploaded: 1, failed: 1 },
        partialFailure: true,
      }),
    );
  });

  it("bubbles validation errors when files are missing", async () => {
    const req = {
      body: {},
      files: [],
      user: { id: "user_1" },
    } as unknown as Request;

    const res = createMockResponse();
    const next = jest.fn();

    await controller.upload(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
  });

  it("records LCP metrics via telemetry endpoint", async () => {
    const req = {
      body: { value: 950, route: "/products/demo" },
    } as unknown as Request;

    const res = createMockResponse();
    await controller.recordLcpMetric(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith(successResponse({ recorded: true }));
  });

  it("bubbles validation errors when too many files are submitted", async () => {
    const req = {
      body: {},
      files: Array.from({ length: 11 }, () => createExpressFile()),
      user: { id: "user_3" },
    } as unknown as Request;

    const res = createMockResponse();
    const next = jest.fn();

    await controller.upload(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
  });

  it("rejects unauthenticated upload requests", async () => {
    const req = {
      body: {},
      files: [createExpressFile()],
    } as unknown as Request;

    const res = createMockResponse();
    const next = jest.fn();

    await controller.upload(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it("rejects unauthenticated signature requests", async () => {
    const req = {
      body: {},
    } as unknown as Request;

    const res = createMockResponse();
    const next = jest.fn();

    await controller.signature(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it("passes signature generation through to service", async () => {
    service.generateUploadSignature.mockResolvedValue({
      signature: "sig",
      timestamp: 123,
      expiresAt: new Date().toISOString(),
      folder: config.media.cloudinary.folders.products,
      apiKey: "key",
      cloudName: "cloud",
      params: {},
    });

    const req = {
      body: {},
      user: { id: "user" },
    } as unknown as Request;

    const res = createMockResponse();
    await controller.signature(req, res, jest.fn());

    expect(service.generateUploadSignature).toHaveBeenCalledWith(
      expect.objectContaining({ folder: config.media.cloudinary.folders.products }),
    );
    expect(res.json).toHaveBeenCalled();
  });

  it("lists media assets with pagination metadata and caching headers", async () => {
    const asset = buildAssetView();
    service.listAssets.mockResolvedValue({
      items: [asset],
      meta: {
        totalItems: 1,
        page: 1,
        pageSize: 25,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    });

    const req = {
      query: { page: "1" },
      headers: {},
    } as unknown as Request;

    const res = createMockResponse();

    await controller.list(req, res, jest.fn());
    expect(service.listAssets).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "private, max-age=300");
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.arrayContaining([asset]),
      }),
    );
  });

  it("returns asset detail with cache headers", async () => {
    const asset = buildAssetView();
    service.getAsset.mockResolvedValue(asset);
    const req = {
      params: { id: asset.id },
      headers: {},
    } as unknown as Request;

    const res = createMockResponse();
    await controller.get(req, res, jest.fn());

    expect(service.getAsset).toHaveBeenCalledWith(asset.id);
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "private, max-age=300");
    expect(res.json).toHaveBeenCalledWith(successResponse(asset));
  });

  it("updates asset metadata and records audit trail", async () => {
    const asset = buildAssetView();
    service.updateAsset.mockResolvedValue(asset);
    const req = {
      params: { id: asset.id },
      body: { tags: ["hero"] },
      user: { id: "user_1", roles: [{ name: "admin" }] },
    } as unknown as Request;

    const res = createMockResponse();
    await controller.update(req, res, jest.fn());

    expect(service.updateAsset).toHaveBeenCalledWith(
      asset.id,
      { tags: ["hero"] },
      {
        userId: "user_1",
        roles: ["admin"],
      },
    );
    expect(res.locals.audit).toMatchObject({
      entity: "media.assets",
      entityId: asset.id,
      action: "media.assets.update",
    });
    expect(res.json).toHaveBeenCalledWith(successResponse(asset));
  });

  it("regenerates asset transformations", async () => {
    const asset = buildAssetView();
    service.regenerateAsset.mockResolvedValue(asset);
    const req = {
      params: { id: asset.id },
      user: { id: "user_1", roles: [{ name: "admin" }] },
    } as unknown as Request;

    const res = createMockResponse();
    await controller.regenerate(req, res, jest.fn());

    expect(service.regenerateAsset).toHaveBeenCalledWith(asset.id, {
      userId: "user_1",
      roles: ["admin"],
    });
    expect(res.locals.audit).toMatchObject({ action: "media.assets.regenerate" });
    expect(res.json).toHaveBeenCalledWith(successResponse(asset));
  });

  it("soft deletes assets and returns the deleted record", async () => {
    const asset = buildAssetView();
    service.softDeleteAsset.mockResolvedValue({ ...asset, deletedAt: new Date() });
    const req = {
      params: { id: asset.id },
      user: { id: "user_1", roles: [{ name: "staff" }] },
    } as unknown as Request;

    const res = createMockResponse();
    await controller.softDelete(req, res, jest.fn());

    expect(service.softDeleteAsset).toHaveBeenCalledWith(asset.id, {
      userId: "user_1",
      roles: ["staff"],
    });
    expect(res.locals.audit).toMatchObject({ action: "media.assets.soft-delete" });
    expect(res.json).toHaveBeenCalled();
  });

  it("hard deletes assets and records audit metadata", async () => {
    const asset = buildAssetView();
    service.hardDeleteAsset.mockResolvedValue(asset);
    const req = {
      params: { id: asset.id },
      user: { id: "user_1", roles: [{ name: "admin" }] },
    } as unknown as Request;

    const res = createMockResponse();
    await controller.hardDelete(req, res, jest.fn());

    expect(service.hardDeleteAsset).toHaveBeenCalledWith(asset.id, {
      userId: "user_1",
      roles: ["admin"],
    });
    expect(res.locals.audit).toMatchObject({ action: "media.assets.hard-delete" });
    expect(res.json).toHaveBeenCalledWith(successResponse(asset));
  });
});
