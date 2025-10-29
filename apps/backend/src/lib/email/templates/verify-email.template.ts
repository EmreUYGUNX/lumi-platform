import {
  combineTextSections,
  createGreeting,
  formatDateTime,
  renderCtaButton,
  renderLink,
} from "../helpers.js";
import { renderLayout } from "../layout.js";
import type { EmailTemplateDefinition } from "../types.js";

export const verifyEmailTemplate: EmailTemplateDefinition<"auth.verify-email"> = {
  id: "auth.verify-email",
  render: (payload, context) => {
    const subject = `Verify your ${context.brand.productName} account`;
    const greeting = createGreeting(payload.firstName, context.brand.productName);
    const expiry = formatDateTime(payload.expiresAt, context.locale);
    const { html: ctaHtml, text: ctaText } = renderCtaButton(
      "Verify email",
      payload.verificationUrl,
    );

    const fallbackHtml = `<p class="muted">If the button doesn't work, copy and paste this URL into your browser: ${renderLink(payload.verificationUrl)}</p>`;
    const fallbackText = `If the button doesn't work, copy this URL into your browser:\n${payload.verificationUrl}`;

    const bodyHtml = [
      greeting.html,
      `<p>Thanks for creating a ${context.brand.productName} account. Before you can sign in, we need to confirm this email address.</p>`,
      `<p><strong>This verification link expires on ${expiry}.</strong></p>`,
      ctaHtml,
      fallbackHtml,
      `<p class="muted">If you did not create this account, you can ignore this message.</p>`,
    ].join("\n");

    const bodyText = combineTextSections([
      greeting.text,
      `Thanks for creating a ${context.brand.productName} account. Before you can sign in, we need to confirm this email address.`,
      `This verification link expires on ${expiry}.`,
      ctaText,
      fallbackText,
      "If you did not create this account, you can ignore this message.",
    ]);

    return renderLayout({
      subject,
      context,
      bodyHtml,
      bodyText,
      previewText: "Confirm your email address to activate your account.",
    });
  },
};
