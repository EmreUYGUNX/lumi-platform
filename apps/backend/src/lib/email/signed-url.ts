import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { canonicalizeQuery } from "./helpers.js";

export interface CreateSignedUrlOptions {
  baseUrl: string;
  path: string;
  secret: string;
  params?: Record<string, string | number | boolean | undefined | null>;
  expiresAt?: Date;
  nonce?: string;
}

export interface SignedUrlResult {
  url: string;
  signature: string;
  expiresAt?: Date;
  nonce: string;
}

const toCanonicalPayload = (url: URL): string => {
  const canonicalQuery = canonicalizeQuery(url);
  return `${url.pathname}?${canonicalQuery}`;
};

const computeSignature = (payload: string, secret: string): string =>
  createHmac("sha256", secret).update(payload, "utf8").digest("hex");

const generateNonce = () => randomBytes(10).toString("hex");

export const createSignedUrl = (options: CreateSignedUrlOptions): SignedUrlResult => {
  const nonce = options.nonce ?? generateNonce();
  const target = new URL(options.path, options.baseUrl);

  if (options.params) {
    Object.entries(options.params).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        return;
      }

      target.searchParams.set(key, String(value));
    });
  }

  target.searchParams.set("nonce", nonce);

  let expiresAt: Date | undefined;

  if (options.expiresAt) {
    expiresAt = options.expiresAt instanceof Date ? options.expiresAt : new Date(options.expiresAt);
    target.searchParams.set("expires", expiresAt.toISOString());
  }

  const payload = toCanonicalPayload(target);
  const signature = computeSignature(payload, options.secret);
  target.searchParams.set("signature", signature);

  return {
    url: target.toString(),
    signature,
    expiresAt,
    nonce,
  };
};

export interface VerifySignedUrlOptions {
  url: string | URL;
  secret: string;
  now?: Date;
}

export interface VerifySignedUrlResult {
  valid: boolean;
  reason?: "missing_signature" | "invalid_signature" | "expired";
}

export const verifySignedUrl = (options: VerifySignedUrlOptions): VerifySignedUrlResult => {
  const target =
    typeof options.url === "string" ? new URL(options.url) : new URL(options.url.toString());
  const providedSignature = target.searchParams.get("signature");

  if (!providedSignature) {
    return { valid: false, reason: "missing_signature" };
  }

  target.searchParams.delete("signature");

  const expiresIso = target.searchParams.get("expires");
  if (expiresIso) {
    const expiry = new Date(expiresIso);
    const now = options.now ?? new Date();
    if (Number.isNaN(expiry.getTime()) || expiry.getTime() < now.getTime()) {
      return { valid: false, reason: "expired" };
    }
  }

  const payload = toCanonicalPayload(target);
  const expectedSignature = computeSignature(payload, options.secret);

  const expectedBuffer = Buffer.from(expectedSignature, "hex");
  const providedBuffer = Buffer.from(providedSignature, "hex");

  if (expectedBuffer.length !== providedBuffer.length) {
    return { valid: false, reason: "invalid_signature" };
  }

  if (!timingSafeEqual(expectedBuffer, providedBuffer)) {
    return { valid: false, reason: "invalid_signature" };
  }

  return { valid: true };
};
