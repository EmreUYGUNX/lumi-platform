"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
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
import { toast } from "@/hooks/use-toast";

const newsletterSchema = z.object({
  email: z.string().email("Geçerli bir e-posta adresi girin."),
});

type NewsletterValues = z.infer<typeof newsletterSchema>;

export function NewsletterSignup(): JSX.Element {
  const form = useForm<NewsletterValues>({
    resolver: zodResolver(newsletterSchema),
    defaultValues: {
      email: "",
    },
  });

  const handleSubmit = (values: NewsletterValues) => {
    toast({
      title: "Subscribed to Lumi Dispatch",
      description: `We'll keep ${values.email} updated with platform releases.`,
    });
    form.reset();
  };

  return (
    <section className="bg-gradient-lumi-soft border-lumi-border/60 border-y py-12">
      <div className="container grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-3">
          <p className="text-lumi-text-secondary text-sm uppercase tracking-[0.3em]">Newsletter</p>
          <h2 className="text-lumi-text text-2xl font-semibold">Stay ahead of the roadmap.</h2>
          <p className="text-lumi-text-secondary text-sm">
            Weekly drop of release highlights, architecture notes, and growth playbooks from the
            Lumi studio.
          </p>
          <div className="text-lumi-text-secondary flex items-center gap-2 text-xs">
            <CheckCircle2 className="text-lumi-success h-4 w-4" />
            Zero spam. Unsubscribe anytime.
          </div>
        </div>

        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email address</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="product@lumi.com"
                      className="border-lumi-border/70 focus-visible:ring-lumi-primary"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>We’ll send a verification link to this address.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              className="bg-lumi-primary hover:bg-lumi-primary-dark w-full font-semibold tracking-tight"
            >
              Subscribe
            </Button>
          </form>
        </Form>
      </div>
    </section>
  );
}
