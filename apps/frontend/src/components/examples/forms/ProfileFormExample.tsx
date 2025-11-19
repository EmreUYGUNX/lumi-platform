"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Sparkles } from "lucide-react";
import type { ControllerRenderProps, Resolver } from "react-hook-form";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

const planOptions = [
  { id: "starter", label: "Starter · Free", description: "Basics for launching a new storefront." },
  {
    id: "growth",
    label: "Growth · $39/mo",
    description: "Automation, analytics, and A/B testing.",
  },
  {
    id: "enterprise",
    label: "Enterprise · Custom",
    description: "Dedicated TAM, SSO, and RBAC at scale.",
  },
] as const;

const profileSchema = z.object({
  fullName: z.string().min(2, { message: "Lütfen en az 2 karakter girin." }),
  email: z.string().email({ message: "Geçerli bir e-posta adresi girin." }),
  bio: z.string().max(280, { message: "Biyografi 280 karakterden uzun olamaz." }).default(""),
  plan: z.enum(["starter", "growth", "enterprise"], { message: "Bir plan seçmeniz gerekiyor." }),
  marketing: z.boolean().default(true),
  updates: z.boolean().default(true),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

function PlanSelect({
  field,
}: {
  field: ControllerRenderProps<ProfileFormValues, "plan">;
}): JSX.Element {
  return (
    <Select onValueChange={field.onChange} defaultValue={field.value}>
      <FormControl>
        <SelectTrigger className="border-lumi-border/70 focus:ring-lumi-primary">
          <SelectValue placeholder="Bir plan seçin" />
        </SelectTrigger>
      </FormControl>
      <SelectContent>
        {planOptions.map((plan) => (
          <SelectItem key={plan.id} value={plan.id}>
            <div className="flex flex-col">
              <span className="text-lumi-text text-sm font-semibold">{plan.label}</span>
              <span className="text-lumi-text-secondary text-xs">{plan.description}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ProfileFormExample(): JSX.Element {
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema) as Resolver<ProfileFormValues>,
    defaultValues: {
      fullName: "Leyla Işık",
      email: "leyla@lumicommerce.com",
      bio: "",
      plan: "growth",
      marketing: true,
      updates: true,
    },
  });
  const remainingCharacters = 280 - (form.watch("bio")?.length ?? 0);

  const handleSubmit = (values: ProfileFormValues): void => {
    toast({
      title: "Profil tercihleriniz kaydedildi",
      description: `${values.fullName} için ${values.plan} planı ve bildirim ayarları senkronize edildi.`,
    });
  };

  return (
    <Card className="glass-panel border-lumi-border/60 shadow-lumi-primary/10 border shadow-lg">
      <CardHeader className="space-y-4">
        <div className="flex items-center gap-3">
          <Badge
            variant="secondary"
            className="bg-lumi-highlight text-lumi-text flex items-center gap-2 text-xs font-semibold uppercase tracking-widest"
          >
            <Sparkles className="text-lumi-primary h-3.5 w-3.5" />
            Lumi Design System
          </Badge>
          <span className="text-lumi-text-secondary text-xs font-medium">Form Showcase</span>
        </div>
        <div>
          <CardTitle className="text-lumi-text text-2xl font-semibold">Profil Tercihleri</CardTitle>
          <CardDescription>
            Zod + React Hook Form + shadcn/ui kombinasyonu ile kurumsal form doğrulamaları ve geri
            bildirim akışı.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pb-6">
        <Form {...form}>
          <form className="space-y-6" onSubmit={form.handleSubmit(handleSubmit)}>
            <div className="grid gap-6 md:grid-cols-2">
              <FormField<ProfileFormValues, "fullName">
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ad Soyad</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Müşteri adı"
                        {...field}
                        className="border-lumi-border/70 focus-visible:ring-lumi-primary"
                      />
                    </FormControl>
                    <FormDescription>
                      Faturalandırma ve bildirimler için kullanılır.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField<ProfileFormValues, "email">
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-posta</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="ornek@lumi.com"
                        {...field}
                        className="border-lumi-border/70 focus-visible:ring-lumi-primary"
                      />
                    </FormControl>
                    <FormDescription>
                      Doğrulama, bildirim ve uyarılar bu adresle paylaşılır.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField<ProfileFormValues, "plan">
              control={form.control}
              name="plan"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Plan</FormLabel>
                  <PlanSelect field={field} />
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField<ProfileFormValues, "bio">
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Marka Özeti</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={4}
                      placeholder="Lumi mağazanızı benzersiz kılan değer teklifini paylaşın..."
                      {...field}
                      className="border-lumi-border/70 focus-visible:ring-lumi-secondary"
                    />
                  </FormControl>
                  <div className="flex items-center justify-between text-xs">
                    <FormDescription>
                      Checkout, onboarding ve CRM noktalarında gösterilir.
                    </FormDescription>
                    <span className="text-lumi-text-secondary">{remainingCharacters} karakter</span>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="border-lumi-border/70 grid gap-4 rounded-lg border border-dashed p-4">
              <FormField<ProfileFormValues, "marketing">
                control={form.control}
                name="marketing"
                render={({ field }) => (
                  <FormItem className="bg-lumi-bg-secondary/40 flex flex-row items-start justify-between rounded-md border border-transparent p-3">
                    <div className="space-y-1">
                      <FormLabel>Akıllı Kampanya Bildirimleri</FormLabel>
                      <FormDescription>
                        Segment bazlı öneriler, dönüşen kampanya raporları ve otomatik AB test
                        sonuçları.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        className="border-lumi-border data-[state=checked]:border-lumi-primary data-[state=checked]:bg-lumi-primary"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField<ProfileFormValues, "updates">
                control={form.control}
                name="updates"
                render={({ field }) => (
                  <FormItem className="border-lumi-border/60 flex flex-row items-center justify-between rounded-md border border-dashed px-4 py-3">
                    <div className="space-y-0.5">
                      <FormLabel>Haftalık Ürün Güncellemeleri</FormLabel>
                      <FormDescription>
                        Performans içgörüleri, yeni özellikler ve bakım bildirimleri.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        className="bg-lumi-border/60 data-[state=checked]:bg-lumi-primary"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="text-lumi-text-secondary flex items-center gap-2 text-sm">
                <CheckCircle2 className="text-lumi-success h-4 w-4" />
                Veriler, Phase 3 güvenlik standartlarına uygun olarak şifrelenir.
              </div>
              <Button className="bg-lumi-primary hover:bg-lumi-primary-dark" type="submit">
                Tercihleri Kaydet
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
