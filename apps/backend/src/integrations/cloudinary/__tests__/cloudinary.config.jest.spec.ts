import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import type { ApplicationConfig } from "@lumi/types";

import { type DeepPartial, createTestConfig, deepMerge } from "../../../testing/config.js";
import { getCloudinaryConfig } from "../cloudinary.config.js";

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

interface ConfigModuleMock {
  dispatchConfigChange: (overrides?: DeepPartial<ApplicationConfig>) => void;
  resetMockConfig: () => void;
}

const configModule = jest.requireMock("../../../config/index.js") as ConfigModuleMock;

describe("cloudinary.config", () => {
  beforeEach(() => {
    configModule.resetMockConfig();
    jest.clearAllMocks();
  });

  it("exposes the runtime Cloudinary configuration with eager transformations", () => {
    const config = getCloudinaryConfig();

    expect(config.credentials.cloudName).toBe("lumi-test");
    expect(config.uploadPresets.products).toBe("lumi_products");

    expect(config.eagerTransformations).toHaveLength(3);
    expect(config.eagerTransformations[0]).toEqual(
      expect.objectContaining({
        width: 300,
        height: 300,
        crop: "fill",
        quality: config.defaultDelivery.quality,
        format: config.defaultDelivery.format,
      }),
    );
  });

  it("refreshes the cached config when an application config change event fires", () => {
    const original = getCloudinaryConfig();
    expect(original.defaultDelivery.quality).toBe("auto:good");

    configModule.dispatchConfigChange({
      media: {
        cloudinary: {
          defaultDelivery: {
            quality: "auto:eco",
            format: "auto",
          },
          uploadPresets: {
            products: "custom_products",
          },
        },
      },
    });

    const next = getCloudinaryConfig();
    expect(next.defaultDelivery.quality).toBe("auto:eco");
    expect(next.uploadPresets.products).toBe("custom_products");
    expect(next.eagerTransformations[0]).toEqual(expect.objectContaining({ quality: "auto:eco" }));
  });
});
