/* istanbul ignore file */

import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";

import archiver from "archiver";
import type { Request, RequestHandler, Response } from "express";

import { recordAuditLog } from "@/audit/audit-log.service.js";
import { ApiError } from "@/errors/api-error.js";
import { asyncHandler } from "@/lib/asyncHandler.js";
import { createChildLogger } from "@/lib/logger.js";
import { paginatedResponse, successResponse } from "@/lib/response.js";
import { generateSlug } from "@/lib/string.js";

import type { ProductionOrderFilesResult, ProductionService } from "./production.service.js";
import {
  productionBatchDownloadBodySchema,
  productionDownloadIdParamSchema,
  productionGenerateBodySchema,
  productionOrderIdParamSchema,
  productionOrdersListQuerySchema,
} from "./production.validators.js";

const AUTHENTICATION_REQUIRED_MESSAGE = "Authentication required.";
const USER_AGENT_HEADER = "user-agent";

const escapePdfText = (value: string): string =>
  value.replaceAll(/([()\\])/gu, "\\$1").replaceAll(/\r?\n/gu, " ");

const buildSimplePdf = (lines: readonly string[]): Buffer => {
  const resolvedLines = lines.map((line) => escapePdfText(line));
  const contentLines = ["BT", "/F1 12 Tf", "72 760 Td"];
  resolvedLines.forEach((line, index) => {
    if (index === 0) {
      contentLines.push(`(${line}) Tj`);
    } else {
      contentLines.push("0 -16 Td", `(${line}) Tj`);
    }
  });
  contentLines.push("ET");

  const contentStream = contentLines.join("\n");
  const contentLength = Buffer.byteLength(contentStream, "utf8");

  const objects = [
    "",
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /ProcSet [/PDF /Text] >> /Contents 4 0 R >>\nendobj\n",
    `4 0 obj\n<< /Length ${contentLength} >>\nstream\n${contentStream}\nendstream\nendobj\n`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
  ];

  const header = "%PDF-1.4\n";
  const offsets: number[] = [0];
  let cursor = Buffer.byteLength(header, "utf8");

  for (let index = 1; index < objects.length; index += 1) {
    offsets[index] = cursor;
    cursor += Buffer.byteLength(objects[index]!, "utf8");
  }

  const xrefStart = cursor;
  const xrefLines = ["xref", `0 ${objects.length}`, "0000000000 65535 f "];
  for (let index = 1; index < objects.length; index += 1) {
    const offset = offsets[index] ?? 0;
    xrefLines.push(`${String(offset).padStart(10, "0")} 00000 n `);
  }

  const trailer = [
    "trailer",
    `<< /Size ${objects.length} /Root 1 0 R >>`,
    "startxref",
    String(xrefStart),
    "%%EOF",
    "",
  ];

  const pdf = [header, ...objects.slice(1), `${xrefLines.join("\n")}\n`, `${trailer.join("\n")}`];
  return Buffer.from(pdf.join(""), "utf8");
};

type ProductionOrderItem = ProductionOrderFilesResult["items"][number];

const appendProductionItemToArchive = async (params: {
  archive: archiver.Archiver;
  folder: string;
  orderId: string;
  item: ProductionOrderItem;
  service: ProductionService;
  logger: ReturnType<typeof createChildLogger>;
}): Promise<void> => {
  const { archive, folder, item, orderId, service, logger } = params;

  if (!item.productionGenerated || !item.productionPublicId) {
    return;
  }

  const refreshed = await service.getDownloadUrl(item.customizationId);
  const response = await fetch(refreshed.downloadUrl);

  if (!response.ok || !response.body) {
    logger.warn("Failed to fetch production file for archive", {
      orderId,
      customizationId: item.customizationId,
      status: response.status,
    });
    return;
  }

  const baseName = item.sku ?? item.variantTitle ?? item.productName;
  const fileStem = generateSlug(`${item.designArea}-${baseName}`);
  const suffix = item.orderItemId.slice(-6);
  const fileName = `${fileStem}-${suffix}.png`;

  const nodeStream = Readable.fromWeb(response.body as unknown as NodeReadableStream<Uint8Array>);
  archive.append(nodeStream, { name: `${folder}/${fileName}` });

  await new Promise<void>((resolve, reject) => {
    nodeStream.once("end", () => resolve());
    nodeStream.once("error", (error) => reject(error));
  });
};

const appendOrderToArchive = async (params: {
  archive: archiver.Archiver;
  orderId: string;
  service: ProductionService;
  logger: ReturnType<typeof createChildLogger>;
}): Promise<void> => {
  const { archive, orderId, service, logger } = params;
  const detail = await service.getOrderProductionFiles(orderId);
  const folder = `order-${detail.orderId}`;

  archive.append(JSON.stringify(detail.manifest, undefined, 2), {
    name: `${folder}/manifest.json`,
  });

  const specsPdf = buildSimplePdf([
    `Order: ${detail.orderReference}`,
    `Date: ${detail.orderDate}`,
    `Customer: ${detail.customer.name}`,
    `Resolution: ${detail.printSpecs.width}x${detail.printSpecs.height} @ ${detail.printSpecs.dpi}dpi`,
    `Bleed: ${detail.printSpecs.bleedMm}mm (${detail.printSpecs.bleedPx}px)`,
    `Safe: ${detail.printSpecs.safeMm}mm (${detail.printSpecs.safePx}px)`,
  ]);
  archive.append(specsPdf, { name: `${folder}/specifications.pdf` });

  // eslint-disable-next-line no-restricted-syntax -- sequential streaming limits concurrent HTTP downloads.
  for (const item of detail.items) {
    // eslint-disable-next-line no-await-in-loop -- sequential downloads reduce concurrent socket usage.
    await appendProductionItemToArchive({
      archive,
      folder,
      orderId,
      item,
      service,
      logger,
    });
  }
};

export interface ProductionControllerOptions {
  service: ProductionService;
}

export class ProductionController {
  public readonly generate: RequestHandler;

  public readonly download: RequestHandler;

  public readonly listOrder: RequestHandler;

  public readonly listOrders: RequestHandler;

  public readonly batchDownload: RequestHandler;

  private readonly service: ProductionService;

  private readonly logger: ReturnType<typeof createChildLogger>;

  constructor(options: ProductionControllerOptions) {
    this.service = options.service;
    this.logger = createChildLogger("production:controller");

    this.generate = asyncHandler(this.handleGenerate.bind(this));
    this.download = asyncHandler(this.handleDownload.bind(this));
    this.listOrder = asyncHandler(this.handleListOrder.bind(this));
    this.listOrders = asyncHandler(this.handleListOrders.bind(this));
    this.batchDownload = asyncHandler(this.handleBatchDownload.bind(this));
  }

  private async handleGenerate(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new ApiError(AUTHENTICATION_REQUIRED_MESSAGE, { status: 401, code: "UNAUTHORIZED" });
    }

    const body = productionGenerateBodySchema.parse(req.body ?? {});

    const result = await this.service.generateProductionFile(body.orderItemId, {
      force: body.force,
    });

    res.json(successResponse(result));
  }

  private async handleDownload(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new ApiError(AUTHENTICATION_REQUIRED_MESSAGE, { status: 401, code: "UNAUTHORIZED" });
    }

    const customizationId = productionDownloadIdParamSchema.parse(req.params.id);
    const result = await this.service.getDownloadUrl(customizationId);

    try {
      await recordAuditLog({
        action: "production.download",
        entity: "order_item_customization",
        entityId: customizationId,
        userId: req.user.id,
        ipAddress: req.ip,
        userAgent: req.get(USER_AGENT_HEADER) ?? undefined,
        metadata: {
          requestId: req.id,
          expiresAt: result.expiresAt,
        },
      });
    } catch (error) {
      this.logger.warn("Failed to record production download audit trail", {
        error,
        customizationId,
        userId: req.user.id,
        requestId: req.id,
      });
    }

    res.json(successResponse(result));
  }

  private async handleListOrder(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new ApiError(AUTHENTICATION_REQUIRED_MESSAGE, { status: 401, code: "UNAUTHORIZED" });
    }

    const orderId = productionOrderIdParamSchema.parse(req.params.orderId);
    const result = await this.service.getOrderProductionFiles(orderId);

    res.json(successResponse(result));
  }

  private async handleListOrders(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new ApiError(AUTHENTICATION_REQUIRED_MESSAGE, { status: 401, code: "UNAUTHORIZED" });
    }

    const query = productionOrdersListQuerySchema.parse(req.query);
    const result = await this.service.listProductionOrders(query);

    res.json(
      paginatedResponse(result.items, {
        totalItems: result.meta.totalItems,
        page: result.meta.page,
        pageSize: result.meta.pageSize,
        totalPages: result.meta.totalPages,
        hasNextPage: result.meta.hasNextPage,
        hasPreviousPage: result.meta.hasPreviousPage,
      }),
    );
  }

  private async handleBatchDownload(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      throw new ApiError(AUTHENTICATION_REQUIRED_MESSAGE, { status: 401, code: "UNAUTHORIZED" });
    }

    const body = productionBatchDownloadBodySchema.parse(req.body ?? {});

    const filename = `production-orders-${new Date().toISOString().replaceAll(/[.:]/gu, "-")}.zip`;
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.on("warning", (warning: unknown) => {
      this.logger.warn("Production archive warning", { warning });
    });

    archive.on("error", (error: unknown) => {
      this.logger.error("Production archive error", { error });
    });

    archive.pipe(res);

    const archiveFinished = new Promise<void>((resolve, reject) => {
      res.once("finish", () => resolve());
      res.once("close", () => resolve());
      archive.once("error", (error: unknown) => reject(error));
    });

    // eslint-disable-next-line no-restricted-syntax -- sequential streaming limits concurrent HTTP downloads.
    for (const orderId of body.orderIds) {
      // eslint-disable-next-line no-await-in-loop -- sequential archive generation keeps memory usage predictable.
      await appendOrderToArchive({
        archive,
        orderId,
        service: this.service,
        logger: this.logger,
      });
    }

    archive.finalize();
    await archiveFinished;
  }
}
