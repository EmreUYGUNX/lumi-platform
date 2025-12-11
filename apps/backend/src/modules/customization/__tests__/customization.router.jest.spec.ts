/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { describe, expect, it, jest } from "@jest/globals";
import request from "supertest";

import { withTestApp } from "@/testing/index.js";

import type { CustomizationService } from "../customization.service.js";

const buildConfig = () => ({
  enabled: true,
  designAreas: [
    {
      name: "front",
      x: 0,
      y: 0,
      width: 200,
      height: 200,
      rotation: 0,
      minDesignSize: 40,
      maxDesignSize: 180,
      allowResize: true,
      allowRotation: true,
    },
  ],
  maxLayers: 10,
  allowImages: true,
  allowText: true,
  allowShapes: false,
  allowDrawing: false,
  allowedFonts: [],
  basePriceModifier: 0,
  pricePerLayer: 0,
});

const createServiceStub = () => {
  const config = buildConfig();
  return {
    config,
    stub: {
      getProductCustomization: jest.fn().mockResolvedValue(config),
      enableCustomization: jest.fn(),
      updateCustomization: jest.fn(),
      updateDesignAreas: jest.fn(),
      disableCustomization: jest.fn(),
      validateDesignAreaCoordinates: jest.fn(),
    },
  };
};

const appOptionsWithService = (service: CustomizationService) => ({
  apiOptions: {
    customizationOptions: { service },
  },
  configOverrides: {
    cache: {
      redisUrl: "",
    },
  },
});

describe("customization router", () => {
  it("returns customization config for enabled products", async () => {
    const { stub, config } = createServiceStub();

    await withTestApp(
      async ({ app }) => {
        const productId = "ckl7apwqq0000u1sdf9x0w3w4";
        const response = await request(app)
          .get(`/api/v1/products/${productId}/customization`)
          .expect(200);

        expect(stub.getProductCustomization).toHaveBeenCalledWith(productId);
        expect(response.body.success).toBe(true);
        expect(response.body.data.designAreas[0].name).toBe(config.designAreas[0].name);
      },
      appOptionsWithService(stub as unknown as CustomizationService),
    );
  });
});
