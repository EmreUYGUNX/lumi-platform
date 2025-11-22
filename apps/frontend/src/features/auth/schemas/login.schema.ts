import { z } from "zod";

export const loginFormSchema = z.object({
  email: z.string().trim().toLowerCase().email("Geçerli bir e-posta girin"),
  password: z.string().min(1, "Şifre gerekli"),
  rememberMe: z.boolean(),
});

export type LoginFormValues = z.input<typeof loginFormSchema>;
