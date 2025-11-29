import { redirect } from "next/navigation";

export default function CheckoutReviewPage(): never {
  redirect("/checkout?step=review");
}
