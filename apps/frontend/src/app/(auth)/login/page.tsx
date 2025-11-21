"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod";

import Link from "next/link";

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
import { toast } from "@/hooks/use-toast";

// Prevent Next from attempting to prerender this client page during build.
export const dynamic = "force-dynamic";
export const revalidate = 0;

const loginSchema = z.object({
  email: z.string().email("Geçerli bir e-posta girin."),
  password: z.string().min(8, "Şifreniz en az 8 karakter olmalı."),
  remember: z.boolean().default(false),
});

type LoginValues = z.infer<typeof loginSchema>;

function handleLoginSubmit(values: LoginValues): void {
  toast({
    title: "Attempted login",
    description: `Auth orchestration is wired in Phase 7. Received ${values.email}.`,
  });
}

export default function LoginPage(): JSX.Element {
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema) as Resolver<LoginValues>,
    defaultValues: {
      email: "",
      password: "",
      remember: false,
    },
  });

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Welcome back</h1>
        <p className="text-lumi-text-secondary text-sm">
          Access the dashboard to orchestrate your commerce stack.
        </p>
      </div>
      <Form {...form}>
        <form className="space-y-5" onSubmit={form.handleSubmit(handleLoginSubmit)}>
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
                  <Input type="password" placeholder="••••••••" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex items-center justify-between text-sm">
            <FormField
              control={form.control}
              name="remember"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-2 space-y-0">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="font-normal">Remember this device</FormLabel>
                </FormItem>
              )}
            />
            <Link href="/forgot-password" className="text-lumi-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <Button type="submit" className="bg-lumi-primary hover:bg-lumi-primary-dark w-full">
            Sign in
          </Button>
        </form>
      </Form>
      <div className="space-y-3">
        <Button type="button" variant="outline" className="w-full justify-center">
          Continue with Google
        </Button>
        <Button type="button" variant="outline" className="w-full justify-center">
          Continue with Apple
        </Button>
      </div>
      <p className="text-lumi-text-secondary text-center text-sm">
        New to Lumi?{" "}
        <Link href="/register" className="text-lumi-primary hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
