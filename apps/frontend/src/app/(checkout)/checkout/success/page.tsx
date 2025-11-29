import { Suspense } from "react";

import { OrderConfirmation } from "@/features/checkout/components/OrderConfirmation";

export default function CheckoutSuccessPage(): JSX.Element {
  return (
    <div className="bg-lumi-bg py-10">
      <div className="container mx-auto max-w-4xl px-4">
        <Suspense>
          <OrderConfirmation />
        </Suspense>
      </div>
    </div>
  );
}
