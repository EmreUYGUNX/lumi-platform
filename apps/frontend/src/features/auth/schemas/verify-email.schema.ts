import { z } from "zod";

export const verifyEmailFormSchema = z.object({
  token: z.string().trim().min(10, "Doğrulama kodu geçersiz"),
});

export type VerifyEmailFormValues = z.infer<typeof verifyEmailFormSchema>;
