import { combineTextSections, createGreeting, renderCtaButton, renderLink } from "../helpers.js";
import { renderLayout } from "../layout.js";
import type { EmailTemplateDefinition } from "../types.js";

const formatMoney = (value: { amount: string; currency: string }): string =>
  `${value.amount} ${value.currency}`;

const STATUS_COPY = {
  confirmed: {
    subject: "Order confirmed",
    body: "Great news! Your order has been confirmed and is now being prepared.",
  },
  updated: {
    subject: "Order updated",
    body: "We have new updates about your order.",
  },
  refunded: {
    subject: "Order refunded",
    body: "A refund has been issued for your order. Please allow a few business days for the amount to appear on your statement.",
  },
} as const;

const renderItemsTable = (
  items: {
    title: string;
    quantity: number;
    total: { amount: string; currency: string };
  }[],
): { html: string; text: string } => {
  if (items.length === 0) {
    return {
      html: "",
      text: "",
    };
  }

  const rows = items
    .map(
      (item) => `
        <tr>
          <td style="padding: 8px 0; font-weight: 600;">${item.title}</td>
          <td style="padding: 8px 0; text-align: center;">${item.quantity}</td>
          <td style="padding: 8px 0; text-align: right;">${formatMoney(item.total)}</td>
        </tr>
      `,
    )
    .join("");

  const html = `
    <table role="presentation" width="100%" style="border-collapse: collapse; margin: 20px 0;">
      <thead>
        <tr>
          <th style="text-align: left; padding-bottom: 8px;">Item</th>
          <th style="text-align: center; padding-bottom: 8px;">Qty</th>
          <th style="text-align: right; padding-bottom: 8px;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;

  const text = items
    .map((item) => `- ${item.title} ×${item.quantity}: ${formatMoney(item.total)}`)
    .join("\n");

  return { html, text };
};

export const orderConfirmationTemplate: EmailTemplateDefinition<"commerce.order-confirmation"> = {
  id: "commerce.order-confirmation",
  render: (payload, context) => {
    const statusCopy = STATUS_COPY[payload.status] ?? STATUS_COPY.confirmed;
    const subject = `${statusCopy.subject} • ${payload.orderReference}`;
    const greeting = createGreeting(payload.firstName, context.brand.productName);
    const itemsSection = renderItemsTable(payload.items);
    const orderTotal = formatMoney(payload.total);
    const deliveryEstimate = payload.estimatedDelivery
      ? `Estimated delivery: ${new Date(payload.estimatedDelivery).toLocaleDateString()}`
      : undefined;

    const actionCta = payload.orderUrl
      ? renderCtaButton("View order details", payload.orderUrl)
      : undefined;

    const sectionsHtml = [
      greeting.html,
      `<p>${statusCopy.body}</p>`,
      `<p><strong>Order reference:</strong> ${payload.orderReference}</p>`,
      `<p><strong>Total:</strong> ${orderTotal}</p>`,
      deliveryEstimate ? `<p>${deliveryEstimate}</p>` : "",
      itemsSection.html,
      actionCta
        ? `
            ${actionCta.html}
            <p class="muted">If the button doesn't work, copy this URL into your browser: ${renderLink(
              payload.orderUrl!,
            )}</p>
          `
        : "",
    ].join("\n");

    const sectionsText = [
      greeting.text,
      statusCopy.body,
      `Order reference: ${payload.orderReference}`,
      `Total: ${orderTotal}`,
      deliveryEstimate ?? "",
      itemsSection.text,
      actionCta
        ? combineTextSections([
            actionCta.text,
            `If the button doesn't work, copy this URL into your browser:\n${payload.orderUrl}`,
          ])
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    return renderLayout({
      subject,
      context,
      bodyHtml: sectionsHtml,
      bodyText: sectionsText,
      previewText: `${statusCopy.subject} for order ${payload.orderReference}`,
    });
  },
};
