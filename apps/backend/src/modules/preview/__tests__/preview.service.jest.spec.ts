import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { MediaProvider } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

import type {
  ImageLayerInput as CloudinaryImageLayerInput,
  TextLayerInput as CloudinaryTextLayerInput,
} from "@/integrations/cloudinary/cloudinary-overlay.js";

import type { CachedPreviewPayload, PreviewCache } from "../preview.cache.js";
import { PreviewService } from "../preview.service.js";

const generateLayeredPreviewMock = jest.fn();

jest.mock("@/integrations/cloudinary/cloudinary-overlay.js", () => ({
  generateLayeredPreview: (...args: unknown[]) => generateLayeredPreviewMock(...args),
}));

const buildPrismaStub = () =>
  ({
    product: {
      findFirst: jest.fn(),
    },
    productCustomization: {
      findFirst: jest.fn(),
    },
    customerDesign: {
      findMany: jest.fn(),
    },
  }) as unknown as PrismaClient;

const buildCacheStub = () =>
  ({
    get: jest.fn(async (_previewId: string) => undefined as CachedPreviewPayload | undefined),
    set: jest.fn(
      async (_previewId: string, _payload: CachedPreviewPayload, _ttlSeconds: number) => {},
    ),
    invalidateByProduct: jest.fn(async (_productId: string) => {}),
    shutdown: jest.fn(async () => {}),
  }) satisfies PreviewCache;

describe("PreviewService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("builds overlay layers with design area offsets and resolves design ids to public ids", async () => {
    const prisma = buildPrismaStub();
    const cache = buildCacheStub();

    (prisma.product.findFirst as jest.Mock).mockImplementation(async () => ({
      id: "ckprod0000000000000000000",
      productMedia: [
        {
          media: { assetId: "lumi/products/base-1", provider: MediaProvider.CLOUDINARY },
        },
      ],
    }));

    (prisma.productCustomization.findFirst as jest.Mock).mockImplementation(async () => ({
      enabled: true,
      designAreas: [
        {
          name: "front",
          x: 100,
          y: 200,
          width: 500,
          height: 500,
          rotation: 0,
          minDesignSize: 40,
          maxDesignSize: 400,
          allowResize: true,
          allowRotation: true,
        },
      ],
      maxLayers: 10,
      allowImages: true,
      allowText: true,
      allowedFonts: [],
    }));

    (prisma.customerDesign.findMany as jest.Mock).mockImplementation(async () => [
      { id: "ckdesign0000000000000000000", publicId: "lumi/customer-designs/u1/design-1" },
    ]);

    const service = new PreviewService({ prisma, cache, ttlSeconds: 300 });

    const result = await service.buildCloudinaryTransformation(
      "ckprod0000000000000000000",
      {
        designArea: "front",
        resolution: "web",
        layers: [
          {
            layerId: "layer-1",
            type: "image",
            designId: "ckdesign0000000000000000000",
            position: { x: 10, y: 20, width: 30, height: 40, rotation: 0 },
            zIndex: 1,
          },
          {
            layerId: "layer-2",
            type: "text",
            text: "Hello",
            font: "Helvetica",
            fontSize: 24,
            color: "#FFFFFF",
            position: { x: 5, y: 6, width: 10, height: 10, rotation: 0 },
            zIndex: 2,
          },
        ],
      },
      "u1",
    );

    expect(result.basePublicId).toBe("lumi/products/base-1");
    expect(result.resolution).toBe("web");
    expect(result.layers).toHaveLength(2);

    const imageLayer = result.layers[0] as CloudinaryImageLayerInput;
    expect(imageLayer.type).toBe("image");
    expect(imageLayer.publicId).toBe("lumi/customer-designs/u1/design-1");
    expect(imageLayer.position.x).toBe(110);
    expect(imageLayer.position.y).toBe(220);

    const textLayer = result.layers[1] as CloudinaryTextLayerInput;
    expect(textLayer.type).toBe("text");
    expect(textLayer.position.x).toBe(105);
    expect(textLayer.position.y).toBe(206);
    expect(textLayer.style.fontFamily).toBe("Helvetica");
  });

  it("returns cached previews without regenerating", async () => {
    const prisma = buildPrismaStub();
    const cache = buildCacheStub();

    const cachedPayload: CachedPreviewPayload = {
      previewUrl: "https://cdn.example/preview.webp",
      cachedAt: new Date("2025-01-01T00:00:00.000Z").toISOString(),
      expiresAt: new Date("2999-01-01T00:00:00.000Z").toISOString(),
      resolution: "web",
      designArea: "front",
    };

    (cache.get as jest.Mock).mockImplementation(async () => cachedPayload);

    const service = new PreviewService({ prisma, cache, ttlSeconds: 300 });

    const result = await service.generatePreview(
      "ckprod0000000000000000000",
      {
        designArea: "front",
        resolution: "web",
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
      },
      "u1",
    );

    expect(result.cached).toBe(true);
    expect(result.previewUrl).toBe(cachedPayload.previewUrl);
    expect(prisma.product.findFirst).not.toHaveBeenCalled();
    expect(generateLayeredPreviewMock).not.toHaveBeenCalled();
  });

  it("caches generated previews", async () => {
    const prisma = buildPrismaStub();
    const cache = buildCacheStub();

    (prisma.product.findFirst as jest.Mock).mockImplementation(async () => ({
      id: "ckprod0000000000000000000",
      productMedia: [
        {
          media: { assetId: "lumi/products/base-1", provider: MediaProvider.CLOUDINARY },
        },
      ],
    }));

    (prisma.productCustomization.findFirst as jest.Mock).mockImplementation(async () => ({
      enabled: true,
      designAreas: [
        {
          name: "front",
          x: 0,
          y: 0,
          width: 500,
          height: 500,
          rotation: 0,
          minDesignSize: 40,
          maxDesignSize: 400,
          allowResize: true,
          allowRotation: true,
        },
      ],
      maxLayers: 10,
      allowImages: true,
      allowText: true,
      allowedFonts: [],
    }));

    (prisma.customerDesign.findMany as jest.Mock).mockImplementation(async () => []);

    generateLayeredPreviewMock.mockReturnValue("https://cdn.example/generated.webp");

    const service = new PreviewService({ prisma, cache, ttlSeconds: 300 });

    const result = await service.generatePreview(
      "ckprod0000000000000000000",
      {
        designArea: "front",
        resolution: "web",
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
      },
      "u1",
    );

    expect(result.cached).toBe(false);
    expect(result.previewUrl).toBe("https://cdn.example/generated.webp");
    expect(cache.set).toHaveBeenCalledTimes(1);
  });
});
