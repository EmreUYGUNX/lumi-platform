"use client";

import { useEffect, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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

import { PasswordStrength } from "./PasswordStrength";
import { useResetPassword } from "../hooks/useResetPassword";
import { resetPasswordFormSchema, type ResetPasswordFormValues } from "../schemas/password.schema";

interface ResetPasswordFormProps {
  token?: string | null;
}

export function ResetPasswordForm({ token }: ResetPasswordFormProps): JSX.Element {
  const [hasToken, setHasToken] = useState(Boolean(token));
  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    setHasToken(Boolean(token));
  }, [token]);

  const { mutateAsync, isPending, isSuccess } = useResetPassword(token ?? undefined);

  const handleSubmit = async (values: ResetPasswordFormValues) => {
    await mutateAsync(values);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Set a new password</h1>
        <p className="text-lumi-text-secondary text-sm">
          For security reasons we enforce 12+ characters and passkey readiness.
        </p>
      </div>
      {!hasToken && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Token bulunamadı</AlertTitle>
          <AlertDescription>
            Geçerli bir sıfırlama bağlantısı olmadan devam edemezsin.
          </AlertDescription>
        </Alert>
      )}
      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)} noValidate>
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="••••••••••••"
                    autoComplete="new-password"
                    {...field}
                  />
                </FormControl>
                <PasswordStrength value={field.value} />
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
                  <Input
                    type="password"
                    placeholder="Again please"
                    autoComplete="new-password"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={isPending || !hasToken}>
            {isPending ? "Updating..." : "Update password"}
          </Button>
        </form>
      </Form>

      {isSuccess && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Şifre güncellendi</AlertTitle>
          <AlertDescription>Yeni şifrenle giriş yapabilirsin.</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
