import { z } from "zod";

import type { Q2SuccessResponse } from "@/lib/api-client";

const UPPERCASE_REGEX = /[A-Z]/;
const LOWERCASE_REGEX = /[a-z]/;
const NUMBER_REGEX = /\d/;
const SPECIAL_CHAR_REGEX = /[^\dA-Za-z]/;

const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_REQUIRED_MESSAGE = "Password is required.";

const emailSchema = z
  .string({ required_error: "Email is required." })
  .trim()
  .toLowerCase()
  .email("Email address is invalid.");

export const strongPasswordSchema = z
  .string({ required_error: PASSWORD_REQUIRED_MESSAGE })
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`)
  .superRefine((value, ctx) => {
    if (!UPPERCASE_REGEX.test(value)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Must contain an uppercase letter." });
    }
    if (!LOWERCASE_REGEX.test(value)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Must contain a lowercase letter." });
    }
    if (!NUMBER_REGEX.test(value)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Must contain a number." });
    }
    if (!SPECIAL_CHAR_REGEX.test(value)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Must contain a special character." });
    }
  });

const nameSchema = z
  .string({ required_error: "Name is required." })
  .trim()
  .min(2, "Name must be at least 2 characters.")
  .max(100, "Name must be at most 100 characters.");

const phoneValueSchema = z
  .string()
  .trim()
  .regex(/^\+?[\d\s().-]{7,20}$/, "Phone number format is invalid.");

const phoneSchema = phoneValueSchema.optional();

export const authMetaSchema = z
  .object({
    timestamp: z.string().datetime(),
    requestId: z.string().min(8),
  })
  .passthrough();

export type AuthApiMeta = z.infer<typeof authMetaSchema>;

export const userProfileSchema = z
  .object({
    id: z.string().uuid(),
    email: emailSchema,
    firstName: nameSchema.optional().nullable(),
    lastName: nameSchema.optional().nullable(),
    phone: phoneValueSchema.nullish(),
    emailVerified: z.boolean(),
    status: z.enum(["ACTIVE", "SUSPENDED", "DELETED"]),
    roles: z.array(z.string().min(1)),
    permissions: z.array(z.string().min(1)),
  })
  .strict();

export type UserProfile = z.infer<typeof userProfileSchema>;

export const sessionDataSchema = z
  .object({
    sessionId: z.string().uuid(),
    accessToken: z.string().min(10),
    refreshToken: z.string().min(10),
    accessTokenExpiresAt: z.string().datetime(),
    refreshTokenExpiresAt: z.string().datetime(),
    user: userProfileSchema,
    emailVerified: z.boolean().optional(),
  })
  .strict();

export type SessionData = z.infer<typeof sessionDataSchema>;

const clientContextSchema = z
  .object({
    locale: z.string().optional(),
    timeZone: z.string().optional(),
    userAgent: z.string().optional(),
    fingerprint: z.string().optional(),
  })
  .partial();

export const loginRequestSchema = z.object({
  email: emailSchema,
  password: z
    .string({ required_error: PASSWORD_REQUIRED_MESSAGE })
    .min(1, PASSWORD_REQUIRED_MESSAGE),
  rememberMe: z.boolean().optional(),
  context: clientContextSchema.optional(),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const registerRequestSchema = z.object({
  email: emailSchema,
  password: strongPasswordSchema,
  firstName: nameSchema,
  lastName: nameSchema,
  phone: phoneSchema,
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const forgotPasswordRequestSchema = z.object({
  email: emailSchema,
});

export type ForgotPasswordRequest = z.infer<typeof forgotPasswordRequestSchema>;

export const resetPasswordRequestSchema = z.object({
  token: z.string().trim().min(10, "Reset token is invalid."),
  password: strongPasswordSchema,
});

export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>;

export const verifyEmailRequestSchema = z.object({
  token: z.string().trim().min(10, "Verification token is invalid."),
});

export type VerifyEmailRequest = z.infer<typeof verifyEmailRequestSchema>;

export const resendVerificationRequestSchema = z.object({
  email: emailSchema.optional(),
});

export type ResendVerificationRequest = z.infer<typeof resendVerificationRequestSchema>;

export const magicLinkRequestSchema = z.object({
  email: emailSchema,
});

export type MagicLinkRequest = z.infer<typeof magicLinkRequestSchema>;

export const updateProfileRequestSchema = z
  .object({
    firstName: nameSchema.optional(),
    lastName: nameSchema.optional(),
    phone: phoneSchema,
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "At least one field is required.",
  });

export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;

export const updatePasswordRequestSchema = z.object({
  currentPassword: z
    .string({ required_error: "Current password is required." })
    .min(1, "Current password is required.")
    .max(256, "Current password exceeds maximum length."),
  newPassword: strongPasswordSchema,
});

export type UpdatePasswordRequest = z.infer<typeof updatePasswordRequestSchema>;

const emailVerificationSchema = z
  .object({
    expiresAt: z.string().datetime(),
  })
  .strict();

const buildSuccessEnvelope = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z
    .object({
      success: z.literal(true),
      data: dataSchema,
      meta: authMetaSchema.optional(),
    })
    .strict();

export const loginResponseSchema = buildSuccessEnvelope(sessionDataSchema);
export const registerResponseSchema = buildSuccessEnvelope(
  z
    .object({
      user: userProfileSchema,
      emailVerification: emailVerificationSchema,
    })
    .strict(),
);

export const userResponseSchema = buildSuccessEnvelope(
  z
    .object({
      user: userProfileSchema,
    })
    .strict(),
);

export const messageResponseSchema = buildSuccessEnvelope(
  z
    .object({
      message: z.string(),
    })
    .strict(),
);

export const logoutResponseSchema = buildSuccessEnvelope(
  z
    .object({
      sessionId: z.string().uuid(),
    })
    .strict(),
);

export const logoutAllResponseSchema = buildSuccessEnvelope(
  z
    .object({
      revokedSessions: z.number().int().nonnegative(),
    })
    .strict(),
);

export type LoginResponse = Q2SuccessResponse<SessionData, AuthApiMeta | undefined>;
export type RegisterResponse = Q2SuccessResponse<
  z.infer<typeof registerResponseSchema>["data"],
  AuthApiMeta | undefined
>;

const buildTypeGuard =
  <T>(schema: z.ZodType<T>) =>
  (payload: unknown): payload is T =>
    schema.safeParse(payload).success;

export const isLoginResponse = buildTypeGuard<LoginResponse>(loginResponseSchema);
export const isRegisterResponse = buildTypeGuard<RegisterResponse>(registerResponseSchema);
export const isUserResponse = buildTypeGuard(userResponseSchema);
export const isMessageResponse = buildTypeGuard(messageResponseSchema);
export const isLogoutResponse = buildTypeGuard(logoutResponseSchema);
export const isLogoutAllResponse = buildTypeGuard(logoutAllResponseSchema);
