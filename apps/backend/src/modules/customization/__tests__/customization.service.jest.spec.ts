import { describe, expect, it, jest } from "@jest/globals";
import type { PrismaClient } from "@prisma/client";

import { ValidationError } from "@/lib/errors.js";

import { CustomizationService } from "../customization.service.js";
import {
  areAreasOverlapping,
  getDesignAreaBounds,
  isPointInDesignArea,
} from "../design-area.helpers.js";

const buildArea = (overrides: Partial<Parameters<typeof getDesignAreaBounds>[0]> = {}) => ({
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
  ...overrides,
});

describe("design area helpers", () => {
  it("computes bounds from area coordinates", () => {
    const bounds = getDesignAreaBounds(buildArea({ x: 10, y: 20, width: 50, height: 60 }));
    expect(bounds).toEqual({ left: 10, top: 20, right: 60, bottom: 80 });
  });

  it("detects overlap between two areas", () => {
    const a = buildArea({ name: "front", x: 0, y: 0, width: 100, height: 100 });
    const b = buildArea({ name: "back", x: 80, y: 80, width: 100, height: 100 });
    const c = buildArea({ name: "sleeve", x: 200, y: 200, width: 50, height: 50 });

    expect(areAreasOverlapping(a, b)).toBe(true);
    expect(areAreasOverlapping(a, c)).toBe(false);
  });

  it("checks whether a point is inside an area", () => {
    const area = buildArea({ x: 10, y: 10, width: 100, height: 100 });

    expect(isPointInDesignArea(15, 15, area)).toBe(true);
    expect(isPointInDesignArea(5, 5, area)).toBe(false);
  });
});

describe("CustomizationService.validateDesignAreaCoordinates", () => {
  it("accepts non-overlapping areas without bounds validation", async () => {
    const repoStub = {} as never;
    const service = new CustomizationService({ repository: repoStub });

    const areas = [
      buildArea({ name: "front", x: 0, y: 0, width: 100, height: 100 }),
      buildArea({ name: "back", x: 150, y: 0, width: 100, height: 100 }),
    ];

    await expect(service.validateDesignAreaCoordinates(areas)).resolves.toBeUndefined();
  });

  it("throws when areas overlap", async () => {
    const repoStub = {} as never;
    const service = new CustomizationService({ repository: repoStub });

    const areas = [
      buildArea({ name: "front", x: 0, y: 0, width: 120, height: 120 }),
      buildArea({ name: "back", x: 80, y: 80, width: 120, height: 120 }),
    ];

    await expect(service.validateDesignAreaCoordinates(areas)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("throws when areas exceed product image bounds", async () => {
    const repoStub = {} as never;
    const prismaStub = {
      product: {
        findFirst: jest.fn(async () => ({
          id: "ckl7apwqq0000u1sdf9x0w3w4",
          productMedia: [
            {
              media: { width: 500, height: 500 },
            },
          ],
        })) as unknown as PrismaClient["product"]["findFirst"],
      },
    };
    const service = new CustomizationService({
      repository: repoStub,
      prisma: prismaStub as unknown as PrismaClient,
    });

    const areas = [buildArea({ name: "front", x: 460, y: 0, width: 100, height: 100 })];

    await expect(
      service.validateDesignAreaCoordinates(areas, "ckl7apwqq0000u1sdf9x0w3w4"),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
