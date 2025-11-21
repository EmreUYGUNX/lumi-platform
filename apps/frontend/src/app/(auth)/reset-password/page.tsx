"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

// Avoid static prerender; run at request time.
export const dynamic = "force-dynamic";
export const revalidate = 0;

const resetSchema = z
  .object({
    password: z
      .string()
      .min(12, "Şifreniz en az 12 karakter olmalı.")
      .regex(/[A-Z]/, "En az 1 büyük harf olmalı.")
      .regex(/[a-z]/, "En az 1 küçük harf olmalı.")
      .regex(/\d/, "En az 1 rakam olmalı.")
      .regex(/[^\da-z]/i, "En az 1 özel karakter olmalı."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Şifreler eşleşmiyor.",
  });

type ResetValues = z.infer<typeof resetSchema>;

export default function ResetPasswordPage(): JSX.Element {
  const router = useRouter();
  const form = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const handleSubmit = (values: ResetValues) => {
    console.info("Reset password payload", values.password.length);
    router.push("/login");
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Set a new password</h1>
        <p className="text-lumi-text-secondary text-sm">
          For security reasons we enforce 12+ characters and passkey readiness.
        </p>
      </div>
      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New password</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="••••••••••••" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm password</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="Again please" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full">
            Update password
          </Button>
        </form>
      </Form>
    </div>
  );
}
