import { z } from "zod";

import type { ValidationConfig } from "@lumi/types";

const CONTROL_CHARACTERS = /\p{Cc}/gu;

type PlainObject = Record<string, unknown>;

const isPlainObject = (value: unknown): value is PlainObject =>
  typeof value === "object" && value !== null && !Array.isArray(value) && !(value instanceof Date);

export const sanitizeValue = <T>(value: T): T => {
  if (typeof value === "string") {
    const trimmed = value.replaceAll(CONTROL_CHARACTERS, "").trim();
    return trimmed as T;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(entry)) as T;
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, sanitizeValue(entry)]),
    ) as T;
  }

  return value;
};

const normaliseSchema = <T>(schema: z.ZodType<T>, config: ValidationConfig): z.ZodType<T> => {
  if (schema instanceof z.ZodObject) {
    if (config.strict) {
      return schema.strict() as unknown as z.ZodType<T>;
    }

    if (config.stripUnknown) {
      return schema.strip() as unknown as z.ZodType<T>;
    }
  }

  return schema;
};

const estimatePayloadSizeKb = (payload: unknown): number => {
  try {
    const serialised = JSON.stringify(payload ?? {});
    return Buffer.byteLength(serialised, "utf8") / 1024;
  } catch {
    return 0;
  }
};

export interface ValidationFailure {
  success: false;
  message: string;
  errors: z.ZodIssue[];
  status: 400 | 413;
}

export interface ValidationSuccess<T> {
  success: true;
  data: T;
  sanitized: boolean;
  sizeKb: number;
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

export const validatePayload = <T>(
  schema: z.ZodType<T>,
  payload: unknown,
  config: ValidationConfig,
): ValidationResult<T> => {
  const sizeKb = estimatePayloadSizeKb(payload);
  if (sizeKb > config.maxBodySizeKb) {
    return {
      success: false,
      message: `Payload exceeds maximum size of ${config.maxBodySizeKb}KB`,
      errors: [],
      status: 413,
    };
  }

  const workingSchema = normaliseSchema(schema, config);
  const result = workingSchema.safeParse(payload);

  if (!result.success) {
    return {
      success: false,
      message: "Validation failed",
      errors: result.error.issues,
      status: 400,
    };
  }

  const { data } = result;
  let normalisedData = data;
  let sanitized = false;

  if (config.sanitize) {
    const cleaned = sanitizeValue(data);
    sanitized = cleaned !== data;
    normalisedData = cleaned;
  }

  return {
    success: true,
    data: normalisedData,
    sanitized,
    sizeKb: Math.round(sizeKb * 100) / 100,
  };
};

export const createValidator = <T>(schema: z.ZodType<T>, config: ValidationConfig) => {
  return (payload: unknown) => validatePayload(schema, payload, config);
};
