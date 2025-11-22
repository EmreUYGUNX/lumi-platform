"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function BillingPlaceholderPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Billing & invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTitle>Coming soon</AlertTitle>
            <AlertDescription>
              Billing surfaces will be implemented in Phase 10 with subscriptions, invoices, and
              payment methods.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
