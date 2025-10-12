// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it, jest } from "@jest/globals";
import type { NextFunction, Request, Response } from "express";

import { asyncHandler, mapAsyncHandlers } from "../asyncHandler.js";

const createContext = () => {
  const req = {} as Request;
  const res = {
    json: jest.fn(),
    locals: {},
  } as unknown as Response;
  const next: NextFunction = jest.fn();

  return { req, res, next };
};

describe("asyncHandler", () => {
  it("invokes the underlying handler and skips next() on success", async () => {
    const { req, res, next } = createContext();
    const handler = jest.fn(async (_req: Request, _res: Response) => {
      res.json({ ok: true });
    });

    const wrapped = asyncHandler(handler);
    await expect(wrapped(req, res, next)).resolves.toBeUndefined();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
  });

  it("forwards rejected promises to next()", async () => {
    const { req, res, next } = createContext();
    const error = new Error("database offline");
    const handler = jest.fn(async () => {
      throw error;
    });

    const wrapped = asyncHandler(handler);
    await wrapped(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(error);
  });

  it("captures synchronous exceptions and notifies next()", () => {
    const { req, res, next } = createContext();
    const error = new Error("config missing");
    const handler = jest.fn(() => {
      throw error;
    });

    const wrapped = asyncHandler(handler);
    wrapped(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(error);
  });
});

describe("mapAsyncHandlers", () => {
  it("wraps each handler while preserving keys", async () => {
    const { req, res } = createContext();
    const successNext: NextFunction = jest.fn();
    const failureNext: NextFunction = jest.fn();
    const failure = new Error("rate limit exceeded");

    const handlers = {
      list: jest.fn(async () => ({ users: [] })),
      create: jest.fn(async () => {
        throw failure;
      }),
    };

    const wrappedHandlers = mapAsyncHandlers(handlers);

    await wrappedHandlers.list(req, res, successNext);
    expect(handlers.list).toHaveBeenCalledTimes(1);
    expect(successNext).not.toHaveBeenCalled();

    await wrappedHandlers.create(req, res, failureNext);
    expect(handlers.create).toHaveBeenCalledTimes(1);
    expect(failureNext).toHaveBeenCalledWith(failure);
  });
});
