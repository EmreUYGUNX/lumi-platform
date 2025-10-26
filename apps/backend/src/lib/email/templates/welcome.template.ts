import {
  combineTextSections,
  createGreeting,
  formatDateTime,
  renderCtaButton,
  renderLink,
} from "../helpers.js";
import { renderLayout } from "../layout.js";
import type { EmailTemplateDefinition } from "../types.js";

export const welcomeTemplate: EmailTemplateDefinition<"auth.welcome"> = {
  id: "auth.welcome",
  render: (payload, context) => {
    const subject = `Welcome to ${context.brand.productName}`;
    const greeting = createGreeting(payload.firstName, context.brand.productName);

    const introHtml = `<p>We're excited to have you on board. Your ${context.brand.productName} account is ready.</p>`;
    const introText = `We're excited to have you on board. Your ${context.brand.productName} account is ready.`;

    const verificationHtmlSegments: string[] = [];
    const textSegments: string[] = [];

    if (payload.verificationUrl) {
      const { html: ctaHtml, text: ctaText } = renderCtaButton(
        "Verify email",
        payload.verificationUrl,
      );

      const expiry = payload.expiresAt;
      const expiryText = expiry
        ? `The verification link expires on ${formatDateTime(expiry, context.locale)}.`
        : undefined;

      verificationHtmlSegments.push(
        `<p>Before you get started, please confirm your email address.</p>`,
        ctaHtml,
        `<p class="muted">If the button doesn't work, copy and paste this URL into your browser: ${renderLink(payload.verificationUrl)}</p>`,
      );

      if (expiryText) {
        verificationHtmlSegments.splice(2, 0, `<p><strong>${expiryText}</strong></p>`);
        textSegments.push(expiryText);
      }

      textSegments.push(
        "Before you get started, please confirm your email address.",
        ctaText,
        `If the button doesn't work, copy this URL into your browser:\n${payload.verificationUrl}`,
      );
    }

    const bodyHtml = [
      greeting.html,
      introHtml,
      ...verificationHtmlSegments,
      `<p>Once verified, you can sign in and explore your new dashboard.</p>`,
    ].join("\n");

    const bodyText = combineTextSections([
      greeting.text,
      introText,
      ...textSegments,
      "Once verified, you can sign in and explore your new dashboard.",
    ]);

    return renderLayout({
      subject,
      context,
      bodyHtml,
      bodyText,
      previewText: "Thanks for joining us — let's get you set up.",
    });
  },
};
