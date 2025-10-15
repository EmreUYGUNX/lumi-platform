import { z } from "zod";

export const paginationRequestSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(200).default(25),
  })
  .strict();

export const cursorPaginationRequestSchema = z
  .object({
    cursor: z.string().optional(),
    take: z.coerce.number().int().positive().max(200).default(25),
    direction: z.enum(["forward", "backward"]).default("forward"),
  })
  .strict();

export const paginationMetaSchema = z
  .object({
    page: z.number().int().nonnegative(),
    pageSize: z.number().int().positive(),
    totalItems: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
    hasNextPage: z.boolean(),
    hasPreviousPage: z.boolean(),
  })
  .strict();

export const cursorPaginationMetaSchema = z
  .object({
    hasMore: z.boolean(),
    nextCursor: z.string().nullable(),
  })
  .strict();

export const buildPaginatedResponseSchema = <TItem extends z.ZodTypeAny>(itemSchema: TItem) =>
  z
    .object({
      items: z.array(itemSchema),
      meta: paginationMetaSchema,
    })
    .strict();

export const buildCursorPaginatedResponseSchema = <TItem extends z.ZodTypeAny>(itemSchema: TItem) =>
  z
    .object({
      items: z.array(itemSchema),
      meta: cursorPaginationMetaSchema,
    })
    .strict();

export type PaginationRequest = z.infer<typeof paginationRequestSchema>;
export type CursorPaginationRequest = z.infer<typeof cursorPaginationRequestSchema>;
export type PaginationMeta = z.infer<typeof paginationMetaSchema>;
export type CursorPaginationMeta = z.infer<typeof cursorPaginationMetaSchema>;

export const isPaginationRequest = (value: unknown): value is PaginationRequest =>
  paginationRequestSchema.safeParse(value).success;

export const isCursorPaginationRequest = (value: unknown): value is CursorPaginationRequest =>
  cursorPaginationRequestSchema.safeParse(value).success;

export const isPaginationMeta = (value: unknown): value is PaginationMeta =>
  paginationMetaSchema.safeParse(value).success;

export const isCursorPaginationMeta = (value: unknown): value is CursorPaginationMeta =>
  cursorPaginationMetaSchema.safeParse(value).success;
