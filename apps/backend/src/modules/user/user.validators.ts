import { z } from "zod";

import {
  cuidSchema,
  localeStringSchema,
  nullableLocaleStringSchema,
  paginationRequestSchema,
  phoneNumberSchema,
  userPreferenceUpdateSchema,
  userStatusSchema,
} from "@lumi/shared/dto";

const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;

const countryCodeSchema = z
  .string()
  .trim()
  .length(2, { message: "Country codes must use ISO-3166 alpha-2 format." })
  .regex(COUNTRY_CODE_PATTERN, { message: "Country codes must contain uppercase letters only." });

const baseAddressSchema = z
  .object({
    label: localeStringSchema.max(120),
    fullName: localeStringSchema.max(180),
    phone: phoneNumberSchema.nullable().optional(),
    line1: localeStringSchema.max(240),
    line2: nullableLocaleStringSchema.optional(),
    city: localeStringSchema.max(120),
    state: nullableLocaleStringSchema.optional(),
    postalCode: localeStringSchema.max(20),
    country: countryCodeSchema,
  })
  .strict();

export const userProfileUpdateSchema = z
  .object({
    firstName: localeStringSchema.max(120).optional(),
    lastName: localeStringSchema.max(120).optional(),
    phone: phoneNumberSchema.nullable().optional(),
  })
  .strict()
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one field must be provided.",
    path: ["root"],
  });

export const createAddressSchema = baseAddressSchema
  .extend({
    isDefault: z.boolean().optional(),
  })
  .strict();

export const updateAddressSchema = baseAddressSchema.partial().strict();

export const addressIdParamSchema = z.object({
  addressId: cuidSchema,
});

export const userPreferencePatchSchema = userPreferenceUpdateSchema;
export const updatePreferencesSchema = userPreferencePatchSchema;
export const updateProfileSchema = userProfileUpdateSchema;

export const adminUserListQuerySchema = paginationRequestSchema
  .extend({
    status: z.array(userStatusSchema).optional(),
    role: localeStringSchema.max(120).optional(),
    search: localeStringSchema.max(120).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    format: z.enum(["json", "csv"]).default("json"),
    exportLimit: z.coerce.number().int().positive().max(5000).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.from && value.to && value.from > value.to) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "The 'from' date cannot be after the 'to' date.",
        path: ["from", "to"],
      });
    }
  });

export const adminUserStatusSchema = z
  .object({
    status: userStatusSchema,
    reason: nullableLocaleStringSchema.optional(),
  })
  .strict();

export const adminUnlockUserSchema = z
  .object({
    reason: nullableLocaleStringSchema.optional(),
  })
  .strict();

export type UserProfileUpdateInput = z.infer<typeof userProfileUpdateSchema>;
export type CreateAddressInput = z.infer<typeof createAddressSchema>;
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;
export type AddressIdParams = z.infer<typeof addressIdParamSchema>;
export type UserPreferencePatchInput = z.infer<typeof userPreferencePatchSchema>;
export type AdminUserListQuery = z.infer<typeof adminUserListQuerySchema>;
export type AdminUserStatusInput = z.infer<typeof adminUserStatusSchema>;
export type AdminUnlockUserInput = z.infer<typeof adminUnlockUserSchema>;
