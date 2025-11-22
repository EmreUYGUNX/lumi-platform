"use client";

import { useEffect, useMemo, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";

import { useSearchParams } from "next/navigation";
import Link from "next/link";

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
import { authApi } from "@/lib/auth/api";
import { ApiClientError } from "@/lib/api-client";
import { toast } from "@/hooks/use-toast";

import { useVerifyEmail } from "../hooks/useVerifyEmail";
import { verifyEmailFormSchema, type VerifyEmailFormValues } from "../schemas/verify-email.schema";

const resendVerification = async (): Promise<void> => {
  try {
    await authApi.resendVerification({});
    toast({
      title: "Doğrulama e-postası gönderildi",
      description: "Lütfen gelen kutunu kontrol et.",
    });
  } catch (error) {
    const description = error instanceof ApiClientError ? error.message : "E-posta gönderilemedi.";
    toast({
      title: "İşlem başarısız",
      description,
      variant: "destructive",
    });
  }
};

export function VerifyEmailForm(): JSX.Element {
  const searchParams = useSearchParams();
  const tokenFromUrl = useMemo(() => searchParams?.get("token"), [searchParams]);
  const email = useMemo(() => searchParams?.get("email"), [searchParams]);
  const [status, setStatus] = useState<"idle" | "verifying" | "success" | "error">("idle");

  const form = useForm<VerifyEmailFormValues>({
    resolver: zodResolver(verifyEmailFormSchema),
    defaultValues: {
      token: tokenFromUrl ?? "",
    },
  });

  const { mutateAsync, isPending } = useVerifyEmail();

  useEffect(() => {
    const autoVerify = async () => {
      if (!tokenFromUrl) {
        return;
      }
      setStatus("verifying");
      try {
        await mutateAsync({ token: tokenFromUrl });
        setStatus("success");
      } catch {
        setStatus("error");
      }
    };
    autoVerify();
  }, [mutateAsync, tokenFromUrl]);

  const handleSubmit = async (values: VerifyEmailFormValues) => {
    setStatus("verifying");
    try {
      await mutateAsync(values);
      setStatus("success");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Verify your email</h1>
        <p className="text-lumi-text-secondary text-sm">
          Güvenliğin için e-posta adresini doğrulamalısın.
          {email ? ` (${email})` : ""}
        </p>
      </div>
      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)} noValidate>
          <FormField
            control={form.control}
            name="token"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Verification token</FormLabel>
                <FormControl>
                  <Input placeholder="Paste your token" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify email"
            )}
          </Button>
        </form>
      </Form>

      <div className="text-lumi-text-secondary flex items-center justify-between text-sm">
        <button
          type="button"
          className="text-lumi-primary hover:underline"
          onClick={resendVerification}
        >
          Resend verification email
        </button>
        <Link href="/login" className="hover:underline">
          Back to login
        </Link>
      </div>

      {status === "success" && (
        <Alert>
          <AlertTitle>Doğrulama başarılı</AlertTitle>
          <AlertDescription>Hesabın etkinleştirildi, yönlendiriliyorsun.</AlertDescription>
        </Alert>
      )}
      {status === "error" && (
        <Alert variant="destructive">
          <AlertTitle>Doğrulama başarısız</AlertTitle>
          <AlertDescription>
            Lütfen token geçerli mi kontrol et ya da yeniden gönder.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
