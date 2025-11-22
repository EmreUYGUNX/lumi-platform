"use client";

import { useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { FileText, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { InlineBanner } from "@/components/ui/feedback/InlineBanner";
import { ActivityTimeline } from "@/components/ui/feedback/ActivityTimeline";
import { toast } from "@/hooks/use-toast";
import { logAuditEvent } from "@/lib/auth/audit";

import type { ActivityItem } from "../types";

const consentSchema = z.object({
  marketing: z.boolean(),
  dataProcessing: z.boolean(),
  thirdParty: z.boolean(),
});

type ConsentFormValues = z.infer<typeof consentSchema>;

const consentHistory: ActivityItem[] = [
  {
    id: "consent1",
    title: "Marketing emails enabled",
    description: "User opted in to marketing communications.",
    timestamp: new Date().toISOString(),
    type: "profile",
  },
  {
    id: "consent2",
    title: "Data export completed",
    description: "Export link sent to user.",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    type: "system",
  },
];

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export function ConsentCenter(): JSX.Element {
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const form = useForm<ConsentFormValues>({
    resolver: zodResolver(consentSchema),
    defaultValues: {
      marketing: true,
      dataProcessing: true,
      thirdParty: false,
    },
  });

  const onSubmit = (values: ConsentFormValues) => {
    toast({ title: "Consent updated", description: JSON.stringify(values) });
  };

  const requestExport = async () => {
    setExporting(true);
    await delay(300);
    setExporting(false);
    toast({ title: "Export requested", description: "We will email your data export link." });
    logAuditEvent("data_export");
  };

  const requestDeletion = async () => {
    setDeleting(true);
    await delay(300);
    setDeleting(false);
    toast({
      title: "Deletion requested",
      description: "Support will contact you to confirm account deletion.",
      variant: "destructive",
    });
    logAuditEvent("account_delete_request");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Consent center</CardTitle>
          <CardDescription>Control how we process your personal data.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
              {(["marketing", "dataProcessing", "thirdParty"] as const).map((key) => (
                <FormField
                  key={key}
                  control={form.control}
                  name={key}
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(value) => field.onChange(Boolean(value))}
                        />
                      </FormControl>
                      <FormLabel className="text-sm font-normal capitalize">
                        {key.replaceAll(/([A-Z])/g, " $1")}
                      </FormLabel>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
              <Button type="submit">Save</Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data rights</CardTitle>
          <CardDescription>Export or delete your data per GDPR/KVKK.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Button variant="outline" className="gap-2" onClick={requestExport} disabled={exporting}>
            <FileText className="h-4 w-4" />
            {exporting ? "Requesting..." : "Request data export"}
          </Button>
          <Button
            variant="destructive"
            className="gap-2"
            onClick={requestDeletion}
            disabled={deleting}
          >
            <Trash2 className="h-4 w-4" />
            {deleting ? "Submitting..." : "Request account deletion"}
          </Button>
        </CardContent>
      </Card>

      <InlineBanner
        title="Audit trail"
        description="All consent changes are recorded for compliance."
        variant="info"
      />

      <Card>
        <CardHeader>
          <CardTitle>Consent & audit history</CardTitle>
          <CardDescription>Filter by action type and export when needed.</CardDescription>
        </CardHeader>
        <CardContent>
          <ActivityTimeline
            items={consentHistory.map((item) => ({
              ...item,
              variant: item.type === "security" ? "warning" : "default",
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
