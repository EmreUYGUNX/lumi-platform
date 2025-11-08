import { orderConfirmationTemplate } from "../order-confirmation.template.js";

const context = {
  brand: {
    productName: "Lumi Commerce",
    supportEmail: "support@example.com",
    supportUrl: "https://support.example.com",
  },
  baseUrl: "https://example.com",
  locale: "en-US",
} as const;

describe("orderConfirmationTemplate", () => {
  it("renders order summaries with items and totals", () => {
    const payload = {
      firstName: "Mina",
      orderReference: "LM-123456",
      status: "confirmed" as const,
      total: { amount: "249.00", currency: "TRY" },
      orderUrl: "https://example.com/orders/LM-123456",
      items: [
        { title: "Aurora Lamp", quantity: 1, total: { amount: "199.00", currency: "TRY" } },
        { title: "Nimbus Shade", quantity: 2, total: { amount: "50.00", currency: "TRY" } },
      ],
    };

    const content = orderConfirmationTemplate.render(payload, context);

    expect(content.subject).toContain(payload.orderReference);
    expect(content.previewText).toContain(payload.orderReference);
    expect(content.html).toContain("Aurora Lamp");
    expect(content.html).toContain("199.00");
    expect(content.html).toContain("View order details");
    expect(content.text).toContain("Order reference");
    expect(content.text).toContain("Aurora Lamp");
    expect(content.text).toContain("Nimbus Shade");
  });

  it("omits CTA when order URL is not provided", () => {
    const payload = {
      firstName: "Kai",
      orderReference: "LM-654321",
      status: "refunded" as const,
      total: { amount: "120.00", currency: "TRY" },
      items: [{ title: "Desk Mat", quantity: 1, total: { amount: "120.00", currency: "TRY" } }],
    };

    const content = orderConfirmationTemplate.render(payload, context);

    expect(content.html).not.toContain("View order details");
    expect(content.text).not.toContain("View order details");
    expect(content.subject).toContain("refunded");
  });
});
