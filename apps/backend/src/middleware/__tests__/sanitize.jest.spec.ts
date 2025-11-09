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

  it("strips HTML, normalises URLs, and mitigates injection attempts", () => {
    const config = createTestConfig().security.validation;
    const middlewares = createSanitizationMiddleware(config);
    const payloadSanitize = middlewares[2];
    if (!payloadSanitize) {
      throw new Error("Sanitization middleware initialisation failed");
    }

    const request = {
      body: {
        description: "<strong>Welcome</strong><script>alert('owned')</script> to Lumi ",
        mediaUrl: "https://example.com/path?utm_source=<script>",
        nested: {
          contentSummary: "<p>safe</p>",
        },
      },
      query: {
        search: "'; DROP TABLE users; -- price<0",
      },
      params: {
        redirectUrl: "ftp://malicious.test/path",
      },
    } as unknown as Request;

    const response = {} as Response;
    const next: NextFunction = jest.fn();

    payloadSanitize(request, response, next);

    expect(request.body.description).toBe("Welcome to Lumi");
    expect(request.body.mediaUrl).toBe("https://example.com/path?utm_source=%3Cscript%3E");
    expect(request.body.nested.contentSummary).toBe("safe");
    expect(request.query.search).toBe("DROP TABLE users price 0");
    expect(request.params.redirectUrl).toBe("");
    expect(next).toHaveBeenCalledTimes(1);
  });
});
