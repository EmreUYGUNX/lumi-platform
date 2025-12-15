import { Prisma } from "@prisma/client";
import type { ClipartAsset, PrismaClient } from "@prisma/client";

import { NotFoundError, ValidationError } from "@/lib/errors.js";
import { createChildLogger } from "@/lib/logger.js";
import { getPrismaClient } from "@/lib/prisma.js";
import type { PaginatedResult } from "@/lib/repository/base.repository.js";
import { MediaScanService, sanitizeFilename } from "@/modules/media/media.security.js";
import type { MoneyDTO } from "@lumi/shared/dto";

import { sanitizeSvg } from "../design/svg-sanitizer.js";
import { ClipartRepository, type ClipartListFilters } from "./clipart.repository.js";
import type {
  ClipartListQuery,
  ClipartUpdateBody,
  ClipartUploadBody,
} from "./clipart.validators.js";
import type { ClipartAssetView, ClipartUploadResult } from "./clipart.types.js";

const DEFAULT_PAGE_SIZE = 60;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const formatMoney = (amount: Prisma.Decimal, currency: string): MoneyDTO => ({
  amount: amount.toFixed(2),
  currency,
});

const toOptionalString = (value: string | null | undefined): string | undefined => {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const buildTags = (query: Pick<ClipartListQuery, "tag" | "tags">): string[] => {
  const tags = new Set<string>();
  query.tags?.forEach((tag) => tags.add(tag));
  if (query.tag) {
    tags.add(query.tag);
  }
  return [...tags];
};

const deriveName = (originalFilename: string): string => {
  const base = sanitizeFilename(originalFilename).replace(/\.[^/.]+$/u, "");
  const cleaned = base.replaceAll(/[_-]+/gu, " ").trim();
  if (!cleaned) {
    return "Clipart";
  }

  return cleaned
    .split(/\s+/u)
    .slice(0, 6)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

export interface PreparedClipartFile {
  originalName: string;
  mimeType: string;
  size: number;
  buffer: Buffer;
}

export interface ClipartServiceOptions {
  prisma?: PrismaClient;
  repository?: ClipartRepository;
  logger?: ReturnType<typeof createChildLogger>;
  scanService?: MediaScanService;
}

export class ClipartService {
  private readonly prisma: PrismaClient;

  private readonly repository: ClipartRepository;

  private readonly logger: ReturnType<typeof createChildLogger>;

  private readonly scanService: MediaScanService;

  constructor(options: ClipartServiceOptions = {}) {
    this.prisma = options.prisma ?? getPrismaClient();
    this.repository = options.repository ?? new ClipartRepository(this.prisma);
    this.logger = options.logger ?? createChildLogger("clipart:service");
    this.scanService = options.scanService ?? new MediaScanService();
  }

  static toView(record: ClipartAsset): ClipartAssetView {
    return {
      id: record.id,
      name: record.name,
      description: toOptionalString(record.description),
      category: toOptionalString(record.category),
      tags: record.tags ?? [],
      isPaid: record.isPaid,
      price: formatMoney(record.price, record.currency),
      svg: record.svg,
      thumbnailUrl: toOptionalString(record.thumbnailUrl),
      usageCount: record.usageCount,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private static validateFile(file: PreparedClipartFile): void {
    if (!file?.buffer || file.buffer.length === 0) {
      throw new ValidationError("Clipart file is required.", {
        issues: [{ path: "files", message: "Attach a clipart file to upload." }],
      });
    }

    if (file.mimeType !== "image/svg+xml") {
      throw new ValidationError("Unsupported clipart file type.", {
        issues: [
          {
            path: "files",
            message: "Only SVG clipart assets are supported.",
            code: "INVALID_MIME_TYPE",
          },
        ],
      });
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      throw new ValidationError("Clipart file is too large.", {
        issues: [
          {
            path: "files",
            message: `Maximum allowed size is ${MAX_UPLOAD_BYTES} bytes.`,
            code: "PAYLOAD_TOO_LARGE",
          },
        ],
      });
    }
  }

  async listPublicClipart(query: ClipartListQuery): Promise<PaginatedResult<ClipartAssetView>> {
    const filters: ClipartListFilters = {
      category: query.category,
      tags: buildTags(query),
      isPaid: query.isPaid,
      sort: query.sort ?? "newest",
      order: query.order ?? "desc",
    };

    const result = await this.repository.findAll(filters, {
      page: query.page ?? 1,
      pageSize: query.perPage ?? DEFAULT_PAGE_SIZE,
    });

    return {
      ...result,
      items: result.items.map((item) => ClipartService.toView(item)),
    };
  }

  async listAdminClipart(query: ClipartListQuery): Promise<PaginatedResult<ClipartAssetView>> {
    return this.listPublicClipart(query);
  }

  async getPublicClipart(id: string): Promise<ClipartAssetView> {
    await this.repository.findByIdOrThrow(id);
    const updated = await this.repository.incrementUsage(id);
    this.logger.info("Clipart usage incremented", {
      clipartId: id,
      usageCount: updated.usageCount,
    });
    return ClipartService.toView(updated);
  }

  async getAdminClipart(id: string): Promise<ClipartAssetView> {
    const asset = await this.repository.findByIdOrThrow(id);
    return ClipartService.toView(asset);
  }

  async uploadClipart(
    files: PreparedClipartFile[],
    body: ClipartUploadBody,
  ): Promise<ClipartUploadResult> {
    if (!files || files.length === 0) {
      throw new ValidationError("At least one clipart file is required.", {
        issues: [{ path: "files", message: "Attach one or more SVG files to upload." }],
      });
    }

    const uploads: ClipartAssetView[] = [];
    const failures: ClipartUploadResult["failures"] = [];

    // eslint-disable-next-line no-restricted-syntax -- Sequential processing keeps memory and scanning predictable.
    for (const file of files) {
      try {
        ClipartService.validateFile(file);

        const original = file.buffer.toString("utf8");
        const sanitized = sanitizeSvg(original);

        if (!sanitized) {
          throw new ValidationError("SVG upload contains no usable content after sanitization.", {
            issues: [{ path: "files", message: "Invalid SVG content.", code: "INVALID_SVG" }],
          });
        }

        const sanitizedBuffer = Buffer.from(sanitized, "utf8");

        // eslint-disable-next-line no-await-in-loop -- sequential scanning keeps resource usage predictable.
        await this.scanService.scan({
          buffer: sanitizedBuffer,
          filename: file.originalName,
        });

        const name = deriveName(file.originalName);
        const price = new Prisma.Decimal(body.priceAmount ?? 0);

        // eslint-disable-next-line no-await-in-loop -- sequential writes keep backpressure predictable.
        const created = await this.repository.createClipart({
          name,
          description: body.description,
          category: body.category,
          tags: body.tags ?? [],
          isPaid: body.isPaid ?? false,
          price,
          currency: body.currency,
          svg: sanitized,
          thumbnailUrl: body.thumbnailUrl,
        });

        uploads.push(ClipartService.toView(created));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to upload clipart asset.";
        failures.push({
          filename: file.originalName ?? "clipart.svg",
          message,
        });
      }
    }

    if (uploads.length === 0) {
      throw new ValidationError("No clipart assets were uploaded successfully.", {
        issues: failures.map((failure) => ({
          path: "files",
          message: `${failure.filename}: ${failure.message}`,
        })),
      });
    }

    return { uploads, failures };
  }

  async updateClipart(id: string, patch: ClipartUpdateBody): Promise<ClipartAssetView> {
    const existing = await this.repository.findByIdOrThrow(id);

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

    if (nextIsPaid && !nextPrice.gt(0)) {
      throw new ValidationError("Paid clipart assets must have a positive price.", {
        issues: [
          { path: "priceAmount", message: "Paid clipart assets must have a positive price." },
        ],
      });
    }

    if (!nextIsPaid && !nextPrice.eq(0)) {
      throw new ValidationError("Free clipart assets must have a price of 0.", {
        issues: [{ path: "priceAmount", message: "Free clipart assets must have a price of 0." }],
      });
    }

    const updateData: Prisma.ClipartAssetUpdateInput = {
      isPaid: nextIsPaid,
      price: nextPrice,
      currency: nextCurrency,
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

    const updated = await this.repository.updateClipart(id, updateData);

    return ClipartService.toView(updated);
  }

  async deleteClipart(id: string): Promise<void> {
    await this.repository.softDeleteClipart(id);
  }

  ensureExists = async (id: string): Promise<void> => {
    try {
      await this.repository.findByIdOrThrow(id);
    } catch {
      throw new NotFoundError("Clipart asset not found.");
    }
  };
}
