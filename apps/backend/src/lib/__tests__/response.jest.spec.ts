// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from "@jest/globals";

import { AppError, ERROR_CODES, ValidationError } from "../errors.js";
import {
  type PaginationMeta,
  errorResponse,
  paginatedResponse,
  successResponse,
} from "../response.js";

describe("successResponse", () => {
  it("returns the standard success envelope without meta", () => {
    const payload = successResponse({ id: "user-1" });

    expect(payload).toEqual({
      success: true,
      data: { id: "user-1" },
    });
    expect(Reflect.has(payload, "meta")).toBe(false);
  });

  it("merges meta payload when provided", () => {
    const payload = successResponse(
      { id: "user-2" },
      {
        requestId: "req-1",
        correlationId: "corr-1",
      },
    );

    expect(payload).toEqual({
      success: true,
      data: { id: "user-2" },
      meta: {
        requestId: "req-1",
        correlationId: "corr-1",
      },
    });
  });
});

describe("errorResponse", () => {
  it("builds an error response from primitive input", () => {
    const payload = errorResponse({
      code: "FORBIDDEN",
      message: "You are not allowed to access this resource.",
      details: { action: "delete-user" },
    });

    expect(payload).toEqual({
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "You are not allowed to access this resource.",
        details: { action: "delete-user" },
      },
    });
  });

  it("omits details when the AppError is not exposable", () => {
    const error = new AppError("Critical failure", 500, {
      code: ERROR_CODES.INTERNAL,
      details: { traceId: "abc" },
      exposeDetails: false,
    });

    const payload = errorResponse(error);

    expect(payload).toEqual({
      success: false,
      error: {
        code: ERROR_CODES.INTERNAL,
        message: "Critical failure",
      },
    });
  });

  it("includes details for validation errors that allow exposure", () => {
    const error = new ValidationError("Invalid payload", {
      issues: [
        {
          path: "email",
          message: "Email is invalid.",
          code: "INVALID_EMAIL",
        },
      ],
    });

    const payload = errorResponse(error);

    expect(payload.error.code).toBe(ERROR_CODES.VALIDATION);
    expect(payload.error.details).toEqual({
      issues: [
        {
          path: "email",
          message: "Email is invalid.",
          code: "INVALID_EMAIL",
        },
      ],
    });
  });

  it("attaches optional metadata when provided", () => {
    const payload = errorResponse(
      {
        code: "RATE_LIMITED",
        message: "Too many attempts detected.",
      },
      {
        retryAfterSeconds: 60,
      },
    );

    expect(payload.meta).toEqual({ retryAfterSeconds: 60 });
  });
});

describe("paginatedResponse", () => {
  it("computes pagination metadata automatically", () => {
    const payload = paginatedResponse([{ id: "product-1" }], {
      totalItems: 25,
      page: 1,
      pageSize: 10,
    });

    const expectedMeta: PaginationMeta = {
      totalItems: 25,
      totalPages: 3,
      page: 1,
      pageSize: 10,
      hasNextPage: true,
      hasPreviousPage: false,
    };

    expect(payload.success).toBe(true);
    expect(payload.meta?.pagination).toEqual(expectedMeta);
  });

  it("merges custom meta data alongside pagination", () => {
    const payload = paginatedResponse([{ id: "order-1" }], {
      totalItems: 5,
      page: 2,
      pageSize: 2,
      meta: {
        filters: {
          status: "completed",
        },
      },
    });

    expect(payload.meta).toEqual({
      pagination: {
        totalItems: 5,
        totalPages: 3,
        page: 2,
        pageSize: 2,
        hasNextPage: true,
        hasPreviousPage: true,
      },
      filters: {
        status: "completed",
      },
    });
  });

  it("rejects inconsistent pagination metadata", () => {
    expect(() =>
      paginatedResponse([], {
        totalItems: 10,
        page: 1,
        pageSize: 5,
        totalPages: 1,
      }),
    ).toThrow(RangeError);
  });

  it("guards against invalid numeric inputs", () => {
    expect(() =>
      paginatedResponse([], {
        totalItems: -1,
        page: 1,
        pageSize: 20,
      }),
    ).toThrow(RangeError);

    expect(() =>
      paginatedResponse([], {
        totalItems: 0,
        page: 0,
        pageSize: 10,
      }),
    ).toThrow(RangeError);

    expect(() =>
      paginatedResponse([], {
        totalItems: 0,
        page: 1,
        pageSize: 0,
      }),
    ).toThrow(RangeError);
  });

  it("requires integer inputs for pagination parameters", () => {
    expect(() =>
      paginatedResponse([], {
        totalItems: 1.5,
        page: 1,
        pageSize: 10,
      }),
    ).toThrow(TypeError);

    expect(() =>
      paginatedResponse([], {
        totalItems: 10,
        page: 1,
        pageSize: 5.5,
      }),
    ).toThrow(TypeError);
  });

  it("rejects inconsistent totalPages values including negative inputs", () => {
    expect(() =>
      paginatedResponse([], {
        totalItems: 0,
        page: 1,
        pageSize: 10,
        totalPages: -1,
      }),
    ).toThrow(RangeError);
  });

  it("prevents requesting pages beyond the computed total", () => {
    expect(() =>
      paginatedResponse([], {
        totalItems: 2,
        page: 3,
        pageSize: 1,
      }),
    ).toThrow(RangeError);
  });

  it("handles datasets without pages by disabling navigation flags", () => {
    const payload = paginatedResponse([], {
      totalItems: 0,
      page: 1,
      pageSize: 5,
    });

    expect(payload.meta?.pagination).toMatchObject({
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    });
  });
});
