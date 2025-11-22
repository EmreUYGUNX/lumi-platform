"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useNotificationSettings, useUpdateNotificationSettings } from "../hooks/useNotifications";

const notificationSchema = z.object({
  email: z.object({
    orderUpdates: z.boolean(),
    shipping: z.boolean(),
    marketing: z.boolean(),
    recommendations: z.boolean(),
    newsletter: z.boolean(),
  }),
  push: z.object({
    orderUpdates: z.boolean(),
    priceDrops: z.boolean(),
    backInStock: z.boolean(),
  }),
  sms: z.object({
    orderUpdates: z.boolean(),
    shipping: z.boolean(),
  }),
  frequency: z.enum(["immediate", "daily", "weekly"]),
});

type NotificationFormValues = z.infer<typeof notificationSchema>;

export function NotificationSettings(): JSX.Element {
  const { data, isLoading } = useNotificationSettings();
  const { mutateAsync, isPending } = useUpdateNotificationSettings();

  const form = useForm<NotificationFormValues>({
    resolver: zodResolver(notificationSchema),
    defaultValues: data,
    values: data,
  });

  const handleSubmit = async (values: NotificationFormValues) => {
    await mutateAsync(values);
  };

  const disabled = isLoading || isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <p className="text-lumi-text-secondary text-sm">
          Configure how and when we reach out about your account.
        </p>
      </div>

      <Form {...form}>
        <form className="space-y-6" onSubmit={form.handleSubmit(handleSubmit)} noValidate>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="border-lumi-border/60 space-y-3 rounded-2xl border p-4">
              <p className="text-sm font-semibold">Email notifications</p>
              {(
                ["orderUpdates", "shipping", "marketing", "recommendations", "newsletter"] as const
              ).map((key) => (
                <FormField
                  key={key}
                  control={form.control}
                  name={`email.${key}`}
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(value) => field.onChange(Boolean(value))}
                          disabled={disabled}
                        />
                      </FormControl>
                      <FormLabel className="text-sm font-normal capitalize">{key}</FormLabel>
                    </FormItem>
                  )}
                />
              ))}
            </div>

            <div className="border-lumi-border/60 space-y-3 rounded-2xl border p-4">
              <p className="text-sm font-semibold">Push notifications</p>
              {(["orderUpdates", "priceDrops", "backInStock"] as const).map((key) => (
                <FormField
                  key={key}
                  control={form.control}
                  name={`push.${key}`}
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(value) => field.onChange(Boolean(value))}
                          disabled={disabled}
                        />
                      </FormControl>
                      <FormLabel className="text-sm font-normal capitalize">{key}</FormLabel>
                    </FormItem>
                  )}
                />
              ))}
            </div>
          </div>

          <div className="border-lumi-border/60 space-y-3 rounded-2xl border p-4">
            <p className="text-sm font-semibold">SMS (coming in Phase 12)</p>
            {(["orderUpdates", "shipping"] as const).map((key) => (
              <FormField
                key={key}
                control={form.control}
                name={`sms.${key}`}
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(value) => field.onChange(Boolean(value))}
                        disabled
                      />
                    </FormControl>
                    <FormLabel className="text-sm font-normal capitalize">{key}</FormLabel>
                  </FormItem>
                )}
              />
            ))}
          </div>

          <FormField
            control={form.control}
            name="frequency"
            render={({ field }) => (
              <FormItem className="max-w-md">
                <FormLabel>Notification frequency</FormLabel>
                <FormControl>
                  <Select
                    value={field.value}
                    onValueChange={(value) => field.onChange(value)}
                    defaultValue={field.value}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="immediate">Immediate</SelectItem>
                      <SelectItem value="daily">Daily digest</SelectItem>
                      <SelectItem value="weekly">Weekly summary</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" disabled={disabled}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save preferences"
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
}
