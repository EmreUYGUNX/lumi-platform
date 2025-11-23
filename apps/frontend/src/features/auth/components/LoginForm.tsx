"use client";

import { useMemo, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { Route } from "next";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { Checkbox } from "@/components/ui/checkbox";
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
import { cn } from "@/lib/utils";

import { SocialLoginButtons } from "./SocialLoginButtons";
import { useLogin } from "../hooks/useLogin";
import { loginFormSchema, type LoginFormValues } from "../schemas/login.schema";

export function LoginForm(): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callback = searchParams?.get("next") ?? undefined;
  const callbackRoute = callback && callback.startsWith("/") ? (callback as Route) : undefined;
  const [showPassword, setShowPassword] = useState(false);

  const defaultEmail = useMemo(() => searchParams?.get("email") ?? "", [searchParams]);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: defaultEmail,
      password: "",
      rememberMe: true,
    },
    mode: "onBlur",
  });

  const { mutateAsync, isPending } = useLogin();

  const handleSubmit = async (values: LoginFormValues) => {
    await mutateAsync(values);
    if (callbackRoute) {
      router.replace(callbackRoute);
    } else {
      router.replace("/dashboard");
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Welcome back</h1>
        <p className="text-lumi-text-secondary text-sm">
          Access the dashboard to orchestrate your commerce stack.
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
                  <Input
                    {...field}
                    type="email"
                    placeholder="founder@lumi.com"
                    autoComplete="email"
                  />
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
                <div className="flex items-center justify-between">
                  <FormLabel>Şifre</FormLabel>
                  <button
                    type="button"
                    className="text-lumi-text-secondary text-xs underline-offset-2 hover:underline"
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    {showPassword ? "Gizle" : "Göster"}
                  </button>
                </div>
                <FormControl>
                  <Input
                    {...field}
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex items-center justify-between text-sm">
            <FormField
              control={form.control}
              name="rememberMe"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(value) => field.onChange(Boolean(value))}
                    />
                  </FormControl>
                  <FormLabel className="text-sm font-normal">Remember this device</FormLabel>
                </FormItem>
              )}
            />
            <Link href="/forgot-password" className="text-lumi-primary hover:underline">
              Forgot password?
            </Link>
          </div>

          <Button
            type="submit"
            className="bg-lumi-primary hover:bg-lumi-primary-dark w-full"
            disabled={isPending}
          >
            {isPending ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </Form>
      <SocialLoginButtons />
      <p className="text-lumi-text-secondary text-center text-sm">
        New to Lumi?{" "}
        <Link href="/register" className={cn("text-lumi-primary hover:underline")}>
          Create an account
        </Link>
      </p>
    </div>
  );
}
