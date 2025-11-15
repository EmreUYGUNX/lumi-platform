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
  } as unknown as MediaService;

  return new MediaController({
    service,
    config,
  });
};

describe("media.router", () => {
  it("registers upload and signature routes with provided registrar", () => {
    const registerRoute = jest.fn();
    const router = createMediaRouter(config, {
      registerRoute,
      controller: buildController(),
    });

    expect(registerRoute).toHaveBeenCalledWith("POST", "/media/upload");
    expect(registerRoute).toHaveBeenCalledWith("POST", "/media/signature");

    const paths = router.stack
      .map((layer) => layer.route?.path)
      .filter((path): path is string => typeof path === "string");

    expect(paths).toContain("/media/upload");
    expect(paths).toContain("/media/signature");
  });
});
