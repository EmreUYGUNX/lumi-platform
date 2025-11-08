import { combineTextSections, createGreeting, renderCtaButton, renderLink } from "../helpers.js";
import { renderLayout } from "../layout.js";
import type { EmailTemplateDefinition } from "../types.js";

const formatItemCount = (count: number): string => (count === 1 ? "1 item" : `${count} items`);

export const cartRecoveryTemplate: EmailTemplateDefinition<"commerce.cart-recovery"> = {
  id: "commerce.cart-recovery",
  render: (payload, context) => {
    const subject = `Your ${context.brand.productName} cart is waiting`;
    const greeting = createGreeting(payload.firstName, context.brand.productName);

    const { html: resumeButtonHtml, text: resumeButtonText } = renderCtaButton(
      "Resume your checkout",
      payload.resumeUrl,
    );

    const totalAmount = `${payload.total.amount} ${payload.total.currency}`;
    const summaryLine = `You left ${formatItemCount(payload.itemCount)} in your cart worth ${totalAmount}.`;

    const bodyHtml = [
      greeting.html,
      `<p>${summaryLine}</p>`,
      `<p>We have reserved your selection for a limited time. Complete your purchase before the items run out of stock.</p>`,
      resumeButtonHtml,
      `<p class="muted">If the button doesn't work, copy and paste this URL into your browser: ${renderLink(payload.resumeUrl)}</p>`,
    ].join("\n");

    const bodyText = combineTextSections([
      greeting.text,
      summaryLine,
      "We have reserved your selection for a limited time. Complete your purchase before the items run out of stock.",
      resumeButtonText,
      `If the button doesn't work, copy this URL into your browser:\n${payload.resumeUrl}`,
    ]);

    return renderLayout({
      subject,
      context,
      bodyHtml,
      bodyText,
      previewText: "Your cart items are still available — complete your order now.",
    });
  },
};
