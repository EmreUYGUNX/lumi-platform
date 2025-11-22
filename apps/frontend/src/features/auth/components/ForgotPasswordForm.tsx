"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import { useForgotPassword } from "../hooks/useForgotPassword";
import {
  forgotPasswordFormSchema,
  type ForgotPasswordFormValues,
} from "../schemas/forgot-password.schema";

export function ForgotPasswordForm(): JSX.Element {
  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordFormSchema),
    defaultValues: {
      email: "",
    },
  });

  const { mutateAsync, isPending, isSuccess } = useForgotPassword();

  const handleSubmit = async (values: ForgotPasswordFormValues) => {
    await mutateAsync(values);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link href="/login" className="text-lumi-primary text-sm hover:underline">
          Back to login
        </Link>
        <h1 className="text-2xl font-semibold">Reset your password</h1>
        <p className="text-lumi-text-secondary text-sm">
          We’ll send you a secure link to restore account access.
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
                  <Input type="email" placeholder="ops@lumi.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Sending..." : "Send recovery link"}
          </Button>
        </form>
      </Form>

      {isSuccess && (
        <Alert>
          <AlertTitle>Check your inbox</AlertTitle>
          <AlertDescription>
            If the account exists, we sent a recovery link to your email address.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
