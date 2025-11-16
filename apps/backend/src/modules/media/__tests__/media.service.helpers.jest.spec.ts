import { describe, expect, it, jest } from "@jest/globals";
import type { UploadApiResponse } from "cloudinary";

import { ApiError } from "@/errors/api-error.js";
import type { CloudinaryClient } from "@/integrations/cloudinary/cloudinary.client.js";
import { createTestConfig } from "@/testing/config.js";

import { mediaServiceInternals } from "../media.service.js";

const config = createTestConfig();

const createUploadResponse = (overrides: Partial<UploadApiResponse> = {}): UploadApiResponse =>
  ({
    public_id: "lumi/products/demo",
    secure_url: "https://cdn.example.com/demo.png",
    url: "http://cdn.example.com/demo.png",
    eager: [{ secure_url: "https://cdn.example.com/demo-thumb.png" }],
    resource_type: "image",
    type: "upload",
    tags: ["primary"],
    width: 800,
    height: 600,
    version: 1,
    bytes: 1024,
    signature: "signature",
    format: "png",
    created_at: new Date().toISOString(),
    etag: "etag",
    placeholder: false,
    access_mode: "public",
    moderation: [],
    original_filename: "demo",
    ...overrides,
  }) as UploadApiResponse;

describe("media.service internals", () => {
  it("splits payloads into chunks", () => {
    expect(mediaServiceInternals.chunk([], 2)).toEqual([]);
    expect(mediaServiceInternals.chunk([1, 2, 3, 4], 3)).toEqual([[1, 2, 3], [4]]);
  });

  it("deduplicates tags and resolves MIME extensions", () => {
    expect(mediaServiceInternals.normaliseTags(["hero", "hero", "primary"])).toEqual([
      "hero",
      "primary",
    ]);
    expect(mediaServiceInternals.resolveMimeExtension("image/png")).toBe("png");
    expect(mediaServiceInternals.resolveMimeExtension("application/json")).toBeUndefined();
  });

  it("builds transformation maps including responsive breakpoints", () => {
    const client = {
      generateImageUrl: jest.fn().mockReturnValue("https://cdn.example.com/responsive.png"),
    } as unknown as CloudinaryClient;
    const uploadResult = {
      ...createUploadResponse(),
      eager: [
        { secure_url: "https://cdn.example.com/demo-thumb.png" },
        { secure_url: "https://cdn.example.com/demo-medium.png" },
      ],
    } as UploadApiResponse;

    const transformations = mediaServiceInternals.buildTransformationMap(
      uploadResult,
      client,
      config,
    );
    expect(transformations.original).toBe("https://cdn.example.com/demo.png");
    expect(transformations.thumbnail).toBe("https://cdn.example.com/demo-thumb.png");
    expect(transformations.responsive_320).toBe("https://cdn.example.com/responsive.png");
  });

  it("extracts dominant colours and calculates aspect ratios", () => {
    expect(
      mediaServiceInternals.extractDominantColor(
        createUploadResponse({
          colors: [["#ffffff", 0]] as [string, number][],
        }),
      ),
    ).toBe("#ffffff");
    expect(
      mediaServiceInternals.extractDominantColor(
        createUploadResponse({
          colors: ["#abcdef"] as unknown as [string, number][],
        }),
      ),
    ).toBe("#abcdef");
    expect(
      mediaServiceInternals.extractDominantColor(
        createUploadResponse({
          colors: [],
        }),
      ),
    ).toBeUndefined();
    expect(mediaServiceInternals.calculateAspectRatio(800, 0)).toBeUndefined();
    expect(mediaServiceInternals.calculateAspectRatio(800, 600)).toBeCloseTo(1.333);
  });

  it("normalises metadata values and builds persistence payloads", () => {
    const metadata = mediaServiceInternals.normaliseMetadataValues({
      variant: "primary",
      priority: 1,
      // eslint-disable-next-line unicorn/no-null -- Metadata sanitization should handle null values.
      nullable: null,
    });
    expect(metadata).toEqual({
      variant: "primary",
      priority: "1",
      nullable: "",
    });

    const persistence = mediaServiceInternals.buildPersistenceMetadata(
      createUploadResponse({
        colors: [["#ff0000", 1]] as [string, number][],
      }),
      {
        metadata,
        visibility: "public",
        tags: ["primary"],
        folder: config.media.cloudinary.folders.products,
        uploadedById: "user_1",
      },
      { originalName: "Demo.PNG" } as never,
      "data:image/png;base64,placeholder",
    );

    expect(persistence).toMatchObject({
      dominantColor: "#ff0000",
      visibility: "public",
      originalFilename: "Demo.PNG",
      blurDataUrl: "data:image/png;base64,placeholder",
    });
  });

  it("enforces supported mime types and file size limits", () => {
    expect(mediaServiceInternals.ensureMimeTypeSupported("png", "image/png")).toBe("png");
    expect(() => mediaServiceInternals.ensureMimeTypeSupported(undefined, "video/mp4")).toThrow(
      ApiError,
    );

    const file = {
      size: 1025,
      originalName: "large.png",
    } as never;
    expect(() => mediaServiceInternals.enforceFileSizeLimit(file, 1000)).toThrow(ApiError);
  });
});
