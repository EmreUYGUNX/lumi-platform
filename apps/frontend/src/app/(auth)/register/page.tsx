"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import Link from "next/link";
import { useRouter } from "next/navigation";

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

const registerSchema = z
  .object({
    name: z.string().min(2, "Adınız en az 2 karakter olmalı."),
    email: z.string().email("Geçerli bir e-posta girin."),
    password: z.string().min(8, "Şifreniz en az 8 karakter olmalı."),
    agree: z.boolean().refine((value) => value, {
      message: "Şartları kabul etmelisiniz.",
    }),
  })
  .required();

type RegisterValues = z.infer<typeof registerSchema>;

export default function RegisterPage(): JSX.Element {
  const router = useRouter();
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      agree: false,
    },
  });

  const handleSubmit = (values: RegisterValues) => {
    console.info("Registration payload (Phase 7 wires to API)", values);
    router.push("/login");
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
        <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
          <FormField
            control={form.control}
            name="name"
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
                  <Input type="password" placeholder="••••••••" {...field} />
                </FormControl>
                <FormDescription>
                  At least 1 uppercase, 1 lowercase, 1 number, 1 symbol.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="agree"
            render={({ field }) => (
              <FormItem className="border-lumi-border/70 flex flex-row items-start gap-3 space-y-0 rounded-lg border p-3">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <div className="space-y-1">
                  <FormLabel>Agree to Terms</FormLabel>
                  <FormDescription>
                    I confirm that I have read and agree to the{" "}
                    <a href="/terms" className="text-lumi-primary">
                      terms & privacy policy
                    </a>
                    .
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />
          <Button type="submit" className="bg-lumi-primary hover:bg-lumi-primary-dark w-full">
            Create account
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
