import { describe, expect, it } from "@jest/globals";

import {
  AppError,
  ConflictError,
  ERROR_CODES,
  ForbiddenError,
  InternalServerError,
  MethodNotAllowedError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  isAppError,
  isForbiddenError,
  isNotFoundError,
  isUnauthorizedError,
  isValidationError,
} from "../errors.js";

describe("AppError hierarchy", () => {
  it("retains provided metadata and marks errors operational by default for 4xx statuses", () => {
    const error = new AppError("Custom message", 400, {
      code: ERROR_CODES.VALIDATION,
      details: { field: "email" },
      exposeDetails: true,
    });

    expect(error.message).toBe("Custom message");
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe(ERROR_CODES.VALIDATION);
    expect(error.details).toEqual({ field: "email" });
    expect(error.isOperational).toBe(true);
    expect(error.exposeDetails).toBe(true);
  });

  it("wraps validation details and exposes them by default", () => {
    const validation = new ValidationError(undefined, {
      issues: [{ path: "email", message: "Invalid email" }],
    });

    expect(validation.statusCode).toBe(400);
    expect(validation.code).toBe(ERROR_CODES.VALIDATION);
    expect(validation.details?.issues).toEqual([{ path: "email", message: "Invalid email" }]);
    expect(validation.exposeDetails).toBe(true);
    expect(isValidationError(validation)).toBe(true);
  });

  it("provides specific subclasses with appropriate defaults", () => {
    const unauthorized = new UnauthorizedError();
    const forbidden = new ForbiddenError();
    const notFound = new NotFoundError();
    const methodNotAllowed = new MethodNotAllowedError();
    const conflict = new ConflictError();
    const internal = new InternalServerError();

    expect(unauthorized.statusCode).toBe(401);
    expect(isUnauthorizedError(unauthorized)).toBe(true);

    expect(forbidden.statusCode).toBe(403);
    expect(isForbiddenError(forbidden)).toBe(true);

    expect(notFound.statusCode).toBe(404);
    expect(isNotFoundError(notFound)).toBe(true);

    expect(methodNotAllowed.statusCode).toBe(405);

    expect(conflict.statusCode).toBe(409);

    expect(internal.statusCode).toBe(500);
    expect(internal.isOperational).toBe(false);
  });

  it("supports type guards for generic AppError instances", () => {
    const error = new AppError("Failure", 500, { code: ERROR_CODES.INTERNAL });

    expect(isAppError(error)).toBe(true);
    expect(isAppError(new Error("not-app-error"))).toBe(false);
  });
});
