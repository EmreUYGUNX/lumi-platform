import { redirect } from "next/navigation";

export default function CheckoutPaymentPage(): never {
  redirect("/checkout?step=payment");
}
