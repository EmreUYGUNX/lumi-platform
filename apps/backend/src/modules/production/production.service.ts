/* eslint-disable unicorn/no-null */
import type { UploadApiOptions } from "cloudinary";
import { OrderStatus, PrintMethod, Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

import { getConfig } from "@/config/index.js";
import type { PreviewLayerInput } from "@/integrations/cloudinary/cloudinary-overlay.js";
import {
  applyImageOverlay,
  applyTextOverlay,
} from "@/integrations/cloudinary/cloudinary-overlay.js";
import {
  type CloudinaryClient,
  getCloudinaryClient,
} from "@/integrations/cloudinary/cloudinary.client.js";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors.js";
import { createChildLogger } from "@/lib/logger.js";
import { getPrismaClient } from "@/lib/prisma.js";
import type { PaginationMeta } from "@/lib/response.js";
import type { PreviewLayer } from "@/modules/preview/preview.validators.js";
import { PreviewService } from "@/modules/preview/preview.service.js";

import type { ProductionOrdersListQuery, ProductionOrderStatus } from "./production.validators.js";
import { orderItemDesignDataSchema } from "./production.validators.js";

type TransformationDefinition = Exclude<NonNullable<UploadApiOptions["transformation"]>, string>;
type TransformationStep = Record<string, unknown>;

export interface ProductionFileConfig {
  resolution: {
    dpi: number;
    width: number;
    height: number;
  };
  format: "png";
  backgroundColor: "transparent";
  colorProfile: "CMYK";
  printMethod: PrintMethod;
  bleedArea: "5mm";
  safeArea: "10mm";
  quality: number;
}

export interface PrintSpecifications {
  dpi: number;
  width: number;
  height: number;
  bleedMm: number;
  safeMm: number;
  bleedPx: number;
  safePx: number;
}

export interface ProductionGenerateResult {
  customizationId: string;
  orderId: string;
  orderItemId: string;
  productId: string;
  productName: string;
  designArea: string;
  printMethod: PrintMethod;
  config: ProductionFileConfig;
  specs: PrintSpecifications;
  productionPublicId: string;
  productionFileUrl: string;
  downloadUrl: string;
  downloadExpiresAt: string;
  generatedAt: string;
  regenerated: boolean;
}

export interface ProductionDownloadResult {
  customizationId: string;
  downloadUrl: string;
  expiresAt: string;
}

export interface ProductionOrderManifestEntry {
  productName: string;
  designArea: string;
  productionFile: string | null;
  printMethod: string;
  resolution: string;
  colorProfile: string;
  bleed: string;
  safeArea: string;
}

export interface ProductionOrderManifest {
  orderId: string;
  orderDate: string;
  customizations: ProductionOrderManifestEntry[];
}

export interface ProductionOrderFilesResult {
  orderId: string;
  orderReference: string;
  orderStatus: string;
  orderDate: string;
  customer: {
    userId?: string;
    name: string;
    email?: string;
  };
  totals: {
    totalAmount: { amount: string; currency: string };
    currency: string;
  };
  shippingAddress?: {
    fullName: string;
    phone?: string | null;
    line1: string;
    line2?: string | null;
    city: string;
    state?: string | null;
    postalCode: string;
    country: string;
  } | null;
  printSpecs: PrintSpecifications;
  items: {
    customizationId: string;
    orderItemId: string;
    productId: string;
    productName: string;
    productImageUrl?: string | null;
    productVariantId?: string;
    variantTitle?: string | null;
    sku?: string | null;
    quantity: number;
    designArea: string;
    previewUrl?: string | null;
    thumbnailUrl?: string | null;
    designData?: unknown;
    layerCount?: number;
    printMethod: PrintMethod;
    productionGenerated: boolean;
    productionFileUrl: string | null;
    productionPublicId: string | null;
    productionDpi: number;
    downloadedAt?: string | null;
    downloadUrl?: string;
    downloadExpiresAt?: string;
  }[];
  batchDownload: {
    available: boolean;
    items: ProductionDownloadResult[];
  };
  manifest: ProductionOrderManifest;
}

export interface ProductionOrderListItem {
  orderId: string;
  orderReference: string;
  orderStatus: string;
  orderDate: string;
  customer: ProductionOrderFilesResult["customer"];
  totals: ProductionOrderFilesResult["totals"];
  customizationCount: number;
  pendingCount: number;
  downloadedCount: number;
  productionStatus: ProductionOrderStatus;
}

export interface ProductionServiceOptions {
  prisma?: PrismaClient;
  cloudinary?: CloudinaryClient;
  previewService?: PreviewService;
  logger?: ReturnType<typeof createChildLogger>;
}

const DEFAULT_PRODUCTION_CONFIG: ProductionFileConfig = {
  resolution: {
    dpi: 300,
    width: 5000,
    height: 5000,
  },
  format: "png",
  backgroundColor: "transparent",
  colorProfile: "CMYK",
  printMethod: PrintMethod.DTG,
  bleedArea: "5mm",
  safeArea: "10mm",
  quality: 100,
} as const;

const DOWNLOAD_EXPIRY_HOURS = 24;
const MM_PER_INCH = 25.4;

const normaliseOrderDate = (value: Date | null | undefined): string => {
  if (!value) {
    return new Date().toISOString().slice(0, 10);
  }

  return value.toISOString().slice(0, 10);
};

const parseMm = (value: string): number => {
  const match = value.trim().match(/^(\d+(?:\.\d+)?)mm$/i);
  if (!match?.[1]) {
    return 0;
  }

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : 0;
};

const mmToPixels = (mm: number, dpi: number): number =>
  Math.round((mm / MM_PER_INCH) * Math.max(1, dpi));

const isPaidOrderStatus = (status: OrderStatus): boolean =>
  status === OrderStatus.PAID ||
  status === OrderStatus.FULFILLED ||
  status === OrderStatus.SHIPPED ||
  status === OrderStatus.DELIVERED;

const buildResolutionLabel = (config: ProductionFileConfig): string =>
  `${config.resolution.width}x${config.resolution.height}@${config.resolution.dpi}dpi`;

const formatPrintMethod = (method: PrintMethod): string => {
  switch (method) {
    case PrintMethod.SCREEN: {
      return "Screen";
    }
    case PrintMethod.EMBROIDERY: {
      return "Embroidery";
    }
    default: {
      return "DTG";
    }
  }
};

interface ProductionOrderItemRow {
  id: string;
  quantity: number;
  productId: string;
  productVariantId: string;
  product: {
    title: string;
    productMedia: {
      media: {
        url: string;
      };
    }[];
  };
  productVariant: { title: string; sku: string } | null;
  customization: {
    id: string;
    designArea: string;
    designData: unknown;
    previewUrl: string | null;
    thumbnailUrl: string | null;
    printMethod: PrintMethod;
    productionGenerated: boolean;
    productionFileUrl: string | null;
    productionPublicId: string | null;
    productionDpi: number;
    layerCount: number;
    downloadedAt: Date | null;
  } | null;
}

interface ProductionOrdersListRow {
  id: string;
  reference: string;
  status: OrderStatus;
  placedAt: Date | null;
  createdAt: Date;
  totalAmount: Prisma.Decimal;
  currency: string;
  user: { id: string; email: string; firstName: string | null; lastName: string | null } | null;
  shippingAddress: { fullName: string } | null;
  items: {
    customization: {
      productionGenerated: boolean;
      productionPublicId: string | null;
      downloadedAt: Date | null;
    } | null;
  }[];
}

const resolveCustomerName = (params: {
  shippingFullName?: string | null;
  userFirstName?: string | null;
  userLastName?: string | null;
  userEmail?: string | null;
}): string => {
  const shippingName = params.shippingFullName?.trim();
  if (shippingName) return shippingName;

  const firstName = params.userFirstName?.trim();
  const lastName = params.userLastName?.trim();
  if (firstName || lastName) {
    return [firstName, lastName].filter(Boolean).join(" ");
  }

  return params.userEmail ?? "Unknown customer";
};

const buildOrderTotals = (
  totalAmount: Prisma.Decimal,
  currency: string,
): ProductionOrderFilesResult["totals"] => ({
  totalAmount: {
    amount: new Prisma.Decimal(totalAmount).toFixed(2),
    currency,
  },
  currency,
});

const buildOrderProductionItems = (
  orderItems: readonly ProductionOrderItemRow[],
  buildDownloadUrl: (
    customizationId: string,
    productionPublicId: string,
  ) => { downloadUrl: string; expiresAt: string },
): ProductionOrderFilesResult["items"] => {
  return orderItems.flatMap((item) => {
    const { customization } = item;
    if (!customization) {
      return [];
    }

    const productImageUrl = item.product.productMedia[0]?.media.url ?? null;
    const base = {
      customizationId: customization.id,
      orderItemId: item.id,
      productId: item.productId,
      productName: item.product.title,
      productImageUrl,
      designArea: customization.designArea,
      productVariantId: item.productVariantId,
      variantTitle: item.productVariant?.title ?? null,
      sku: item.productVariant?.sku ?? null,
      quantity: item.quantity,
      previewUrl: customization.previewUrl,
      thumbnailUrl: customization.thumbnailUrl,
      designData: customization.designData,
      layerCount: customization.layerCount,
      printMethod: customization.printMethod,
      productionGenerated: customization.productionGenerated,
      productionFileUrl: customization.productionFileUrl,
      productionPublicId: customization.productionPublicId,
      productionDpi: customization.productionDpi,
      downloadedAt: customization.downloadedAt ? customization.downloadedAt.toISOString() : null,
    } satisfies ProductionOrderFilesResult["items"][number];

    if (!customization.productionGenerated || !customization.productionPublicId) {
      return [base];
    }

    const download = buildDownloadUrl(customization.id, customization.productionPublicId);
    return [
      {
        ...base,
        downloadUrl: download.downloadUrl,
        downloadExpiresAt: download.expiresAt,
      },
    ];
  });
};

const buildBatchDownloadItems = (
  items: ProductionOrderFilesResult["items"],
): ProductionDownloadResult[] => {
  const downloads: ProductionDownloadResult[] = [];

  // eslint-disable-next-line no-restricted-syntax -- explicit iteration keeps lint rules satisfied.
  for (const item of items) {
    if (item.downloadUrl && item.downloadExpiresAt) {
      downloads.push({
        customizationId: item.customizationId,
        downloadUrl: item.downloadUrl,
        expiresAt: item.downloadExpiresAt,
      });
    }
  }

  return downloads;
};

const buildOrderManifest = (
  orderId: string,
  orderDate: string,
  config: ProductionFileConfig,
  items: ProductionOrderFilesResult["items"],
): ProductionOrderManifest => ({
  orderId,
  orderDate,
  customizations: items.map((item) => ({
    productName: item.productName,
    designArea: item.designArea,
    productionFile: item.productionFileUrl ?? null,
    printMethod: formatPrintMethod(item.printMethod),
    resolution: buildResolutionLabel(config),
    colorProfile: config.colorProfile,
    bleed: config.bleedArea,
    safeArea: config.safeArea,
  })),
});

const resolveOrderProductionStatus = (
  orderStatus: OrderStatus,
  pendingCount: number,
  downloadedCount: number,
  printedStatuses: readonly OrderStatus[],
): ProductionOrderStatus => {
  if (printedStatuses.includes(orderStatus)) {
    return "printed";
  }
  if (pendingCount > 0) {
    return "pending";
  }
  if (downloadedCount > 0) {
    return "downloaded";
  }
  return "ready";
};

const buildProductionOrdersWhere = (
  query: ProductionOrdersListQuery,
  printedStatuses: readonly OrderStatus[],
): Prisma.OrderWhereInput => {
  const base: Prisma.OrderWhereInput = {
    items: {
      some: {
        customization: {
          isNot: null,
        },
      },
    },
  };

  if (query.search) {
    base.reference = { contains: query.search.trim(), mode: "insensitive" };
  }

  if (query.from || query.to) {
    base.createdAt = {
      ...(query.from ? { gte: query.from } : {}),
      ...(query.to ? { lte: query.to } : {}),
    };
  }

  if (!query.status) {
    return base;
  }

  const pendingCustomizations: Prisma.OrderWhereInput = {
    items: {
      some: {
        customization: {
          is: {
            OR: [{ productionGenerated: false }, { productionPublicId: null }],
          },
        },
      },
    },
  };

  const anyCustomizationDownloaded: Prisma.OrderWhereInput = {
    items: {
      some: {
        customization: {
          is: {
            downloadedAt: { not: null },
          },
        },
      },
    },
  };

  const noCustomizationDownloaded: Prisma.OrderWhereInput = {
    items: {
      none: {
        customization: {
          is: {
            downloadedAt: { not: null },
          },
        },
      },
    },
  };

  const isNotPrinted: Prisma.OrderWhereInput = {
    status: { notIn: [...printedStatuses] },
  };

  const allGenerated: Prisma.OrderWhereInput = {
    items: {
      none: {
        customization: {
          is: {
            OR: [{ productionGenerated: false }, { productionPublicId: null }],
          },
        },
      },
    },
  };

  switch (query.status) {
    case "printed": {
      return { ...base, status: { in: [...printedStatuses] } };
    }
    case "pending": {
      return { AND: [base, isNotPrinted, pendingCustomizations] };
    }
    case "ready": {
      return { AND: [base, isNotPrinted, allGenerated, noCustomizationDownloaded] };
    }
    case "downloaded": {
      return { AND: [base, isNotPrinted, allGenerated, anyCustomizationDownloaded] };
    }
    default: {
      return base;
    }
  }
};

const buildProductionOrderListItem = (
  order: ProductionOrdersListRow,
  printedStatuses: readonly OrderStatus[],
): ProductionOrderListItem => {
  const orderDate = normaliseOrderDate(order.placedAt ?? order.createdAt);
  const customerName = resolveCustomerName({
    shippingFullName: order.shippingAddress?.fullName,
    userFirstName: order.user?.firstName,
    userLastName: order.user?.lastName,
    userEmail: order.user?.email,
  });

  const customizations = order.items
    .map((item) => item.customization)
    .filter(
      (customization): customization is NonNullable<typeof customization> => customization != null,
    );

  const customizationCount = customizations.length;
  const pendingCount = customizations.filter(
    (customization) => !customization.productionGenerated || !customization.productionPublicId,
  ).length;
  const downloadedCount = customizations.filter(
    (customization) => customization.downloadedAt,
  ).length;

  return {
    orderId: order.id,
    orderReference: order.reference,
    orderStatus: order.status,
    orderDate,
    customer: {
      userId: order.user?.id ?? undefined,
      name: customerName,
      email: order.user?.email ?? undefined,
    },
    totals: buildOrderTotals(order.totalAmount, order.currency),
    customizationCount,
    pendingCount,
    downloadedCount,
    productionStatus: resolveOrderProductionStatus(
      order.status,
      pendingCount,
      downloadedCount,
      printedStatuses,
    ),
  };
};

export class ProductionService {
  private readonly prisma: PrismaClient;

  private readonly cloudinary: CloudinaryClient;

  private readonly previewService: PreviewService;

  private readonly logger: ReturnType<typeof createChildLogger>;

  constructor(options: ProductionServiceOptions = {}) {
    this.prisma = options.prisma ?? getPrismaClient();
    this.cloudinary = options.cloudinary ?? getCloudinaryClient();
    this.previewService = options.previewService ?? new PreviewService({ prisma: this.prisma });
    this.logger = options.logger ?? createChildLogger("production:service");
  }

  static buildProductionTransformation(
    layers: PreviewLayerInput[],
    config: ProductionFileConfig = DEFAULT_PRODUCTION_CONFIG,
  ): TransformationDefinition {
    const layerTransforms = layers.map((layer) => {
      if (layer.type === "text") {
        return applyTextOverlay(layer.text, layer.style, layer.position);
      }

      return applyImageOverlay(layer.publicId, layer.transform, layer.position);
    });

    const outputStep: TransformationStep = {
      width: config.resolution.width,
      height: config.resolution.height,
      crop: "limit",
      quality: String(config.quality),
      format: config.format,
      fetch_format: config.format,
      density: config.resolution.dpi,
      color_space: "cmyk",
    };

    return [...layerTransforms, outputStep] as TransformationDefinition;
  }

  static addPrintSpecifications(
    config: ProductionFileConfig = DEFAULT_PRODUCTION_CONFIG,
  ): PrintSpecifications {
    const bleedMm = parseMm(config.bleedArea);
    const safeMm = parseMm(config.safeArea);

    return {
      dpi: config.resolution.dpi,
      width: config.resolution.width,
      height: config.resolution.height,
      bleedMm,
      safeMm,
      bleedPx: mmToPixels(bleedMm, config.resolution.dpi),
      safePx: mmToPixels(safeMm, config.resolution.dpi),
    };
  }

  static convertColorProfile(
    imageUrl: string,
    profile: ProductionFileConfig["colorProfile"],
  ): string {
    if (profile !== "CMYK") {
      return imageUrl;
    }

    if (imageUrl.includes("cs_cmyk") || imageUrl.includes("color_space")) {
      return imageUrl;
    }

    const [prefix, rest] = imageUrl.split("/upload/");
    if (!rest) {
      return imageUrl;
    }

    return `${prefix}/upload/cs_cmyk/${rest}`;
  }

  static addProductionMetadata(payload: {
    orderId: string;
    orderReference: string;
    orderDate: string;
    orderItemId: string;
    customizationId: string;
    productId: string;
    productName: string;
    designArea: string;
    printMethod: PrintMethod;
    config: ProductionFileConfig;
  }): {
    context: Record<string, unknown>;
    filename: string;
  } {
    const resolution = buildResolutionLabel(payload.config);
    const filename = `order-${payload.orderReference}-${payload.orderItemId}-${payload.designArea}`;

    return {
      filename,
      context: {
        orderId: payload.orderId,
        orderReference: payload.orderReference,
        orderDate: payload.orderDate,
        orderItemId: payload.orderItemId,
        customizationId: payload.customizationId,
        productId: payload.productId,
        productName: payload.productName,
        designArea: payload.designArea,
        printMethod: payload.printMethod,
        resolution,
        colorProfile: payload.config.colorProfile,
        bleed: payload.config.bleedArea,
        safeArea: payload.config.safeArea,
      },
    };
  }

  generateProductionFile = async (
    orderItemId: string,
    options: { force?: boolean } = {},
  ): Promise<ProductionGenerateResult> => {
    const customization = await this.prisma.orderItemCustomization.findUnique({
      where: { orderItemId },
      include: {
        orderItem: {
          select: {
            id: true,
            productId: true,
            order: {
              select: {
                id: true,
                reference: true,
                status: true,
                placedAt: true,
                createdAt: true,
                userId: true,
              },
            },
            product: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
    });

    if (!customization) {
      throw new NotFoundError("Order item customization not found.", { details: { orderItemId } });
    }

    const { order, product, productId } = customization.orderItem;

    if (!isPaidOrderStatus(order.status)) {
      throw new ConflictError("Production exports require a paid order.", {
        details: { orderId: order.id, status: order.status },
      });
    }

    const config: ProductionFileConfig = {
      ...DEFAULT_PRODUCTION_CONFIG,
      printMethod: customization.printMethod,
    };

    const specs = ProductionService.addPrintSpecifications(config);

    if (
      customization.productionGenerated &&
      customization.productionFileUrl &&
      customization.productionPublicId &&
      !options.force
    ) {
      const download = this.buildDownloadUrl(customization.id, customization.productionPublicId);
      return {
        customizationId: customization.id,
        orderId: order.id,
        orderItemId,
        productId: product.id,
        productName: product.title,
        designArea: customization.designArea,
        printMethod: customization.printMethod,
        config,
        specs,
        productionPublicId: customization.productionPublicId,
        productionFileUrl: customization.productionFileUrl,
        downloadUrl: download.downloadUrl,
        downloadExpiresAt: download.expiresAt,
        generatedAt: new Date().toISOString(),
        regenerated: false,
      };
    }

    const designData = orderItemDesignDataSchema.parse(customization.designData);
    const designArea = designData.designArea ?? customization.designArea;

    const userId = order.userId ?? "";
    const hasDesignIds = designData.layers.some(
      (layer): layer is Extract<PreviewLayer, { type: "image"; designId: string }> =>
        layer.type === "image" && typeof layer.designId === "string" && layer.designId.length > 0,
    );

    if (hasDesignIds && !order.userId) {
      throw new ValidationError("Order is missing a customer context for design resolution.", {
        issues: [
          {
            path: "order.userId",
            message: "Order must belong to a user to resolve private design assets.",
          },
        ],
      });
    }

    const { basePublicId, layers } = await this.previewService.buildCloudinaryTransformation(
      productId,
      {
        designArea,
        layers: designData.layers,
        resolution: "production",
      },
      userId,
    );

    const transformation = ProductionService.buildProductionTransformation(layers, config);

    const compositeUrl = this.cloudinary.generateImageUrl(basePublicId, {
      transformation,
      secure: true,
    });

    const colorConvertedUrl = ProductionService.convertColorProfile(
      compositeUrl,
      config.colorProfile,
    );

    const orderDate = normaliseOrderDate(order.placedAt ?? order.createdAt);
    const metadata = ProductionService.addProductionMetadata({
      orderId: order.id,
      orderReference: order.reference,
      orderDate,
      orderItemId,
      customizationId: customization.id,
      productId: product.id,
      productName: product.title,
      designArea: customization.designArea,
      printMethod: customization.printMethod,
      config,
    });

    const productionFolderBase = getConfig().media.cloudinary.folders.products;
    const folder = `${productionFolderBase}/production/orders/${order.id}`;

    this.logger.info("Generating production export via Cloudinary", {
      orderId: order.id,
      orderItemId,
      customizationId: customization.id,
      productId: product.id,
      printMethod: customization.printMethod,
      resolution: buildResolutionLabel(config),
    });

    const uploaded = await this.cloudinary.upload(colorConvertedUrl, {
      folder,
      tags: [
        "production",
        `order:${order.id}`,
        `orderItem:${orderItemId}`,
        `customization:${customization.id}`,
        `product:${customization.orderItem.product.id}`,
      ],
      context: metadata.context,
      filenameOverride: metadata.filename,
      useFilename: true,
      uniqueFilename: false,
      overwrite: true,
    });

    const updated = await this.prisma.orderItemCustomization.update({
      where: { id: customization.id },
      data: {
        productionPublicId: uploaded.public_id,
        productionFileUrl: uploaded.secure_url,
        productionGenerated: true,
        productionDpi: config.resolution.dpi,
      },
    });

    const download = this.buildDownloadUrl(updated.id, uploaded.public_id);

    return {
      customizationId: updated.id,
      orderId: order.id,
      orderItemId,
      productId: product.id,
      productName: product.title,
      designArea: updated.designArea,
      printMethod: updated.printMethod,
      config,
      specs,
      productionPublicId: uploaded.public_id,
      productionFileUrl: uploaded.secure_url,
      downloadUrl: download.downloadUrl,
      downloadExpiresAt: download.expiresAt,
      generatedAt: new Date().toISOString(),
      regenerated: true,
    };
  };

  getDownloadUrl = async (customizationId: string): Promise<ProductionDownloadResult> => {
    const customization = await this.prisma.orderItemCustomization.findUnique({
      where: { id: customizationId },
      select: {
        id: true,
        productionPublicId: true,
        productionGenerated: true,
        downloadedAt: true,
      },
    });

    if (!customization) {
      throw new NotFoundError("Production customization not found.", {
        details: { customizationId },
      });
    }

    if (!customization.productionGenerated || !customization.productionPublicId) {
      throw new ConflictError("Production file has not been generated for this customization.", {
        details: { customizationId },
      });
    }

    if (!customization.downloadedAt) {
      await this.prisma.orderItemCustomization.update({
        where: { id: customization.id },
        data: { downloadedAt: new Date() },
      });
    }

    const download = this.buildDownloadUrl(customization.id, customization.productionPublicId);
    return {
      customizationId: customization.id,
      downloadUrl: download.downloadUrl,
      expiresAt: download.expiresAt,
    };
  };

  getOrderProductionFiles = async (orderId: string): Promise<ProductionOrderFilesResult> => {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        reference: true,
        status: true,
        placedAt: true,
        createdAt: true,
        totalAmount: true,
        currency: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        shippingAddress: {
          select: {
            fullName: true,
            phone: true,
            line1: true,
            line2: true,
            city: true,
            state: true,
            postalCode: true,
            country: true,
          },
        },
        items: {
          select: {
            id: true,
            quantity: true,
            productId: true,
            productVariantId: true,
            product: {
              select: {
                title: true,
                productMedia: {
                  orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
                  take: 1,
                  select: {
                    media: {
                      select: {
                        url: true,
                      },
                    },
                  },
                },
              },
            },
            productVariant: {
              select: {
                title: true,
                sku: true,
              },
            },
            customization: {
              select: {
                id: true,
                designArea: true,
                designData: true,
                previewUrl: true,
                thumbnailUrl: true,
                printMethod: true,
                productionGenerated: true,
                productionFileUrl: true,
                productionPublicId: true,
                productionDpi: true,
                layerCount: true,
                downloadedAt: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundError("Order not found.", { details: { orderId } });
    }

    const orderDate = normaliseOrderDate(order.placedAt ?? order.createdAt);

    const config = DEFAULT_PRODUCTION_CONFIG;
    const specs = ProductionService.addPrintSpecifications(config);

    const items = buildOrderProductionItems(order.items, this.buildDownloadUrl);
    const batchItems = buildBatchDownloadItems(items);
    const manifest = buildOrderManifest(order.id, orderDate, config, items);
    const customerName = resolveCustomerName({
      shippingFullName: order.shippingAddress?.fullName,
      userFirstName: order.user?.firstName,
      userLastName: order.user?.lastName,
      userEmail: order.user?.email,
    });
    const totals = buildOrderTotals(order.totalAmount, order.currency);

    return {
      orderId: order.id,
      orderReference: order.reference,
      orderStatus: order.status,
      orderDate,
      customer: {
        userId: order.user?.id ?? undefined,
        name: customerName,
        email: order.user?.email ?? undefined,
      },
      totals,
      shippingAddress: order.shippingAddress,
      printSpecs: specs,
      items,
      batchDownload: {
        available: batchItems.length > 0,
        items: batchItems,
      },
      manifest,
    };
  };

  listProductionOrders = async (
    query: ProductionOrdersListQuery,
  ): Promise<{ items: ProductionOrderListItem[]; meta: PaginationMeta }> => {
    const printedStatuses: OrderStatus[] = [
      OrderStatus.FULFILLED,
      OrderStatus.SHIPPED,
      OrderStatus.DELIVERED,
    ];

    const where = buildProductionOrdersWhere(query, printedStatuses);

    const totalItems = await this.prisma.order.count({ where });
    const totalPages = totalItems === 0 ? 0 : Math.max(1, Math.ceil(totalItems / query.pageSize));
    const page = Math.min(query.page, totalPages === 0 ? 1 : totalPages);
    const skip = (page - 1) * query.pageSize;

    const orders = await this.prisma.order.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip,
      take: query.pageSize,
      select: {
        id: true,
        reference: true,
        status: true,
        placedAt: true,
        createdAt: true,
        totalAmount: true,
        currency: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        shippingAddress: {
          select: {
            fullName: true,
          },
        },
        items: {
          where: {
            customization: {
              isNot: null,
            },
          },
          select: {
            customization: {
              select: {
                productionGenerated: true,
                productionPublicId: true,
                downloadedAt: true,
              },
            },
          },
        },
      },
    });

    const items = orders.map((order) =>
      buildProductionOrderListItem(order as unknown as ProductionOrdersListRow, printedStatuses),
    );

    return {
      items,
      meta: {
        totalItems,
        totalPages,
        page,
        pageSize: query.pageSize,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1 && totalPages > 0,
      },
    };
  };

  private buildDownloadUrl = (
    customizationId: string,
    productionPublicId: string,
  ): { downloadUrl: string; expiresAt: string } => {
    const expiresAt = new Date(Date.now() + DOWNLOAD_EXPIRY_HOURS * 60 * 60 * 1000);

    return {
      downloadUrl: this.cloudinary.generatePrivateDownloadUrl(productionPublicId, "png", {
        expiresAt,
        attachment: true,
      }),
      expiresAt: expiresAt.toISOString(),
    };
  };
}
