"use client";

import type { infer as ZodInfer } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  useNewsletterSignup,
  newsletterPayloadSchema,
} from "@/features/homepage/hooks/useNewsletterSignup";
import { toast } from "@/hooks/use-toast";

type NewsletterValues = ZodInfer<typeof newsletterPayloadSchema>;

export function NewsletterSignup(): JSX.Element {
  const form = useForm<NewsletterValues>({
    resolver: zodResolver(newsletterPayloadSchema),
    defaultValues: { email: "" },
  });
  const mutation = useNewsletterSignup();

  const handleSubmit = async (values: NewsletterValues) => {
    try {
      await mutation.mutateAsync(values);
      toast({
        title: "Subscribed to Lumi Dispatch",
        description: `${values.email} kaydedildi.`,
      });
      form.reset();
    } catch (error) {
      toast({
        title: "Subscription failed",
        description: error instanceof Error ? error.message : "Tekrar deneyin.",
        variant: "destructive",
      });
    }
  };

  return (
    <section className="border-lumi-border/60 bg-lumi-bg border-t py-10">
      <div className="container space-y-4 md:flex md:items-center md:justify-between md:space-y-0">
        <div className="space-y-2">
          <p className="text-lumi-text-secondary text-[11px] uppercase tracking-[0.3em]">
            Newsletter
          </p>
          <h2 className="text-lg font-semibold uppercase tracking-[0.22em]">
            Stay in the Lumi circuit
          </h2>
        </div>
        <div className="md:min-w-[420px]">
          <Form {...form}>
            <form
              className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4"
              onSubmit={form.handleSubmit(handleSubmit)}
            >
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="w-full md:flex-1">
                    <FormControl>
                      <Input
                        type="email"
                        inputMode="email"
                        placeholder="you@lumi.com"
                        className="border-lumi-border/70 rounded-none border-0 border-b bg-transparent px-0 text-sm tracking-[0.18em] focus-visible:ring-0"
                        autoComplete="email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                variant="ghost"
                className="text-lumi-text border-b border-white/40 px-0 text-[11px] font-semibold uppercase tracking-[0.32em]"
                disabled={mutation.isPending}
              >
                {mutation.isPending ? "Sending..." : "Subscribe"}
              </Button>
            </form>
          </Form>
          <p className="text-lumi-text-secondary text-[11px] uppercase tracking-[0.16em]">
            By subscribing you agree to our{" "}
            <Link href="/terms" className="underline decoration-1 underline-offset-4">
              privacy policy
            </Link>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
