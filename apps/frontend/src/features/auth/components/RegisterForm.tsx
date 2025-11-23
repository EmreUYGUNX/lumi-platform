"use client";

import { useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { PasswordStrength } from "./PasswordStrength";
import { useRegister } from "../hooks/useRegister";
import { registerFormSchema, type RegisterFormValues } from "../schemas/register.schema";

const checkboxContainer = (checked: boolean) =>
  cn(
    "flex flex-row items-start gap-3 rounded-lg border p-3 text-sm transition-colors",
    checked
      ? "border-lumi-primary/50 bg-lumi-primary/5 shadow-sm"
      : "border-transparent bg-transparent",
  );

export function RegisterForm(): JSX.Element {
  const [passwordPreview, setPasswordPreview] = useState("");
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      acceptTerms: false,
      marketingConsent: false,
    },
    mode: "onBlur",
  });

  const { mutateAsync, isPending } = useRegister();

  const handleSubmit = async (values: RegisterFormValues) => {
    await mutateAsync(values);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Create your Lumi account</h1>
        <p className="text-lumi-text-secondary text-sm">
          Provisioned tenants include access to dashboard, admin, and media pipelines.
        </p>
      </div>

      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)} noValidate>
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full name</FormLabel>
                <FormControl>
                  <Input placeholder="Leyla Işık" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

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

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    autoComplete="new-password"
                    {...field}
                    onChange={(event) => {
                      field.onChange(event);
                      setPasswordPreview(event.target.value);
                    }}
                  />
                </FormControl>
                <FormDescription>
                  At least 1 uppercase, 1 lowercase, 1 number, 1 symbol.
                </FormDescription>
                <PasswordStrength value={passwordPreview || field.value} />
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

          <FormField
            control={form.control}
            name="acceptTerms"
            render={({ field }) => (
              <FormItem className={checkboxContainer(field.value)}>
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={(value) => field.onChange(Boolean(value))}
                  />
                </FormControl>
                <div className="space-y-1 leading-tight">
                  <FormLabel className="text-sm font-semibold">Terms & privacy</FormLabel>
                  <FormDescription className="text-xs">
                    I confirm that I have read and agree to the{" "}
                    <a href="/terms" className="text-lumi-primary">
                      terms & privacy policy
                    </a>
                    .
                  </FormDescription>
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="marketingConsent"
            render={({ field }) => (
              <FormItem className={checkboxContainer(field.value)}>
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={(value) => field.onChange(Boolean(value))}
                  />
                </FormControl>
                <div className="space-y-1 leading-tight">
                  <FormLabel className="text-sm font-semibold">Stay in the loop</FormLabel>
                  <FormDescription className="text-xs">
                    Send me product updates and onboarding tips.
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="bg-lumi-primary hover:bg-lumi-primary-dark w-full"
            disabled={isPending}
          >
            {isPending ? "Creating..." : "Create account"}
          </Button>
        </form>
      </Form>
      <p className="text-lumi-text-secondary text-center text-sm">
        Already using Lumi?{" "}
        <Link href="/login" className="text-lumi-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
