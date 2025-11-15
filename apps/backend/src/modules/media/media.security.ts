import { randomUUID } from "node:crypto";

import { ApiError } from "@/errors/api-error.js";

const DEFAULT_MAX_FILENAME_LENGTH = 96;
const FALLBACK_BASENAME = "media-asset";
const SAFE_FILENAME_REGEX = /[^a-z0-9._-]+/giu;
const COLLAPSE_SEPARATOR_REGEX = /[-_.]{2,}/gu;
const TRAILING_SEPARATORS = /^[-_.]+|[-_.]+$/gu;

const EICAR_SIGNATURE = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

export interface MediaSanitizerOptions {
  maxLength?: number;
}

const normaliseExtension = (extension?: string): string | undefined => {
  if (!extension) {
    return undefined;
  }

  const clean = extension.replace(/^\.+/u, "").trim().toLowerCase();
  return clean || undefined;
};

export const sanitizeFilename = (
  originalName: string,
  extension?: string,
  options: MediaSanitizerOptions = {},
): string => {
  const maxLength = options.maxLength ?? DEFAULT_MAX_FILENAME_LENGTH;
  const lower = originalName?.toLowerCase() ?? "";
  const basename = lower
    .replaceAll(SAFE_FILENAME_REGEX, "-")
    .replaceAll(COLLAPSE_SEPARATOR_REGEX, "-")
    .replaceAll(TRAILING_SEPARATORS, "")
    .slice(0, maxLength);

  const resolvedBase = basename || FALLBACK_BASENAME;
  const resolvedExtension = normaliseExtension(extension);

  if (!resolvedExtension) {
    return resolvedBase;
  }

  const suffix = `.${resolvedExtension}`;
  const withoutExt = resolvedBase.endsWith(suffix)
    ? resolvedBase.slice(0, -suffix.length)
    : resolvedBase;
  return `${withoutExt}.${resolvedExtension}`;
};

const createMalwareDetectedError = (filename: string): ApiError =>
  new ApiError("Potential malware detected in upload.", {
    status: 422,
    code: "MALWARE_DETECTED",
    details: [
      {
        message: `Upload ${filename} flagged by antivirus scanner.`,
      },
    ],
  });

export interface MediaScanOptions {
  enabled?: boolean;
}

export interface MediaScanPayload {
  buffer: Buffer;
  filename: string;
}

export class MediaScanService {
  private readonly enabled: boolean;

  constructor(options: MediaScanOptions = {}) {
    this.enabled = options.enabled ?? true;
  }

  async scan(payload: MediaScanPayload): Promise<void> {
    if (!this.enabled) {
      return;
    }

    if (MediaScanService.containsEicarSignature(payload.buffer)) {
      throw createMalwareDetectedError(payload.filename);
    }
  }

  static containsEicarSignature(buffer: Buffer): boolean {
    if (buffer.length === 0) {
      return false;
    }

    const ascii = buffer.toString("ascii");
    return ascii.includes(EICAR_SIGNATURE);
  }

  static generateDeterministicName(seed: string): string {
    const trimmed = seed.trim();
    if (!trimmed) {
      return `${FALLBACK_BASENAME}-${randomUUID()}`;
    }

    return sanitizeFilename(trimmed);
  }
}
