import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { ParamsDictionary } from "express-serve-static-core";

type MaybePromise<T> = T | PromiseLike<T>;

/**
 * Express-compatible async request handler that guarantees a consistent return signature.
 * Consumers should prefer this over `express-async-errors` to keep handler logic explicit
 * and to prevent accidental unhandled promise rejections.
 */
export type AsyncRequestHandler<
  TParams extends ParamsDictionary = ParamsDictionary,
  TResBody = unknown,
  TReqBody = unknown,
  TReqQuery extends Record<string, unknown> = Record<string, unknown>,
  TLocals extends Record<string, unknown> = Record<string, unknown>,
  TReturn = unknown,
> = (
  req: Request<TParams, TResBody, TReqBody, TReqQuery, TLocals>,
  res: Response<TResBody, TLocals>,
  next: NextFunction,
) => MaybePromise<TReturn>;

/**
 * Wraps an async route or middleware handler and pipes both synchronous throws and
 * rejected promises to Express' error pipeline via `next()`.
 *
 * @example
 * router.get(
 *   "/users/:id",
 *   asyncHandler(async (req, res) => {
 *     const user = await userService.getById(req.params.id);
 *     res.json(successResponse(user));
 *   }),
 * );
 */
export const asyncHandler = <
  TParams extends ParamsDictionary = ParamsDictionary,
  TResBody = unknown,
  TReqBody = unknown,
  TReqQuery extends Record<string, unknown> = Record<string, unknown>,
  TLocals extends Record<string, unknown> = Record<string, unknown>,
  _TReturn = unknown,
>(
  handler: AsyncRequestHandler<TParams, TResBody, TReqBody, TReqQuery, TLocals, _TReturn>,
): RequestHandler<TParams, TResBody, TReqBody, TReqQuery, TLocals> => {
  const wrappedHandler: RequestHandler<TParams, TResBody, TReqBody, TReqQuery, TLocals> = async (
    req,
    res,
    next,
  ) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };

  try {
    const descriptor = Object.getOwnPropertyDescriptor(wrappedHandler, "name");
    if (!descriptor || descriptor.configurable) {
      Object.defineProperty(wrappedHandler, "name", {
        value: handler.name ? `asyncHandler(${handler.name})` : "asyncHandler",
        configurable: true,
      });
    }
    // eslint-disable-next-line no-empty
  } catch {}

  return wrappedHandler;
};

type NormalisedRequestHandler<THandler extends AsyncRequestHandler> =
  THandler extends AsyncRequestHandler<
    infer TParams,
    infer TResBody,
    infer TReqBody,
    infer TReqQuery,
    infer TLocals,
    unknown
  >
    ? RequestHandler<TParams, TResBody, TReqBody, TReqQuery, TLocals>
    : never;

type HandlerEntries<THandlers extends Record<string, AsyncRequestHandler>> = {
  [TKey in keyof THandlers]: [TKey, THandlers[TKey]];
}[keyof THandlers][];

type NormalisedHandlerMap<THandlers extends Record<string, AsyncRequestHandler>> = {
  [TKey in keyof THandlers]: NormalisedRequestHandler<THandlers[TKey]>;
};

/**
 * Convenience helper for bulk wrapping async handlers while preserving strong typing.
 */
export const mapAsyncHandlers = <const THandlers extends Record<string, AsyncRequestHandler>>(
  handlers: THandlers,
): NormalisedHandlerMap<THandlers> => {
  const entries = Object.entries(handlers) as HandlerEntries<THandlers>;

  const wrappedEntries = entries.map(([key, handler]) => [
    key,
    asyncHandler(handler) as NormalisedRequestHandler<typeof handler>,
  ]);

  return Object.fromEntries(wrappedEntries) as NormalisedHandlerMap<THandlers>;
};
