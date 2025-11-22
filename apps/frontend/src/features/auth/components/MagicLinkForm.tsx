"use client";

import { useEffect, useMemo, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Link as LinkIcon } from "lucide-react";
import { useForm } from "react-hook-form";

import { useSearchParams } from "next/navigation";

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

import { useMagicLink } from "../hooks/useMagicLink";
import { magicLinkFormSchema, type MagicLinkFormValues } from "../schemas/magic-link.schema";

export function MagicLinkForm(): JSX.Element {
  const searchParams = useSearchParams();
  const tokenFromUrl = useMemo(() => searchParams?.get("token"), [searchParams]);
  const [linkConsumed, setLinkConsumed] = useState(false);

  const form = useForm<MagicLinkFormValues>({
    resolver: zodResolver(magicLinkFormSchema),
    defaultValues: {
      email: searchParams?.get("email") ?? "",
    },
  });

  const { mutateAsync, isPending, isSuccess } = useMagicLink();

  useEffect(() => {
    if (tokenFromUrl) {
      setLinkConsumed(true);
    }
  }, [tokenFromUrl]);

  const handleSubmit = async (values: MagicLinkFormValues) => {
    await mutateAsync(values);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Sihirli bağlantı ile giriş</h1>
        <p className="text-lumi-text-secondary text-sm">
          E-posta adresine tek kullanımlık giriş bağlantısı göndereceğiz.
        </p>
      </div>
      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)} noValidate>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="founder@lumi.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Gönderiliyor..." : "Bağlantı gönder"}
          </Button>
        </form>
      </Form>

      {(isSuccess || linkConsumed) && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Bağlantı gönderildi</AlertTitle>
          <AlertDescription>
            Gelen kutunu kontrol et. Eğer bağlantıyı bu cihazda açtıysan otomatik giriş yapılacak.
          </AlertDescription>
        </Alert>
      )}

      {tokenFromUrl && (
        <Alert>
          <LinkIcon className="h-4 w-4" />
          <AlertTitle>Bağlantı doğrulandı</AlertTitle>
          <AlertDescription>
            Bu özelliğin tam entegrasyonu Phase 16 ile tamamlanacak.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
