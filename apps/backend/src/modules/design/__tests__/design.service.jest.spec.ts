import { describe, expect, it, jest } from "@jest/globals";
import type { CustomerDesign, PrismaClient } from "@prisma/client";

import type { ApiError } from "@/errors/api-error.js";

import type { CloudinaryClient } from "../../../integrations/cloudinary/cloudinary.client.js";
import type { MediaScanService } from "../../media/media.security.js";
import type { DesignRepository } from "../design.repository.js";
import { DesignService } from "../design.service.js";

const buildDesign = (overrides: Partial<CustomerDesign> = {}): CustomerDesign => {
  const now = new Date("2025-01-01T00:00:00.000Z");
  const base = {
    id: "ckdesign0000000000000000000",
    userId: "ckuser00000000000000000000",
    publicId: "lumi/customer-designs/ckuser/design-1",
    url: "http://cdn.lumi.test/design.png",
    secureUrl: "https://cdn.lumi.test/design.png",
    thumbnailUrl: "https://cdn.lumi.test/design-thumb.png",
    format: "png",
    width: 1200,
    height: 1200,
    bytes: 123_456,
    tags: ["sample"],
    metadata: { originalFilename: "design.png" },
    isPublic: false,
    usageCount: 0,
    viewCount: 0,
    deletedAt: undefined,
    purgeAt: undefined,
    createdAt: now,
    updatedAt: now,
  } as unknown as CustomerDesign;

  return { ...base, ...overrides };
};

const createService = (repository: Partial<DesignRepository>) => {
  const prisma = {} as PrismaClient;
  const cloudinary = {} as CloudinaryClient;
  const scanService = { scan: jest.fn(async () => {}) } as unknown as MediaScanService;

  return new DesignService({
    prisma,
    repository: repository as DesignRepository,
    cloudinary,
    scanService,
  });
};

describe("DesignService.getDesign", () => {
  it("returns 401 when unauthenticated user requests a private design", async () => {
    const design = buildDesign({ isPublic: false, userId: "owner_1" });
    const repository: Partial<DesignRepository> = {
      getById: jest.fn(async () => design),
      incrementViewCount: jest.fn(async () => design),
    };

    const service = createService(repository);

    await expect(service.getDesign(design.id)).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHORIZED",
    } satisfies Partial<ApiError>);
  });

  it("returns 403 when authenticated user requests another user's private design", async () => {
    const design = buildDesign({ isPublic: false, userId: "owner_1" });
    const repository: Partial<DesignRepository> = {
      getById: jest.fn(async () => design),
      incrementViewCount: jest.fn(async () => design),
    };

    const service = createService(repository);

    await expect(service.getDesign(design.id, "other_user")).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN",
    } satisfies Partial<ApiError>);
  });

  it("allows unauthenticated access to public designs", async () => {
    const design = buildDesign({ isPublic: true, userId: "owner_1" });
    const repository: Partial<DesignRepository> = {
      getById: jest.fn(async () => design),
      incrementViewCount: jest.fn(async () => design),
    };

    const service = createService(repository);

    const result = await service.getDesign(design.id);
    expect(result.id).toBe(design.id);
    expect(repository.incrementViewCount).toHaveBeenCalledWith(design.id);
  });
});

describe("DesignService.validateDesignFile", () => {
  it("rejects unsupported mime types", () => {
    const service = createService({});

    expect(() =>
      service.validateDesignFile({
        originalName: "design.gif",
        mimeType: "image/gif",
        size: 10,
        buffer: Buffer.from("gif"),
      }),
    ).toThrow(
      expect.objectContaining({
        status: 415,
        code: "INVALID_MIME_TYPE",
      }),
    );
  });
});
