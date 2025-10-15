import { z } from "zod";

const DECIMAL_PATTERN = /^-?\d+(?:\.\d{1,2})?$/; // eslint-disable-line security/detect-unsafe-regex
const SLUG_PATTERN = /^[\da-z]+(?:-[\da-z]+)*$/; // eslint-disable-line security/detect-unsafe-regex
const SKU_PATTERN = /^[\d.A-Z_-]{3,32}$/; // eslint-disable-line security/detect-unsafe-regex
const PHONE_PATTERN = /^\+?\d{7,15}$/; // eslint-disable-line security/detect-unsafe-regex

export const cuidSchema = z.string().cuid({ message: "Identifier must be a valid CUID value." });

export const identifierSchema = z
  .string()
  .min(1, { message: "Identifier cannot be empty." })
  .max(64, { message: "Identifier cannot exceed 64 characters." });

export const isoDateTimeSchema = z
  .string()
  .datetime({ offset: true, message: "Timestamp must be ISO-8601 with timezone offset." });

export const optionalIsoDateTimeSchema = isoDateTimeSchema.nullish();

export const emailSchema = z.string().email({ message: "Email address is invalid." }).max(254);

export const phoneNumberSchema = z
  .string()
  .regex(PHONE_PATTERN, { message: "Phone number must contain only digits and may start with +." });

export const slugSchema = z
  .string()
  .regex(SLUG_PATTERN, {
    message: "Slug must contain lowercase alphanumeric characters separated by hyphens.",
  })
  .min(3)
  .max(120);

export const skuSchema = z.string().regex(SKU_PATTERN, {
  message: "SKU may contain uppercase letters, numbers, and '-_.' characters.",
});

export const localeStringSchema = z
  .string()
  .trim()
  .min(1, { message: "Value cannot be blank." })
  .max(500);

export const nullableLocaleStringSchema = localeStringSchema.nullable();

export const urlSchema = z.string().url();

export const currencyCodeSchema = z
  .string()
  .length(3, { message: "Currency codes must follow ISO-4217 alpha-3 format." })
  .regex(/^[A-Z]{3}$/, { message: "Currency codes must be uppercase alphabetic characters." });

export const decimalAmountSchema = z.string().regex(DECIMAL_PATTERN, {
  message: "Amount must be a numeric string with up to two fractional digits.",
});

export const moneySchema = z
  .object({
    amount: decimalAmountSchema,
    currency: currencyCodeSchema,
  })
  .strict();

export const auditTimestampsSchema = z
  .object({
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict();

export const softDeleteSchema = z
  .object({
    deletedAt: isoDateTimeSchema.nullable(),
  })
  .strict();

export const optionalJsonSchema: z.ZodType<unknown> = z.unknown().nullable();

export type Identifier = z.infer<typeof identifierSchema>;
export type IsoDateTimeString = z.infer<typeof isoDateTimeSchema>;
export type EmailString = z.infer<typeof emailSchema>;
export type PhoneNumberString = z.infer<typeof phoneNumberSchema>;
export type SlugString = z.infer<typeof slugSchema>;
export type CurrencyCode = z.infer<typeof currencyCodeSchema>;
export type DecimalAmountString = z.infer<typeof decimalAmountSchema>;
export type MoneyDTO = z.infer<typeof moneySchema>;
export type AuditTimestampsDTO = z.infer<typeof auditTimestampsSchema>;
