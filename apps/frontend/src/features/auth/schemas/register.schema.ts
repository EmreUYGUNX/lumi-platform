import { z } from "zod";

import { strongPasswordSchema } from "@/lib/auth/contracts";

export const registerFormSchema = z
  .object({
    fullName: z.string().trim().min(2, "Ad soyad gerekli"),
    email: z.string().trim().toLowerCase().email("Geçerli bir e-posta girin"),
    password: strongPasswordSchema,
    confirmPassword: z.string().min(1, "Şifreyi doğrulayın"),
    acceptTerms: z.boolean().refine((value) => value === true, {
      message: "Şartları kabul etmelisiniz",
    }),
    marketingConsent: z.boolean(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Şifreler eşleşmiyor",
  });

export type RegisterFormValues = z.input<typeof registerFormSchema>;
