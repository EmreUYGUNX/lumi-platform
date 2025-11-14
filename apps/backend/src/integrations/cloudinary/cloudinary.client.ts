import type { UploadApiErrorResponse, UploadApiOptions, UploadApiResponse } from "cloudinary";
import { v2 as cloudinary } from "cloudinary";

import { type CloudinaryIntegrationConfig, getCloudinaryConfig } from "./cloudinary.config.js";
import { CloudinaryIntegrationError } from "./cloudinary.errors.js";
import { buildDefaultDeliveryTransformation } from "./cloudinary.helpers.js";

type UploadableSource = Buffer | string;
type TransformationDefinition = Exclude<NonNullable<UploadApiOptions["transformation"]>, string>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export interface CloudinaryUploadOptions {
  folder?: string;
  preset?: string;
  resourceType?: UploadApiOptions["resource_type"];
  tags?: string[];
  eager?: UploadApiOptions["eager"];
  context?: Record<string, unknown>;
  metadata?: Record<string, string | number | boolean>;
  transformation?: TransformationDefinition;
  filenameOverride?: string;
  useFilename?: boolean;
  uniqueFilename?: boolean;
  overwrite?: boolean;
  invalidate?: boolean;
  mimeType?: string;
}

export interface CloudinaryDeleteOptions {
  resourceType?: UploadApiOptions["resource_type"];
  invalidate?: boolean;
}

export interface GenerateImageUrlOptions {
  transformation?: TransformationDefinition;
  secure?: boolean;
  resourceType?: UploadApiOptions["resource_type"];
  type?: UploadApiOptions["type"];
  version?: number | string;
}

export class CloudinaryClient {
  private activeConfig: CloudinaryIntegrationConfig;

  constructor() {
    this.activeConfig = this.applyConfiguration(getCloudinaryConfig());
  }

  async upload(
    source: UploadableSource,
    options: CloudinaryUploadOptions = {},
  ): Promise<UploadApiResponse> {
    const config = this.ensureConfiguration();
    const payload =
      typeof source === "string" ? source : CloudinaryClient.toDataUri(source, options.mimeType);
    const targetFolder = options.folder ?? config.folders.products;

    const uploadOptions: UploadApiOptions = {
      folder: targetFolder,
      upload_preset: options.preset ?? this.resolvePreset(targetFolder),
      resource_type: options.resourceType ?? "image",
      eager: options.eager ?? config.eagerTransformations,
      tags: options.tags,
      context: CloudinaryClient.normaliseContext(options.context),
      metadata: CloudinaryClient.normaliseMetadata(options.metadata),
      transformation: options.transformation,
      filename_override: options.filenameOverride,
      use_filename: options.useFilename ?? Boolean(options.filenameOverride),
      unique_filename: options.uniqueFilename ?? true,
      overwrite: options.overwrite ?? false,
      invalidate: options.invalidate ?? false,
    };

    try {
      return await cloudinary.uploader.upload(payload, uploadOptions);
    } catch (error) {
      throw CloudinaryClient.toIntegrationError("upload", error);
    }
  }

  async deleteAsset(publicId: string, options: CloudinaryDeleteOptions = {}) {
    this.ensureConfiguration();
    try {
      return await cloudinary.uploader.destroy(publicId, {
        resource_type: options.resourceType ?? "image",
        invalidate: options.invalidate ?? false,
      });
    } catch (error) {
      throw CloudinaryClient.toIntegrationError("delete", error);
    }
  }

  generateImageUrl(publicId: string, options: GenerateImageUrlOptions = {}) {
    const config = this.ensureConfiguration();
    const baseTransformation = buildDefaultDeliveryTransformation(config.defaultDelivery);

    const transformation = CloudinaryClient.mergeTransformations(
      baseTransformation,
      options.transformation,
    );

    return cloudinary.url(publicId, {
      secure: options.secure ?? config.credentials.secure,
      resource_type: options.resourceType ?? "image",
      type: options.type ?? "upload",
      transformation,
      version: options.version,
    });
  }

  private static mergeTransformations(
    base: TransformationDefinition,
    override?: TransformationDefinition,
  ) {
    if (!override) {
      return base;
    }

    if (Array.isArray(override)) {
      return override.map((entry) => ({ ...base, ...entry }));
    }

    return { ...base, ...override };
  }

  private static normaliseContext(
    context?: Record<string, unknown>,
  ): Record<string, string> | undefined {
    if (!context) {
      return undefined;
    }

    return Object.fromEntries(
      Object.entries(context).map(([key, value]) => [key, CloudinaryClient.stringifyValue(value)]),
    );
  }

  private static normaliseMetadata(
    metadata?: Record<string, string | number | boolean>,
  ): Record<string, string> | undefined {
    if (!metadata) {
      return undefined;
    }

    return Object.fromEntries(
      Object.entries(metadata).map(([key, value]) => [key, CloudinaryClient.stringifyValue(value)]),
    );
  }

  private static stringifyValue(value: unknown) {
    if (value === null || value === undefined) {
      return "";
    }

    if (typeof value === "string") {
      return value;
    }

    return String(value);
  }

  private static toDataUri(buffer: Buffer, mimeType = "application/octet-stream") {
    const base64 = buffer.toString("base64");
    return `data:${mimeType};base64,${base64}`;
  }

  private resolvePreset(folder?: string) {
    const config = this.activeConfig;
    if (!folder) {
      return config.uploadPresets.products;
    }

    if (folder === config.folders.banners) {
      return config.uploadPresets.banners;
    }

    if (folder === config.folders.avatars) {
      return config.uploadPresets.avatars;
    }

    return config.uploadPresets.products;
  }

  private applyConfiguration(config: CloudinaryIntegrationConfig) {
    cloudinary.config({
      cloud_name: config.credentials.cloudName,
      api_key: config.credentials.apiKey,
      api_secret: config.credentials.apiSecret,
      secure: config.credentials.secure,
    });
    this.activeConfig = config;
    return config;
  }

  private ensureConfiguration() {
    const latestConfig = getCloudinaryConfig();
    if (this.activeConfig !== latestConfig) {
      this.applyConfiguration(latestConfig);
    }

    return this.activeConfig;
  }

  private static toIntegrationError(operation: string, error: unknown): CloudinaryIntegrationError {
    let statusCode: number | undefined;
    let details: UploadApiErrorResponse["error"] | undefined;

    if (isRecord(error)) {
      if ("http_code" in error && typeof error.http_code === "number") {
        statusCode = error.http_code;
      }

      if ("error" in error && isRecord(error.error)) {
        details = error.error as UploadApiErrorResponse["error"];
        if (typeof details.http_code === "number") {
          statusCode = details.http_code;
        }
      }
    }

    const message = details?.message ?? (error instanceof Error ? error.message : undefined);
    return new CloudinaryIntegrationError(
      operation,
      message ?? `Cloudinary ${operation} failed`,
      statusCode,
      details,
      error,
    );
  }
}

let singleton: CloudinaryClient | undefined;

export const getCloudinaryClient = (): CloudinaryClient => {
  if (!singleton) {
    singleton = new CloudinaryClient();
  }

  return singleton;
};
