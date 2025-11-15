import { describe, expect, it } from "@jest/globals";

import { createTestConfig } from "../../../testing/config.js";
import {
  IMAGE_MIME_WHITELIST,
  createMediaSignatureSchema,
  createMediaUploadSchema,
} from "../media.validators.js";

const config = createTestConfig();
const allowedFolders = Object.values(config.media.cloudinary.folders);

describe("media.validators", () => {
  const uploadSchema = createMediaUploadSchema({
    allowedFolders,
    defaultFolder: config.media.cloudinary.folders.products,
  });

  const signatureSchema = createMediaSignatureSchema({
    allowedFolders,
    defaultFolder: config.media.cloudinary.folders.products,
  });

  it("normalises folders, tags, and metadata for uploads", () => {
    const data = uploadSchema.parse({
      folder: `/${config.media.cloudinary.folders.banners}/`,
      tags: " product:123 , primary ",
      metadata: '{"quality":"high"}',
      visibility: "private",
    });

    expect(data.folder).toBe(config.media.cloudinary.folders.banners);
    expect(data.tags).toEqual(["product:123", "primary"]);
    expect(data.metadata).toEqual({ quality: "high" });
  });

  it("rejects uploads to disallowed folders", () => {
    expect(() =>
      uploadSchema.parse({
        folder: "unauthorised",
      }),
    ).toThrow(/Folder is not allowed/);
  });

  it("coerces metadata objects and handles invalid JSON payloads", () => {
    const parsed = uploadSchema.parse({
      metadata: { rating: 5 },
    });
    expect(parsed.metadata).toEqual({ rating: "5" });

    expect(() =>
      uploadSchema.parse({
        metadata: "{not json}",
      }),
    ).toThrow(/Metadata must be valid JSON/);
  });

  it("validates signature payloads and default folder", () => {
    const result = signatureSchema.parse({
      tags: ["Injected Tag", "another"],
      eager: [{ width: 300, crop: "fill" }],
    });

    expect(result.folder).toBe(config.media.cloudinary.folders.products);
    expect(result.tags).toEqual(["injected-tag", "another"]);
    expect(result.eager?.[0]).toEqual({ width: 300, crop: "fill" });
  });

  it("confirms MIME whitelist contains expected formats", () => {
    expect(IMAGE_MIME_WHITELIST.get("image/png")).toEqual({ extension: "png" });
    expect(IMAGE_MIME_WHITELIST.has("image/webp")).toBe(true);
  });
});
