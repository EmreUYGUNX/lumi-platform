import {
  combineTextSections,
  createGreeting,
  formatDateTime,
  renderCtaButton,
  renderLink,
} from "../helpers.js";
import { renderLayout } from "../layout.js";
import type { EmailTemplateDefinition } from "../types.js";

export const passwordResetTemplate: EmailTemplateDefinition<"auth.password-reset"> = {
  id: "auth.password-reset",
  render: (payload, context) => {
    const subject = `Reset your ${context.brand.productName} password`;
    const greeting = createGreeting(payload.firstName, context.brand.productName);
    const expiry = formatDateTime(payload.expiresAt, context.locale);
    const { html: ctaHtml, text: ctaText } = renderCtaButton("Reset password", payload.resetUrl);

    const fallbackHtml = `<p class="muted">If the button doesn't work, copy and paste this URL into your browser: ${renderLink(payload.resetUrl)}</p>`;
    const fallbackText = `If the button doesn't work, copy this URL into your browser:\n${payload.resetUrl}`;

    const bodyHtml = [
      greeting.html,
      `<p>We received a request to reset the password for your ${context.brand.productName} account.</p>`,
      `<p>If you made this request, use the button below to set a new password. The link expires on ${expiry}.</p>`,
      ctaHtml,
      fallbackHtml,
      `<p class="muted">If you didn't request a password reset, you can safely ignore this email.</p>`,
    ].join("\n");

    const bodyText = combineTextSections([
      greeting.text,
      `We received a request to reset the password for your ${context.brand.productName} account.`,
      `If you made this request, use the link below to set a new password. The link expires on ${expiry}.`,
      ctaText,
      fallbackText,
      "If you didn't request a password reset, you can safely ignore this email.",
    ]);

    return renderLayout({
      subject,
      context,
      bodyHtml,
      bodyText,
      previewText: "Use this link to securely reset your password.",
    });
  },
};
