import type { NextFunction, Request, Response } from "express";

import { logger } from "../../lib/logger.js";
import { createTestConfig } from "../../testing/config.js";
import { createSanitizationMiddleware } from "../sanitize.js";

describe("createSanitizationMiddleware", () => {
  it("returns an empty middleware set when sanitisation is disabled", () => {
    const config = createTestConfig({
      security: {
        validation: {
          sanitize: false,
        },
      },
    }).security.validation;

    expect(createSanitizationMiddleware(config)).toHaveLength(0);
  });

  it("sanitizes payloads and emits a warning for malicious input", () => {
    const config = createTestConfig().security.validation;
    const middlewares = createSanitizationMiddleware(config);
    const mongoSanitize = middlewares[0];
    const xssSanitize = middlewares[1];
    if (!mongoSanitize || !xssSanitize) {
      throw new Error("Sanitization middleware initialisation failed");
    }
    const warnSpy = jest.spyOn(logger, "warn").mockImplementation(() => logger);

    const request = {
      body: {
        $where: "malicious",
        profile: {
          bio: '<img src="x" onerror="alert(1)">',
        },
      },
      query: {
        $gt: "",
      },
      params: {
        userId: "123",
      },
    } as unknown as Request;

    const response = {} as Response;
    const next: NextFunction = jest.fn();

    mongoSanitize(request, response, next);
    xssSanitize(request, response, next);

    expect(request.body.$where).toBeUndefined();
    expect(request.query.$gt).toBeUndefined();
    expect(request.body.profile.bio).not.toContain("<img");
    expect(next).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenCalledWith(
      "Detected and sanitized potentially malicious payload",
      expect.objectContaining({ key: "body" }),
    );
    warnSpy.mockRestore();
  });
});
