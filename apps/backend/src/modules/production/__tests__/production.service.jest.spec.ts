import { describe, expect, it, jest } from "@jest/globals";
import { OrderStatus, PrintMethod } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

import type { CloudinaryClient } from "@/integrations/cloudinary/cloudinary.client.js";
import type { PreviewLayerInput } from "@/integrations/cloudinary/cloudinary-overlay.js";
import type { PreviewService } from "@/modules/preview/preview.service.js";

import { ProductionService } from "../production.service.js";

const buildService = (
  overrides: {
    prisma?: PrismaClient;
    cloudinary?: CloudinaryClient;
    previewService?: PreviewService;
  } = {},
) =>
  new ProductionService({
    prisma: overrides.prisma,
    cloudinary: overrides.cloudinary,
    previewService: overrides.previewService,
  });

describe("ProductionService", () => {
  it("computes print specifications in pixels", () => {
    const specs = ProductionService.addPrintSpecifications({
      resolution: { dpi: 300, width: 5000, height: 5000 },
      format: "png",
      backgroundColor: "transparent",
      colorProfile: "CMYK",
      printMethod: PrintMethod.DTG,
      bleedArea: "5mm",
      safeArea: "10mm",
      quality: 100,
    });

    expect(specs.bleedMm).toBe(5);
    expect(specs.safeMm).toBe(10);
    expect(specs.bleedPx).toBeGreaterThan(50);
    expect(specs.safePx).toBeGreaterThan(100);
  });

  it("builds a production transformation that enforces CMYK + 300dpi", () => {
    const layers: PreviewLayerInput[] = [
      {
        type: "text",
        text: "Hello",
        position: { x: 0, y: 0, width: 100, height: 50, rotation: 0 },
        style: { fontFamily: "Helvetica", fontSize: 24, color: "#000000" },
      },
    ];

    const transformation = ProductionService.buildProductionTransformation(layers, {
      resolution: { dpi: 300, width: 5000, height: 5000 },
      format: "png",
      backgroundColor: "transparent",
      colorProfile: "CMYK",
      printMethod: PrintMethod.DTG,
      bleedArea: "5mm",
      safeArea: "10mm",
      quality: 100,
    }) as unknown as Record<string, unknown>[];

    const outputStep = transformation.at(-1);
    expect(outputStep).toEqual(
      expect.objectContaining({
        density: 300,
        color_space: "cmyk",
        format: "png",
        width: 5000,
        height: 5000,
      }),
    );
  });

  it("rejects production exports when the order is not paid", async () => {
    const prisma = {
      orderItemCustomization: {
        findUnique: jest.fn(async () => ({
          id: "custom_1",
          orderItemId: "order_item_1",
          productId: "product_1",
          designArea: "front",
          designData: { layers: [], designArea: "front" },
          previewUrl: undefined,
          thumbnailUrl: undefined,
          productionPublicId: undefined,
          productionFileUrl: undefined,
          productionDpi: 300,
          productionGenerated: false,
          printMethod: PrintMethod.DTG,
          layerCount: 0,
          hasImages: false,
          hasText: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          orderItem: {
            id: "order_item_1",
            productId: "product_1",
            order: {
              id: "order_1",
              reference: "ref-1",
              status: OrderStatus.PENDING,
              placedAt: undefined,
              createdAt: new Date(),
              userId: "user_1",
            },
            product: { id: "product_1", title: "T-Shirt" },
          },
        })),
        update: jest.fn(),
      },
    } as unknown as PrismaClient;

    const service = buildService({
      prisma,
      cloudinary: {} as CloudinaryClient,
      previewService: {} as PreviewService,
    });

    await expect(service.generateProductionFile("order_item_1")).rejects.toMatchObject({
      statusCode: 409,
      code: "CONFLICT",
    });
  });

  it("returns existing production files without regenerating", async () => {
    const cloudinary = {
      generatePrivateDownloadUrl: jest.fn(() => "https://cdn.example/signed"),
    } as unknown as CloudinaryClient;

    const prisma = {
      orderItemCustomization: {
        findUnique: jest.fn(async () => ({
          id: "custom_1",
          orderItemId: "order_item_1",
          productId: "product_1",
          designArea: "front",
          designData: { layers: [] },
          previewUrl: undefined,
          thumbnailUrl: undefined,
          productionPublicId: "prod_public",
          productionFileUrl: "https://cdn.example/production.png",
          productionDpi: 300,
          productionGenerated: true,
          printMethod: PrintMethod.DTG,
          layerCount: 0,
          hasImages: false,
          hasText: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          orderItem: {
            id: "order_item_1",
            productId: "product_1",
            order: {
              id: "order_1",
              reference: "ref-1",
              status: OrderStatus.PAID,
              placedAt: undefined,
              createdAt: new Date(),
              userId: "user_1",
            },
            product: { id: "product_1", title: "T-Shirt" },
          },
        })),
        update: jest.fn(),
      },
    } as unknown as PrismaClient;

    const service = buildService({
      prisma,
      cloudinary,
      previewService: {} as PreviewService,
    });

    const result = await service.generateProductionFile("order_item_1");
    expect(result.productionFileUrl).toBe("https://cdn.example/production.png");
    expect(cloudinary.generatePrivateDownloadUrl).toHaveBeenCalledWith(
      "prod_public",
      "png",
      expect.objectContaining({ attachment: true }),
    );
  });

  it("generates and stores a new production file", async () => {
    const cloudinary = {
      generateImageUrl: jest.fn(() => "https://cdn.example/composite.png"),
      upload: jest.fn(async () => ({
        public_id: "prod_public_new",
        secure_url: "https://cdn.example/production-new.png",
      })),
      generatePrivateDownloadUrl: jest.fn(() => "https://cdn.example/signed"),
    } as unknown as CloudinaryClient;

    const previewService = {
      buildCloudinaryTransformation: jest.fn(async () => ({
        basePublicId: "base_public",
        layers: [
          {
            type: "text",
            text: "Hi",
            position: { x: 0, y: 0, width: 10, height: 10 },
            style: { fontFamily: "Helvetica", fontSize: 12 },
          },
        ],
        resolution: "production",
      })),
    } as unknown as PreviewService;

    const prisma = {
      orderItemCustomization: {
        findUnique: jest.fn(async () => ({
          id: "custom_1",
          orderItemId: "order_item_1",
          productId: "product_1",
          designArea: "front",
          designData: {
            layers: [
              {
                layerId: "layer-1",
                type: "text",
                text: "Hi",
                font: "Helvetica",
                fontSize: 12,
                position: { x: 0, y: 0, width: 10, height: 10, rotation: 0 },
                zIndex: 1,
              },
            ],
          },
          previewUrl: undefined,
          thumbnailUrl: undefined,
          productionPublicId: undefined,
          productionFileUrl: undefined,
          productionDpi: 300,
          productionGenerated: false,
          printMethod: PrintMethod.DTG,
          layerCount: 0,
          hasImages: false,
          hasText: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          orderItem: {
            id: "order_item_1",
            productId: "product_1",
            order: {
              id: "order_1",
              reference: "ref-1",
              status: OrderStatus.PAID,
              placedAt: undefined,
              createdAt: new Date(),
              userId: "user_1",
            },
            product: { id: "product_1", title: "T-Shirt" },
          },
        })),
        update: jest.fn(async () => ({
          id: "custom_1",
          designArea: "front",
          printMethod: PrintMethod.DTG,
        })),
      },
    } as unknown as PrismaClient;

    const service = buildService({
      prisma,
      cloudinary,
      previewService,
    });

    const result = await service.generateProductionFile("order_item_1");

    expect(previewService.buildCloudinaryTransformation).toHaveBeenCalled();
    expect(cloudinary.generateImageUrl).toHaveBeenCalledWith(
      "base_public",
      expect.objectContaining({ transformation: expect.any(Array) }),
    );
    expect(cloudinary.upload).toHaveBeenCalledWith(
      "https://cdn.example/composite.png",
      expect.objectContaining({ folder: expect.stringContaining("/production/orders/") }),
    );
    expect(prisma.orderItemCustomization.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "custom_1" },
        data: expect.objectContaining({
          productionPublicId: "prod_public_new",
          productionFileUrl: "https://cdn.example/production-new.png",
          productionGenerated: true,
          productionDpi: 300,
        }),
      }),
    );
    expect(result.productionPublicId).toBe("prod_public_new");
  });
});
