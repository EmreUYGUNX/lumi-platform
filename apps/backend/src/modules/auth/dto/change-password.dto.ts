import { z } from "zod";

import { passwordSchema } from "./common.js";

export const ChangePasswordRequestSchema = z
  .object({
    currentPassword: z
      .string({ required_error: "Current password is required." })
      .min(1, "Current password is required.")
      .max(256, "Current password exceeds maximum length."),
    newPassword: passwordSchema,
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must differ from the current password.",
    path: ["newPassword"],
  });

export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequestSchema>;
