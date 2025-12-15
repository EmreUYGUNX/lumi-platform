import { Prisma } from "@prisma/client";
import type { DesignTemplate, PrismaClient } from "@prisma/client";

import { NotFoundError, ValidationError } from "@/lib/errors.js";
import { createChildLogger } from "@/lib/logger.js";
import { getPrismaClient } from "@/lib/prisma.js";
import type { PaginatedResult } from "@/lib/repository/base.repository.js";
import type { MoneyDTO } from "@lumi/shared/dto";

import { TemplateRepository, type TemplateListFilters } from "./template.repository.js";
import type {
  TemplateCreateBody,
  TemplateListQuery,
  TemplateUpdateBody,
} from "./template.validators.js";
import type { DesignTemplateSummaryView, DesignTemplateView } from "./template.types.js";

const DEFAULT_PAGE_SIZE = 24;

const formatMoney = (amount: Prisma.Decimal, currency: string): MoneyDTO => ({
  amount: amount.toFixed(2),
  currency,
});

const toOptionalString = (value: string | null | undefined): string | undefined => {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const buildTags = (query: Pick<TemplateListQuery, "tag" | "tags">): string[] => {
  const tags = new Set<string>();
  query.tags?.forEach((tag) => tags.add(tag));
  if (query.tag) {
    tags.add(query.tag);
  }
  return [...tags];
};

export interface TemplateServiceOptions {
  prisma?: PrismaClient;
  repository?: TemplateRepository;
  logger?: ReturnType<typeof createChildLogger>;
}

export class TemplateService {
  private readonly prisma: PrismaClient;

  private readonly repository: TemplateRepository;

  private readonly logger: ReturnType<typeof createChildLogger>;

  constructor(options: TemplateServiceOptions = {}) {
    this.prisma = options.prisma ?? getPrismaClient();
    this.repository = options.repository ?? new TemplateRepository(this.prisma);
    this.logger = options.logger ?? createChildLogger("templates:service");
  }

  static toSummaryView(record: DesignTemplate): DesignTemplateSummaryView {
    return {
      id: record.id,
      name: record.name,
      description: toOptionalString(record.description),
      category: toOptionalString(record.category),
      tags: record.tags ?? [],
      isPaid: record.isPaid,
      price: formatMoney(record.price, record.currency),
      thumbnailUrl: toOptionalString(record.thumbnailUrl),
      previewUrl: toOptionalString(record.previewUrl),
      isPublished: record.isPublished,
      isFeatured: record.isFeatured,
      usageCount: record.usageCount,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  static toView(record: DesignTemplate): DesignTemplateView {
    return {
      ...TemplateService.toSummaryView(record),
      canvasData: record.canvasData,
    };
  }

  async listPublicTemplates(
    query: TemplateListQuery,
  ): Promise<PaginatedResult<DesignTemplateSummaryView>> {
    const filters: TemplateListFilters = {
      category: query.category,
      tags: buildTags(query),
      isPaid: query.isPaid,
      isFeatured: query.featured,
      isPublished: true,
      sort: query.sort ?? "newest",
      order: query.order ?? "desc",
    };

    const result = await this.repository.findAll(filters, {
      page: query.page ?? 1,
      pageSize: query.perPage ?? DEFAULT_PAGE_SIZE,
    });

    return {
      ...result,
      items: result.items.map((item) => TemplateService.toSummaryView(item)),
    };
  }

  async listAdminTemplates(
    query: TemplateListQuery,
  ): Promise<PaginatedResult<DesignTemplateSummaryView>> {
    const filters: TemplateListFilters = {
      category: query.category,
      tags: buildTags(query),
      isPaid: query.isPaid,
      isFeatured: query.featured,
      isPublished: query.published,
      sort: query.sort ?? "newest",
      order: query.order ?? "desc",
    };

    const result = await this.repository.findAll(filters, {
      page: query.page ?? 1,
      pageSize: query.perPage ?? DEFAULT_PAGE_SIZE,
    });

    return {
      ...result,
      items: result.items.map((item) => TemplateService.toSummaryView(item)),
    };
  }

  async getPublicTemplate(id: string): Promise<DesignTemplateView> {
    const template = await this.repository.findByIdOrThrow(id);

    if (!template.isPublished) {
      throw new NotFoundError("Template not found.");
    }

    const updated = await this.repository.incrementUsage(id);
    this.logger.info("Template usage incremented", {
      templateId: id,
      usageCount: updated.usageCount,
    });

    return TemplateService.toView(updated);
  }

  async getAdminTemplate(id: string): Promise<DesignTemplateView> {
    const template = await this.repository.findByIdOrThrow(id);
    return TemplateService.toView(template);
  }

  async createTemplate(body: TemplateCreateBody): Promise<DesignTemplateView> {
    const price = new Prisma.Decimal(body.priceAmount ?? 0);

    const created = await this.repository.createTemplate({
      name: body.name,
      description: body.description,
      category: body.category,
      tags: body.tags ?? [],
      isPaid: body.isPaid ?? false,
      price,
      currency: body.currency,
      thumbnailUrl: body.thumbnailUrl,
      previewUrl: body.previewUrl,
      canvasData: body.canvasData as Prisma.InputJsonValue,
      isPublished: body.isPublished ?? false,
      isFeatured: body.isFeatured ?? false,
    });

    return TemplateService.toView(created);
  }

  async updateTemplate(id: string, patch: TemplateUpdateBody): Promise<DesignTemplateView> {
    const existing = await this.repository.findByIdOrThrow(id);

    const pricing = TemplateService.resolvePricing(existing, patch);
    const updateData = TemplateService.buildUpdateData(patch, pricing);

    const updated = await this.repository.updateTemplate(id, updateData);

    return TemplateService.toView(updated);
  }

  async deleteTemplate(id: string): Promise<void> {
    await this.repository.softDeleteTemplate(id);
  }

  private static resolvePricing(
    existing: DesignTemplate,
    patch: TemplateUpdateBody,
  ): { isPaid: boolean; price: Prisma.Decimal; currency: string } {
    const existingPrice =
      existing.price instanceof Prisma.Decimal
        ? existing.price
        : new Prisma.Decimal(existing.price);

    const nextCurrency = patch.currency ?? existing.currency;

    let nextIsPaid = patch.isPaid ?? existing.isPaid;
    let nextPrice = existingPrice;

    if (typeof patch.priceAmount === "number") {
      nextPrice = new Prisma.Decimal(patch.priceAmount);
      nextIsPaid = patch.isPaid ?? patch.priceAmount > 0;
    }

    if (patch.isPaid === false) {
      nextIsPaid = false;
      nextPrice = new Prisma.Decimal(0);
    }

    if (nextIsPaid) {
      if (!nextPrice.gt(0)) {
        throw new ValidationError("Paid templates must have a positive price.", {
          issues: [{ path: "priceAmount", message: "Paid templates must have a positive price." }],
        });
      }
    } else if (!nextPrice.eq(0)) {
      throw new ValidationError("Free templates must have a price of 0.", {
        issues: [{ path: "priceAmount", message: "Free templates must have a price of 0." }],
      });
    }

    return { isPaid: nextIsPaid, price: nextPrice, currency: nextCurrency };
  }

  private static buildUpdateData(
    patch: TemplateUpdateBody,
    pricing: { isPaid: boolean; price: Prisma.Decimal; currency: string },
  ): Prisma.DesignTemplateUpdateInput {
    const updateData: Prisma.DesignTemplateUpdateInput = {
      isPaid: pricing.isPaid,
      price: pricing.price,
      currency: pricing.currency,
    };

    if (patch.name) {
      updateData.name = patch.name;
    }

    if (patch.description !== undefined) {
      updateData.description = patch.description;
    }

    if (patch.category !== undefined) {
      updateData.category = patch.category;
    }

    if (patch.tags !== undefined) {
      updateData.tags = patch.tags;
    }

    if (patch.thumbnailUrl !== undefined) {
      updateData.thumbnailUrl = patch.thumbnailUrl;
    }

    if (patch.previewUrl !== undefined) {
      updateData.previewUrl = patch.previewUrl;
    }

    if (patch.canvasData !== undefined) {
      updateData.canvasData = patch.canvasData as Prisma.InputJsonValue;
    }

    if (patch.isPublished !== undefined) {
      updateData.isPublished = patch.isPublished;
    }

    if (patch.isFeatured !== undefined) {
      updateData.isFeatured = patch.isFeatured;
    }

    return updateData;
  }
}
