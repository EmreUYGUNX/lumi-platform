import { combineTextSections, createGreeting, renderCtaButton, renderLink } from "../helpers.js";
import { renderLayout } from "../layout.js";
import type { EmailTemplateDefinition } from "../types.js";

export const twoFactorSetupTemplate: EmailTemplateDefinition<"auth.two-factor-setup"> = {
  id: "auth.two-factor-setup",
  render: (payload, context) => {
    const subject = `Secure your ${context.brand.productName} account with two-factor authentication`;
    const greeting = createGreeting(payload.firstName, context.brand.productName);
    const { html: ctaHtml, text: ctaText } = renderCtaButton("Set up two-factor", payload.setupUrl);

    const backupCodesHtml = payload.backupCodesUrl
      ? `<p class="muted">Store your backup codes safely: ${renderLink(payload.backupCodesUrl, "Download backup codes")}</p>`
      : "";

    const backupCodesText = payload.backupCodesUrl
      ? `Download your backup codes: ${payload.backupCodesUrl}`
      : undefined;

    const bodyHtml = [
      greeting.html,
      `<p>Two-factor authentication (2FA) adds an extra layer of protection to your ${context.brand.productName} account. It only takes a minute to set up.</p>`,
      `<p>Use the button below to enable 2FA with your authenticator app.</p>`,
      ctaHtml,
      `<p class="muted">You'll be asked to confirm with a code every time you sign in from a new device.</p>`,
      backupCodesHtml,
    ].join("\n");

    const bodyText = combineTextSections([
      greeting.text,
      `Two-factor authentication (2FA) adds an extra layer of protection to your ${context.brand.productName} account. It only takes a minute to set up.`,
      "Use the link below to enable 2FA with your authenticator app.",
      ctaText,
      "You'll be asked to confirm with a code every time you sign in from a new device.",
      backupCodesText,
    ]);

    return renderLayout({
      subject,
      context,
      bodyHtml,
      bodyText,
      previewText: "Protect your account with an authenticator app.",
    });
  },
};
