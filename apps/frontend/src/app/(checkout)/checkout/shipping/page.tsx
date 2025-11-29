import { redirect } from "next/navigation";

export default function CheckoutShippingPage(): never {
  redirect("/checkout?step=shipping");
}
