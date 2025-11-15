import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { type UploadApiOptions, type UploadApiResponse, v2 as cloudinaryV2 } from "cloudinary";

import type { ApplicationConfig } from "@lumi/types";

import { type DeepPartial, createTestConfig, deepMerge } from "../../../testing/config.js";
import { CloudinaryClient, getCloudinaryClient } from "../cloudinary.client.js";
import { CloudinaryIntegrationError } from "../cloudinary.errors.js";

jest.mock("../../../config/index.js", () => {
  const changeHandlers = new Set<
    (change: { snapshot: ApplicationConfig; previous?: ApplicationConfig }) => void
  >();
  let activeConfig = createTestConfig();

  const notify = (previous?: ApplicationConfig) => {
    const change = {
      snapshot: activeConfig,
      previous,
      changedKeys: [],
    };
    changeHandlers.forEach((handler) => handler(change));
  };

  return {
    getConfig: jest.fn(() => activeConfig),
    onConfigChange: jest.fn((handler: (change: { snapshot: ApplicationConfig }) => void) => {
      changeHandlers.add(handler);
      return () => changeHandlers.delete(handler);
    }),
    dispatchConfigChange: (overrides?: DeepPartial<ApplicationConfig>) => {
      const previous = activeConfig;
      activeConfig = overrides ? deepMerge(activeConfig, overrides) : activeConfig;
      notify(previous);
    },
    resetMockConfig: () => {
      const previous = activeConfig;
      activeConfig = createTestConfig();
      notify(previous);
    },
  };
});

jest.mock("cloudinary", () => {
  const upload = jest.fn();
  const destroy = jest.fn();
  const url = jest.fn(() => "https://res.cloudinary.com/lumi-test/image/upload/sample");
  const config = jest.fn();
  const apiSignRequest = jest.fn(() => "mock-signature");

  return {
    v2: {
      uploader: {
        upload,
        destroy,
      },
      url,
      config,
      utils: {
        api_sign_request: apiSignRequest,
      },
    },
    utils: {
      api_sign_request: apiSignRequest,
    },
  };
});

const uploadMock = jest.mocked(cloudinaryV2.uploader.upload);
const destroyMock = jest.mocked(cloudinaryV2.uploader.destroy);
const urlMock = jest.mocked(cloudinaryV2.url);
const signMock = jest.mocked(cloudinaryV2.utils.api_sign_request);
const configMock = jest.mocked(cloudinaryV2.config);

interface ConfigModuleMock {
  dispatchConfigChange: (overrides?: DeepPartial<ApplicationConfig>) => void;
  resetMockConfig: () => void;
}

const configModule = jest.requireMock("../../../config/index.js") as ConfigModuleMock;

describe("CloudinaryClient", () => {
  beforeEach(() => {
    configModule.resetMockConfig();
    jest.clearAllMocks();
    type DestroyResult = Awaited<ReturnType<typeof cloudinaryV2.uploader.destroy>>;
    uploadMock.mockResolvedValue({ public_id: "lumi/products/demo" } as UploadApiResponse);
    destroyMock.mockResolvedValue({ result: "ok" } as DestroyResult);
  });

  it("uploads buffers using secure defaults", async () => {
    const client = new CloudinaryClient();
    const buffer = Buffer.from("sample-image");

    await client.upload(buffer, { mimeType: "image/png", tags: ["product:123"] });

    expect(uploadMock).toHaveBeenCalledTimes(1);
    const firstCall = uploadMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    const payload = firstCall?.[0];
    const options = firstCall?.[1] as UploadApiOptions;
    expect(typeof payload).toBe("string");
    expect(payload as string).toMatch(/^data:image\/png;base64,/);
    expect(options).toMatchObject({
      folder: "lumi/products",
      upload_preset: "lumi_products",
      resource_type: "image",
      eager: expect.any(Array),
      tags: ["product:123"],
    });
  });

  it("uses folder-specific presets when overriding the target folder", async () => {
    const client = new CloudinaryClient();
    const buffer = Buffer.from("banner-image");

    await client.upload(buffer, { folder: "lumi/banners" });

    const firstCall = uploadMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    const options = firstCall?.[1] as UploadApiOptions;
    expect(options.folder).toBe("lumi/banners");
    expect(options.upload_preset).toBe("lumi_banners");
  });

  it("applies avatar preset and stringifies context/metadata values", async () => {
    const client = new CloudinaryClient();
    const buffer = Buffer.from("avatar");

    await client.upload(buffer, {
      folder: "lumi/avatars",
      // eslint-disable-next-line unicorn/no-null -- ensures null values are stringified
      context: { productId: 42, optional: null },
      metadata: { zoom: 1, label: "Primary", enabled: true },
    });

    const firstCall = uploadMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    const options = firstCall?.[1] as UploadApiOptions;
    expect(options.folder).toBe("lumi/avatars");
    expect(options.upload_preset).toBe("lumi_avatars");
    expect(options.context).toEqual({ productId: "42", optional: "" });
    expect(options.metadata).toEqual({ zoom: "1", label: "Primary", enabled: "true" });
  });

  it("deletes assets using the Cloudinary destroy API", async () => {
    const client = new CloudinaryClient();

    await client.deleteAsset("lumi/products/demo", { invalidate: true, resourceType: "video" });

    expect(destroyMock).toHaveBeenCalledWith("lumi/products/demo", {
      resource_type: "video",
      invalidate: true,
    });
  });

  it("generates image URLs with the default delivery transformation merged with overrides", () => {
    const client = new CloudinaryClient();

    const url = client.generateImageUrl("lumi/products/demo", {
      transformation: [{ width: 640, crop: "fill" }],
      secure: true,
    });

    expect(url).toBe("https://res.cloudinary.com/lumi-test/image/upload/sample");
    expect(urlMock).toHaveBeenCalledWith(
      "lumi/products/demo",
      expect.objectContaining({
        secure: true,
        transformation: [
          expect.objectContaining({
            width: 640,
            crop: "fill",
            quality: "auto:good",
            fetch_format: "auto",
            format: "auto",
            dpr: "auto",
          }),
        ],
      }),
    );
  });

  it("generates upload signatures with folder overrides and metadata", () => {
    const client = new CloudinaryClient();

    const result = client.generateUploadSignature({
      folder: "lumi/banners",
      tags: ["product:123", "primary"],
    });

    expect(result.folder).toBe("lumi/banners");
    expect(result.apiKey).toBe("cloudinary-api-key");
    expect(result.cloudName).toBe("lumi-test");
    expect(result.signature).toBe("mock-signature");
    expect(result.params).toMatchObject({
      folder: "lumi/banners",
      tags: "product:123,primary",
    });
    expect(signMock).toHaveBeenCalledWith(
      expect.objectContaining({
        folder: "lumi/banners",
        tags: "product:123,primary",
      }),
      "cloudinary-api-secret",
    );
    expect(result.expiresAt).toBeTruthy();
  });

  it("re-applies SDK configuration when the application config changes", () => {
    const client = new CloudinaryClient();
    expect(configMock).toHaveBeenCalledWith(
      expect.objectContaining({ cloud_name: "lumi-test", secure: true }),
    );
    configMock.mockClear();

    configModule.dispatchConfigChange({
      media: {
        cloudinary: {
          credentials: {
            cloudName: "lumi-prod",
            apiKey: "prod-key",
            apiSecret: "prod-secret",
            secure: false,
          },
        },
      },
    });

    client.generateImageUrl("lumi/products/demo");
    expect(configMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cloud_name: "lumi-prod",
        api_key: "prod-key",
        api_secret: "prod-secret",
        secure: false,
      }),
    );
  });

  it("provides a memoized singleton via getCloudinaryClient", () => {
    const instanceA = getCloudinaryClient();
    const instanceB = getCloudinaryClient();

    expect(instanceA).toBe(instanceB);
  });

  it("wraps upload errors with CloudinaryIntegrationError and preserves metadata", async () => {
    const client = new CloudinaryClient();
    const failure = {
      http_code: 503,
      error: { message: "Service unavailable", http_code: 503 },
    };
    uploadMock.mockRejectedValueOnce(failure);

    await expect(client.upload(Buffer.from("fail"))).rejects.toMatchObject({
      operation: "upload",
      statusCode: 503,
      details: failure.error,
    });
  });

  it("wraps delete errors even when Cloudinary returns a plain Error", async () => {
    const client = new CloudinaryClient();
    const plainError = new Error("network down");
    destroyMock.mockRejectedValueOnce(plainError);

    await expect(client.deleteAsset("123")).rejects.toBeInstanceOf(CloudinaryIntegrationError);
  });
});
