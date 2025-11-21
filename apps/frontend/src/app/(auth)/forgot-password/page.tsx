"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";

import Link from "next/link";

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

const forgotSchema = z.object({
  email: z.string().email("Geçerli bir e-posta girin."),
});

type ForgotValues = z.infer<typeof forgotSchema>;

export default function ForgotPasswordPage(): JSX.Element {
  const form = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  });

  const handleSubmit = (values: ForgotValues) => {
    console.info("Forgot password request", values);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link href="/login" className="text-lumi-primary text-sm hover:underline">
          <ArrowLeft className="mr-2 inline h-4 w-4" />
          Back to login
        </Link>
        <h1 className="text-2xl font-semibold">Reset your password</h1>
        <p className="text-lumi-text-secondary text-sm">
          We’ll send you a secure link to restore account access.
        </p>
      </div>
      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="ops@lumi.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full">
            Send recovery link
          </Button>
        </form>
      </Form>
    </div>
  );
}
