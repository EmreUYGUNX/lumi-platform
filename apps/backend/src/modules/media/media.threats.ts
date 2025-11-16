import { createHash, randomUUID } from "node:crypto";
import { promises as fsPromises } from "node:fs";
import path from "node:path";

import { createChildLogger } from "@/lib/logger.js";
import {
  type SecurityEventService,
  createSecurityEventService,
} from "@/modules/auth/security-event.service.js";

import { sanitizeFilename } from "./media.security.js";
import type { PreparedUploadFile, UploadContext } from "./media.service.js";

const DEFAULT_QUARANTINE_DIR = path.resolve(process.cwd(), "reports", "media-quarantine");
const SECURITY_EVENT_TYPE = "media_upload_malware_detected";

export interface MediaThreatServiceOptions {
  quarantineDir?: string;
  securityEvents?: SecurityEventService;
  logger?: ReturnType<typeof createChildLogger>;
  fileSystem?: Pick<typeof fsPromises, "mkdir" | "writeFile">;
}

export interface QuarantineResult {
  storedAt: string;
  metadataPath?: string;
}

export class MediaThreatService {
  private readonly quarantineDir: string;

  private readonly securityEvents: SecurityEventService;

  private readonly logger: ReturnType<typeof createChildLogger>;

  private readonly fileSystem: Pick<typeof fsPromises, "mkdir" | "writeFile">;

  constructor(options: MediaThreatServiceOptions = {}) {
    this.quarantineDir = options.quarantineDir ?? DEFAULT_QUARANTINE_DIR;
    this.securityEvents = options.securityEvents ?? createSecurityEventService();
    this.logger = options.logger ?? createChildLogger("media:threats");
    this.fileSystem = options.fileSystem ?? fsPromises;
  }

  async quarantineUpload(
    file: PreparedUploadFile,
    context: UploadContext,
    reason: string,
    details?: Record<string, unknown>,
  ): Promise<QuarantineResult | undefined> {
    try {
      await this.fileSystem.mkdir(this.quarantineDir, { recursive: true });
    } catch (error) {
      this.logger.error("Failed to prepare quarantine directory", {
        error,
        directory: this.quarantineDir,
      });
      return undefined;
    }

    const timestamp = new Date().toISOString().replaceAll(/[:.]/gu, "-");
    const safeFilename = sanitizeFilename(file.originalName || "upload");
    const uniqueName = `${timestamp}-${randomUUID()}-${safeFilename}`;
    const targetPath = path.join(this.quarantineDir, uniqueName);

    try {
      await this.fileSystem.writeFile(targetPath, file.buffer);
    } catch (error) {
      this.logger.error("Failed to write quarantined upload", {
        error,
        targetPath,
      });
      return undefined;
    }

    const metadata = {
      originalName: file.originalName,
      size: file.size,
      mimeType: file.mimeType,
      detectedAt: new Date().toISOString(),
      uploadedById: context.uploadedById,
      folder: context.folder,
      tags: context.tags,
      visibility: context.visibility,
      reason,
      hash: createHash("sha256").update(file.buffer).digest("hex"),
      storedAt: targetPath,
      details,
    } satisfies Record<string, unknown>;

    const metadataPath = `${targetPath}.json`;
    try {
      await this.fileSystem.writeFile(metadataPath, JSON.stringify(metadata, undefined, 2));
    } catch (error) {
      this.logger.warn("Failed to persist quarantine metadata", {
        error,
        metadataPath,
      });
    }

    await this.logSecurityEvent(metadata, context);

    this.logger.warn("Media upload quarantined", {
      storedAt: targetPath,
      uploadedById: context.uploadedById,
      visibility: context.visibility,
      folder: context.folder,
    });

    return {
      storedAt: targetPath,
      metadataPath,
    };
  }

  private async logSecurityEvent(
    metadata: Record<string, unknown>,
    context: UploadContext,
  ): Promise<void> {
    try {
      await this.securityEvents.log({
        type: SECURITY_EVENT_TYPE,
        userId: context.uploadedById,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        severity: "critical",
        payload: metadata,
      });
    } catch (error) {
      this.logger.error("Failed to record security event for quarantined upload", {
        error,
      });
    }
  }
}
