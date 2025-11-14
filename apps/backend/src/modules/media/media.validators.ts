import { z } from "zod";

export const IMAGE_MIME_WHITELIST: ReadonlyMap<string, { extension: string }> = new Map([
  ["image/jpeg", { extension: "jpg" }],
  ["image/png", { extension: "png" }],
  ["image/webp", { extension: "webp" }],
  ["image/gif", { extension: "gif" }],
]);

export type SupportedImageMimeType =
  typeof IMAGE_MIME_WHITELIST extends ReadonlyMap<infer Keys, unknown> ? Keys : never;

const MAX_TAGS = 25;

const normaliseTags = (input: unknown): string[] => {
  if (Array.isArray(input)) {
    return input
      .flatMap((value) => {
        if (typeof value === "string") {
          return value.split(",");
        }

        if (typeof value === "number" || typeof value === "bigint") {
          return String(value);
        }

        return [];
      })
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  if (typeof input === "string") {
    return input
      .split(/[,\s]+/u)
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }

  return [];
};

const tagSchema = z
  .string()
  .trim()
  .min(2, "Tags must be at least 2 characters")
  .max(50, "Tags must be at most 50 characters")
  .transform((value) => value.toLowerCase().replaceAll(/[^a-z0-9:_-]+/gu, "-"))
  .refine((value) => value.length > 0, "Tags must contain at least one safe character");

const metadataRecordSchema = z.record(
  z
    .union([z.string(), z.number(), z.boolean(), z.null()])
    .transform((value) =>
      value === null ? "" : typeof value === "string" ? value : String(value),
    ),
);

const metadataSchema = z
  .union([
    metadataRecordSchema,
    z
      .string()
      .trim()
      .min(2)
      .transform((value, ctx) => {
        try {
          const parsed = JSON.parse(value);
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Metadata must be an object.",
            });
            return z.NEVER;
          }

          return parsed as Record<string, unknown>;
        } catch {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Metadata must be valid JSON.",
            fatal: true,
          });
          return z.NEVER;
        }
      })
      .pipe(metadataRecordSchema),
  ])
  .optional();

const normaliseFolder = (value: string): string => value.replace(/^\/*/u, "").replace(/\/*$/u, "");

const baseUploadSchema = z.object({
  folder: z
    .string()
    .trim()
    .min(1, "Folder is required")
    .max(200, "Folder must be less than 200 characters")
    .transform((value) => normaliseFolder(value)),
  tags: z
    .preprocess(normaliseTags, z.array(tagSchema).max(MAX_TAGS))
    .default([])
    .transform((tags) => [...new Set(tags)]),
  visibility: z.enum(["public", "private", "internal"]).default("public"),
  metadata: metadataSchema,
});

export interface MediaUploadValidationOptions {
  allowedFolders: readonly string[];
  defaultFolder: string;
}

export const createMediaUploadSchema = ({
  allowedFolders,
  defaultFolder,
}: MediaUploadValidationOptions) =>
  baseUploadSchema
    .extend({
      folder: baseUploadSchema.shape.folder.default(defaultFolder),
    })
    .superRefine((data, ctx) => {
      if (!allowedFolders.includes(data.folder)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Folder is not allowed.",
          path: ["folder"],
        });
      }
    });

export type MediaUploadBody = z.infer<ReturnType<typeof createMediaUploadSchema>>;

const baseSignatureSchema = z.object({
  folder: baseUploadSchema.shape.folder,
  eager: z
    .array(
      z.object({
        width: z.number().int().positive().optional(),
        height: z.number().int().positive().optional(),
        crop: z.string().optional(),
      }),
    )
    .optional(),
  tags: z.preprocess(normaliseTags, z.array(tagSchema).max(MAX_TAGS).default([])),
});

export const createMediaSignatureSchema = ({
  allowedFolders,
  defaultFolder,
}: MediaUploadValidationOptions) =>
  baseSignatureSchema
    .extend({
      folder: baseSignatureSchema.shape.folder.default(defaultFolder),
    })
    .superRefine((data, ctx) => {
      if (!allowedFolders.includes(data.folder)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Folder is not allowed.",
          path: ["folder"],
        });
      }
    });

export type MediaSignatureBody = z.infer<ReturnType<typeof createMediaSignatureSchema>>;
