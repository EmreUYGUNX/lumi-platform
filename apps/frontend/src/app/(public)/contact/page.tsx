"use client";

import { zodResolver } from "@hookform/resolvers/zod";
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

const contactSchema = z.object({
  name: z.string().min(2, "Ad en az 2 karakter olmalı."),
  email: z.string().email("Geçerli bir e-posta girin."),
  message: z.string().min(10, "Mesajınız daha fazla detay içermeli."),
});

type ContactValues = z.infer<typeof contactSchema>;

export default function ContactPage(): JSX.Element {
  const form = useForm<ContactValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: "",
      email: "",
      message: "",
    },
  });

  const handleSubmit = (values: ContactValues) => {
    toast({
      title: "We received your note",
      description: `Our partner team will reply to ${values.email} shortly.`,
    });
    form.reset();
  };

  return (
    <div className="container grid gap-10 py-12 lg:grid-cols-2">
      <div className="space-y-4">
        <p className="text-lumi-text-secondary text-sm uppercase tracking-[0.3em]">Contact</p>
        <h1 className="text-3xl font-semibold">Partner with Lumi</h1>
        <p className="text-lumi-text-secondary">
          Tell us about your commerce initiative. We’ll assemble a deployment pod with architects,
          product strategists, and security leads.
        </p>
        <div className="border-lumi-border/70 bg-lumi-bg-secondary/70 rounded-2xl border p-4 text-sm">
          <p className="text-lumi-text font-semibold">Prefer email?</p>
          <p className="text-lumi-text-secondary">enterprise@lumi.com</p>
        </div>
      </div>

      <div className="glass-panel border-lumi-border/70 border p-6">
        <Form {...form}>
          <form className="space-y-6" onSubmit={form.handleSubmit(handleSubmit)}>
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
                    <Input type="email" placeholder="product@lumi.com" {...field} />
                  </FormControl>
                  <FormDescription>We’ll respond within 2 business days.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>How can we help?</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={5}
                      placeholder="Tell us about your goals, KPIs, and timeline…"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="bg-lumi-primary hover:bg-lumi-primary-dark w-full">
              Send request
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
