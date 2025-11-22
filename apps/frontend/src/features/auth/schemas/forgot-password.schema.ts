import { z } from "zod";

export const forgotPasswordFormSchema = z.object({
  email: z.string().trim().toLowerCase().email("Geçerli bir e-posta girin"),
});

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordFormSchema>;
