/* eslint-disable unicorn/no-null */
import { Prisma } from "@prisma/client";
import type { PrismaClient, ProductCustomization } from "@prisma/client";

import { NotFoundError, ValidationError } from "@/lib/errors.js";
import { createChildLogger } from "@/lib/logger.js";
import { getPrismaClient } from "@/lib/prisma.js";

import type { DesignArea, ProductCustomizationConfig } from "./customization.types.js";
import {
  designAreasSchema,
  productCustomizationConfigSchema,
  productCustomizationUpdateSchema,
} from "./customization.validators.js";
import { CustomizationRepository } from "./customization.repository.js";
import { areAreasOverlapping, getDesignAreaBounds } from "./design-area.helpers.js";

export interface CustomizationServiceOptions {
  prisma?: PrismaClient;
  repository?: CustomizationRepository;
  logger?: ReturnType<typeof createChildLogger>;
}

interface ImageBounds {
  width: number;
  height: number;
}

interface DesignAreaIssue {
  path: string;
  message: string;
}

export class CustomizationService {
  private readonly prisma: PrismaClient;

  private readonly repository: CustomizationRepository;

  private readonly logger: ReturnType<typeof createChildLogger>;

  constructor(options: CustomizationServiceOptions = {}) {
    this.prisma = options.prisma ?? getPrismaClient();
    this.repository = options.repository ?? new CustomizationRepository(this.prisma);
    this.logger = options.logger ?? createChildLogger("customization:service");
  }

  async getProductCustomization(
    productId: string,
    options: { includeDisabled?: boolean } = {},
  ): Promise<ProductCustomizationConfig | null> {
    const record = await this.repository.findByProductId(productId);
    if (!record) return null;
    if (!options.includeDisabled && !record.enabled) return null;

    return CustomizationService.mapRecordToConfig(record);
  }

  async enableCustomization(
    productId: string,
    configInput: unknown,
  ): Promise<ProductCustomizationConfig> {
    const config = productCustomizationConfigSchema.parse(configInput);
    const enabled = config.enabled ?? true;

    await this.validateDesignAreaCoordinates(config.designAreas, productId);

    const existing = await this.repository.findByProductId(productId);

    const data: Prisma.ProductCustomizationUpdateInput = {
      enabled,
      designAreas: config.designAreas as unknown as Prisma.InputJsonValue,
      maxLayers: config.maxLayers,
      allowImages: config.allowImages,
      allowText: config.allowText,
      allowShapes: config.allowShapes,
      allowDrawing: config.allowDrawing,
      minImageSize: config.minImageSize,
      maxImageSize: config.maxImageSize,
      allowedFonts: config.allowedFonts,
      restrictedWords: config.restrictedWords,
      basePriceModifier: new Prisma.Decimal(config.basePriceModifier),
      pricePerLayer: new Prisma.Decimal(config.pricePerLayer),
    };

    const saved = existing
      ? await this.repository.updateConfig(productId, data)
      : await this.repository.createConfig({
          product: { connect: { id: productId } },
          ...data,
        } as Prisma.ProductCustomizationCreateInput);

    return CustomizationService.mapRecordToConfig(saved);
  }

  async updateCustomization(
    productId: string,
    patchInput: unknown,
  ): Promise<ProductCustomizationConfig> {
    const patch = productCustomizationUpdateSchema.parse(patchInput);
    const existing = await this.repository.findByProductId(productId);
    if (!existing) {
      throw new NotFoundError("Product customization config not found.", {
        details: { productId },
      });
    }

    const current = CustomizationService.mapRecordToConfig(existing);
    const next: ProductCustomizationConfig = {
      ...current,
      ...patch,
      designAreas: patch.designAreas ?? current.designAreas,
      allowedFonts: patch.allowedFonts ?? current.allowedFonts,
      restrictedWords: patch.restrictedWords ?? current.restrictedWords,
      enabled: patch.enabled ?? current.enabled,
    };

    await this.validateDesignAreaCoordinates(next.designAreas, productId);

    const updated = await this.repository.updateConfig(productId, {
      enabled: next.enabled,
      designAreas: next.designAreas as unknown as Prisma.InputJsonValue,
      maxLayers: next.maxLayers,
      allowImages: next.allowImages,
      allowText: next.allowText,
      allowShapes: next.allowShapes,
      allowDrawing: next.allowDrawing,
      minImageSize: next.minImageSize,
      maxImageSize: next.maxImageSize,
      allowedFonts: next.allowedFonts,
      restrictedWords: next.restrictedWords,
      basePriceModifier: new Prisma.Decimal(next.basePriceModifier),
      pricePerLayer: new Prisma.Decimal(next.pricePerLayer),
    });

    return CustomizationService.mapRecordToConfig(updated);
  }

  async updateDesignAreas(
    productId: string,
    areasInput: unknown,
  ): Promise<ProductCustomizationConfig> {
    const areas = designAreasSchema.parse(areasInput);
    await this.validateDesignAreaCoordinates(areas, productId);

    const existing = await this.repository.findByProductId(productId);
    if (!existing) {
      throw new NotFoundError("Product customization config not found.", {
        details: { productId },
      });
    }

    const updated = await this.repository.updateConfig(productId, {
      designAreas: areas as unknown as Prisma.InputJsonValue,
    });

    return CustomizationService.mapRecordToConfig(updated);
  }

  async disableCustomization(productId: string): Promise<void> {
    const existing = await this.repository.findByProductId(productId);
    if (!existing) return;

    await this.repository.deleteConfig(productId);
  }

  async validateDesignAreaCoordinates(areas: DesignArea[], productId?: string): Promise<void> {
    const bounds = productId ? await this.resolveProductImageBounds(productId) : null;

    const issues = [
      ...CustomizationService.collectAreaIssues(areas, bounds),
      ...CustomizationService.collectOverlapIssues(areas),
    ];

    if (issues.length === 0) return;

    throw new ValidationError("Invalid design area definitions.", {
      issues: issues.map((issue) => ({
        path: issue.path,
        message: issue.message,
      })),
    });
  }

  private static collectAreaIssues(
    areas: DesignArea[],
    bounds: ImageBounds | null,
  ): DesignAreaIssue[] {
    const issues: DesignAreaIssue[] = [];
    const seenNames = new Set<string>();

    areas.forEach((area, index) => {
      if (seenNames.has(area.name)) {
        issues.push({
          path: `designAreas.${index}.name`,
          message: "Design area names must be unique per product.",
        });
      }
      seenNames.add(area.name);

      const areaBounds = getDesignAreaBounds(area);
      if (areaBounds.left < 0 || areaBounds.top < 0) {
        issues.push({
          path: `designAreas.${index}`,
          message: "Design areas must start within the product image (x/y >= 0).",
        });
      }

      if (bounds && (areaBounds.right > bounds.width || areaBounds.bottom > bounds.height)) {
        issues.push({
          path: `designAreas.${index}`,
          message: `Design area exceeds product image bounds (${bounds.width}x${bounds.height}).`,
        });
      }
    });

    return issues;
  }

  private static collectOverlapIssues(areas: DesignArea[]): DesignAreaIssue[] {
    const issues: DesignAreaIssue[] = [];

    areas.forEach((areaA, indexA) => {
      areas.slice(indexA + 1).forEach((areaB) => {
        if (areAreasOverlapping(areaA, areaB)) {
          issues.push({
            path: `designAreas.${indexA}`,
            message: `Design areas "${areaA.name}" and "${areaB.name}" overlap.`,
          });
        }
      });
    });

    return issues;
  }

  private async resolveProductImageBounds(productId: string): Promise<ImageBounds | null> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId },
      select: {
        id: true,
        productMedia: {
          where: { isPrimary: true },
          take: 1,
          select: {
            media: { select: { width: true, height: true } },
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundError("Product not found.", { details: { productId } });
    }

    const media = product.productMedia[0]?.media;
    const width = typeof media?.width === "number" ? media.width : undefined;
    const height = typeof media?.height === "number" ? media.height : undefined;

    if (!width || !height) {
      this.logger.debug("Skipping bounds validation; product media missing dimensions.", {
        productId,
      });
      return null;
    }

    return { width, height };
  }

  private static mapRecordToConfig(record: ProductCustomization): ProductCustomizationConfig {
    const areas = designAreasSchema.parse(record.designAreas);

    return {
      enabled: record.enabled,
      designAreas: areas,
      maxLayers: record.maxLayers,
      allowImages: record.allowImages,
      allowText: record.allowText,
      allowShapes: record.allowShapes,
      allowDrawing: record.allowDrawing,
      minImageSize: record.minImageSize ?? undefined,
      maxImageSize: record.maxImageSize ?? undefined,
      allowedFonts: record.allowedFonts ?? [],
      restrictedWords: record.restrictedWords ?? [],
      basePriceModifier: Number(record.basePriceModifier.toFixed(2)),
      pricePerLayer: Number(record.pricePerLayer.toFixed(2)),
    };
  }
}
