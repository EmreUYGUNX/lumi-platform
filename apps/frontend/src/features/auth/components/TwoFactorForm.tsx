"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldCheck } from "lucide-react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

import { useTwoFactor } from "../hooks/useTwoFactor";
import { twoFactorFormSchema, type TwoFactorFormValues } from "../schemas/two-factor.schema";

export function TwoFactorForm(): JSX.Element {
  const form = useForm<TwoFactorFormValues>({
    resolver: zodResolver(twoFactorFormSchema),
    defaultValues: {
      code: "",
      trustDevice: false,
    },
  });

  const { mutate, isPending } = useTwoFactor();

  const handleSubmit = (values: TwoFactorFormValues) => {
    mutate(values);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Two-step verification</h1>
        <p className="text-lumi-text-secondary text-sm">
          Enter the 6-digit code from your authenticator app.
        </p>
      </div>
      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)} noValidate>
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Verification code</FormLabel>
                <FormControl>
                  <Input
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    {...field}
                    onChange={(event) => field.onChange(event.target.value.replaceAll(/\D/g, ""))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="trustDevice"
            render={({ field }) => (
              <FormItem className="flex items-center gap-2 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={(value) => field.onChange(Boolean(value))}
                  />
                </FormControl>
                <FormLabel className="text-sm font-normal">Trust this device for 30 days</FormLabel>
              </FormItem>
            )}
          />
          <div className="flex items-center justify-between text-sm">
            <a href="/backup-codes" className="text-lumi-primary hover:underline">
              Use a backup code
            </a>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Verifying..." : "Verify"}
            </Button>
          </div>
        </form>
      </Form>
      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Roadmap</AlertTitle>
        <AlertDescription>
          2FA uçtan uca entegrasyon Phase 16&apos;da devreye alınacak. Bu ekran şimdilik yer tutucu.
        </AlertDescription>
      </Alert>
    </div>
  );
}
