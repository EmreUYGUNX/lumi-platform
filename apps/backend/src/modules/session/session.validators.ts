import { z } from "zod";

import { cuidSchema } from "@lumi/shared/dto";

import { previewLayersSchema } from "../preview/preview.validators.js";

const MAX_SESSION_DATA_LENGTH = 2_000_000;

const sessionDataRecordSchema = z.record(z.unknown());

const sessionDataSchema = z.union([
  sessionDataRecordSchema,
  z
    .string()
    .trim()
    .min(2)
    .max(MAX_SESSION_DATA_LENGTH)
    .transform((value, ctx) => {
      try {
        const parsed = JSON.parse(value) as unknown;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "sessionData must be a JSON object.",
          });
          return z.NEVER;
        }
        return parsed as Record<string, unknown>;
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "sessionData must be valid JSON.",
          fatal: true,
        });
        return z.NEVER;
      }
    })
    .pipe(sessionDataRecordSchema),
]);

export const sessionSaveBodySchema = z
  .object({
    sessionId: cuidSchema.optional(),
    productId: cuidSchema,
    designArea: z.string().trim().min(1).max(64),
    layers: previewLayersSchema,
    sessionData: sessionDataSchema,
  })
  .strict();

export type SessionSaveBody = z.infer<typeof sessionSaveBodySchema>;

export const sessionListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional(),
    perPage: z.coerce.number().int().min(1).max(200).optional(),
    productId: cuidSchema.optional(),
    order: z.enum(["asc", "desc"]).optional(),
  })
  .strict();

export type SessionListQuery = z.infer<typeof sessionListQuerySchema>;

export { cuidSchema as sessionIdParamSchema } from "@lumi/shared/dto";

export const sessionShareTokenParamSchema = z.string().trim().min(16).max(256);
