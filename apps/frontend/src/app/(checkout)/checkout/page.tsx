import { Suspense } from "react";

import { CheckoutWizard } from "@/features/checkout/components/CheckoutWizard";

export default function CheckoutPage(): JSX.Element {
  return (
    <Suspense>
      <CheckoutWizard />
    </Suspense>
  );
}
