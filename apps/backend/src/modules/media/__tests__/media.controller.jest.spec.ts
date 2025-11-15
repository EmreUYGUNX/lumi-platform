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

describe("media.controller", () => {
  let service: jest.Mocked<MediaService>;
  let controller: MediaController;

  beforeEach(() => {
    service = {
      upload: jest.fn(),
      generateUploadSignature: jest.fn(),
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
});
