import { z } from "zod";

import { strongPasswordSchema } from "@/lib/auth/contracts";

export const resetPasswordFormSchema = z
  .object({
    password: strongPasswordSchema,
    confirmPassword: z.string().min(1, "Şifreyi doğrulayın"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Şifreler eşleşmiyor",
  });

export type ResetPasswordFormValues = z.infer<typeof resetPasswordFormSchema>;
