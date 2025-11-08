import { describe, expect, it } from "@jest/globals";

import { cartRecoveryTemplate } from "../cart-recovery.template.js";

const baseContext = {
  brand: {
    productName: "Lumi",
    supportEmail: "support@lumi.test",
    supportUrl: "https://lumi.test/support",
  },
  baseUrl: "https://lumi.test",
  locale: "en-US",
} as const;

describe("cartRecoveryTemplate", () => {
  it("renders recovery content for a single cart item", () => {
    const payload = {
      firstName: "Lumi",
      cartId: "cart-1",
      resumeUrl: "https://lumi.test/cart/resume",
      itemCount: 1,
      total: { amount: "125.00", currency: "TRY" },
    } as const;

    const email = cartRecoveryTemplate.render(payload, baseContext);

    expect(email.subject).toBe("Your Lumi cart is waiting");
    expect(email.html).toContain("1 item");
    expect(email.html).toContain(payload.resumeUrl);
    expect(email.text).toContain("1 item");
  });

  it("formats multi-item carts with pluralised descriptions", () => {
    const payload = {
      cartId: "cart-2",
      resumeUrl: "https://lumi.test/cart/resume",
      itemCount: 3,
      total: { amount: "299.00", currency: "TRY" },
    } as const;

    const email = cartRecoveryTemplate.render(payload, baseContext);

    expect(email.html).toContain("3 items");
    expect(email.text).toContain("3 items");
    expect(email.previewText).toBe(
      "Your cart items are still available — complete your order now.",
    );
  });
});
