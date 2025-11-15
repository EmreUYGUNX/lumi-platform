import { describe, expect, it, jest } from "@jest/globals";

import { createTestConfig } from "../../../testing/config.js";
import { MediaController } from "../media.controller.js";
import { createMediaRouter } from "../media.router.js";
import type { MediaService } from "../media.service.js";

const config = createTestConfig();

const buildController = (): MediaController => {
  const service = {
    upload: jest.fn(),
    generateUploadSignature: jest.fn(),
    listAssets: jest.fn(),
    getAsset: jest.fn(),
    updateAsset: jest.fn(),
    regenerateAsset: jest.fn(),
    softDeleteAsset: jest.fn(),
    hardDeleteAsset: jest.fn(),
    getAuditEntity: jest.fn().mockReturnValue("media.assets"),
  } as unknown as MediaService;

  return new MediaController({
    service,
    config,
  });
};

describe("media.router", () => {
  it("registers media routes with provided registrar", () => {
    const registerRoute = jest.fn();
    const router = createMediaRouter(config, {
      registerRoute,
      controller: buildController(),
    });

    expect(registerRoute).toHaveBeenCalledWith("POST", "/media/upload");
    expect(registerRoute).toHaveBeenCalledWith("POST", "/media/signature");
    expect(registerRoute).toHaveBeenCalledWith("GET", "/media");
    expect(registerRoute).toHaveBeenCalledWith("GET", "/media/:id");
    expect(registerRoute).toHaveBeenCalledWith("PUT", "/admin/media/:id");
    expect(registerRoute).toHaveBeenCalledWith("POST", "/admin/media/:id/regenerate");
    expect(registerRoute).toHaveBeenCalledWith("DELETE", "/admin/media/:id");
    expect(registerRoute).toHaveBeenCalledWith("DELETE", "/admin/media/:id/permanent");

    const paths = router.stack
      .map((layer) => layer.route?.path)
      .filter((path): path is string => typeof path === "string");

    expect(paths).toContain("/media/upload");
    expect(paths).toContain("/media/signature");
    expect(paths).toContain("/media");
    expect(paths).toContain("/media/:id");
    expect(paths).toContain("/admin/media/:id");
    expect(paths).toContain("/admin/media/:id/regenerate");
    expect(paths).toContain("/admin/media/:id/permanent");
  });
});
