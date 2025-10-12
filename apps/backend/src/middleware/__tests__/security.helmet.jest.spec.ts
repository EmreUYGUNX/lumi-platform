import type { RequestHandler } from "express";
import type helmet from "helmet";

import type { ApplicationConfig } from "@lumi/types";

import type { DeepPartial } from "../../testing/config.js";

type HeaderOverrides = DeepPartial<ApplicationConfig["security"]["headers"]>;

const passthroughMiddleware: RequestHandler = (_req, _res, next) => next();

interface HelmetHarness {
  helmetFactory: jest.Mock<RequestHandler, [unknown?]>;
}

const importWithHelmetMock = async (overrides: HeaderOverrides): Promise<HelmetHarness> => {
  jest.resetModules();

  const helmetFactory = jest.fn<RequestHandler, [unknown?]>(() => passthroughMiddleware);

  jest.doMock("helmet", () => {
    return Object.assign(helmetFactory, {
      default: helmetFactory,
      referrerPolicy: jest.fn(),
    }) as unknown as typeof helmet;
  });

  const { createTestConfig } = await import("../../testing/config.js");
  const { createSecurityMiddleware } = await import("../security.js");

  const config = createTestConfig({
    security: {
      headers: overrides,
    },
  }).security.headers;

  helmetFactory.mockClear();
  createSecurityMiddleware(config);

  return { helmetFactory };
};

describe("createSecurityMiddleware helmet configuration", () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.dontMock("helmet");
  });

  it("omits CSP configuration when the policy string is blank", async () => {
    const { helmetFactory } = await importWithHelmetMock({
      contentSecurityPolicy: "   ",
    });

    expect(helmetFactory).toHaveBeenCalledWith(
      expect.not.objectContaining({ contentSecurityPolicy: expect.anything() }),
    );
  });

  it("ignores CSP delimiters that resolve to no directives", async () => {
    const { helmetFactory } = await importWithHelmetMock({
      contentSecurityPolicy: " ; ; ",
    });

    expect(helmetFactory).toHaveBeenCalledWith(
      expect.not.objectContaining({ contentSecurityPolicy: expect.anything() }),
    );
  });

  it("filters invalid directives and preserves empty directive values", async () => {
    const { helmetFactory } = await importWithHelmetMock({
      contentSecurityPolicy: "--; frame-ancestors; default-src 'self'",
    });

    expect(helmetFactory).toHaveBeenCalledWith(
      expect.objectContaining({
        contentSecurityPolicy: expect.objectContaining({
          directives: expect.objectContaining({
            frameAncestors: [],
            defaultSrc: ["'self'"],
          }),
        }),
      }),
    );
  });

  it("falls back to a safe referrer policy when configuration is invalid", async () => {
    const { helmetFactory } = await importWithHelmetMock({
      referrerPolicy: "invalid-policy" as HeaderOverrides["referrerPolicy"],
    });

    expect(helmetFactory).toHaveBeenCalledWith(
      expect.objectContaining({
        referrerPolicy: { policy: "no-referrer" },
      }),
    );
  });
});
