import { UserStatus } from "@prisma/client";
import { z } from "zod";

import {
  auditTimestampsSchema,
  cuidSchema,
  emailSchema,
  isoDateTimeSchema,
  localeStringSchema,
  nullableLocaleStringSchema,
  phoneNumberSchema,
} from "./base.js";

export const userStatusSchema = z.nativeEnum(UserStatus);

export const userRoleSchema = z
  .object({
    id: cuidSchema,
    name: localeStringSchema.max(120),
    description: nullableLocaleStringSchema,
  })
  .merge(auditTimestampsSchema)
  .strict();

export const userPermissionSchema = z
  .object({
    id: cuidSchema,
    key: localeStringSchema.max(120),
    description: nullableLocaleStringSchema,
  })
  .merge(auditTimestampsSchema)
  .strict();

export const userSummarySchema = z
  .object({
    id: cuidSchema,
    email: emailSchema,
    firstName: nullableLocaleStringSchema,
    lastName: nullableLocaleStringSchema,
    fullName: nullableLocaleStringSchema,
    phone: phoneNumberSchema.nullable(),
    status: userStatusSchema,
    emailVerified: z.boolean(),
    roles: z.array(userRoleSchema),
    permissions: z.array(userPermissionSchema),
  })
  .merge(auditTimestampsSchema)
  .strict();

export const userDetailSchema = userSummarySchema.extend({
  emailVerifiedAt: isoDateTimeSchema.nullable(),
  lockoutUntil: isoDateTimeSchema.nullable(),
  twoFactorEnabled: z.boolean(),
});

export const userCreateRequestSchema = z
  .object({
    email: emailSchema,
    password: z
      .string()
      .min(12, { message: "Passwords must be at least 12 characters to meet S1 requirements." })
      .max(128),
    firstName: localeStringSchema.max(120).optional(),
    lastName: localeStringSchema.max(120).optional(),
    phone: phoneNumberSchema.optional(),
  })
  .strict();

export const userUpdateRequestSchema = z
  .object({
    firstName: localeStringSchema.max(120).optional(),
    lastName: localeStringSchema.max(120).optional(),
    phone: phoneNumberSchema.nullable().optional(),
    status: userStatusSchema.optional(),
    emailVerified: z.boolean().optional(),
  })
  .strict()
  .refine(
    (payload) => payload.status !== UserStatus.DELETED || payload.emailVerified !== true, // explicit guard to avoid inconsistent states
    {
      message: "Deleted accounts cannot remain email verified.",
      path: ["status"],
    },
  );

export type UserRoleDTO = z.infer<typeof userRoleSchema>;
export type UserPermissionDTO = z.infer<typeof userPermissionSchema>;
export type UserSummaryDTO = z.infer<typeof userSummarySchema>;
export type UserDetailDTO = z.infer<typeof userDetailSchema>;
export type UserCreateRequestDTO = z.infer<typeof userCreateRequestSchema>;
export type UserUpdateRequestDTO = z.infer<typeof userUpdateRequestSchema>;

export const isUserRoleDTO = (value: unknown): value is UserRoleDTO =>
  userRoleSchema.safeParse(value).success;

export const isUserPermissionDTO = (value: unknown): value is UserPermissionDTO =>
  userPermissionSchema.safeParse(value).success;

export const isUserSummaryDTO = (value: unknown): value is UserSummaryDTO =>
  userSummarySchema.safeParse(value).success;

export const isUserDetailDTO = (value: unknown): value is UserDetailDTO =>
  userDetailSchema.safeParse(value).success;

export const isUserCreateRequestDTO = (value: unknown): value is UserCreateRequestDTO =>
  userCreateRequestSchema.safeParse(value).success;

export const isUserUpdateRequestDTO = (value: unknown): value is UserUpdateRequestDTO =>
  userUpdateRequestSchema.safeParse(value).success;
