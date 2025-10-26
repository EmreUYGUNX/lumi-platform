import {
  combineTextSections,
  createGreeting,
  formatDateTime,
  renderDetailsSection,
} from "../helpers.js";
import { renderLayout } from "../layout.js";
import type { EmailTemplateDefinition } from "../types.js";

export const accountLockedTemplate: EmailTemplateDefinition<"auth.account-locked"> = {
  id: "auth.account-locked",
  render: (payload, context) => {
    const subject = `Your ${context.brand.productName} account is temporarily locked`;
    const greeting = createGreeting(payload.firstName, context.brand.productName);
    const unlockAt = formatDateTime(payload.unlockAt, context.locale);

    const detailCandidates = [
      { label: "Unlocks", value: unlockAt },
      payload.failedAttempts
        ? { label: "Failed attempts", value: String(payload.failedAttempts) }
        : undefined,
      payload.ipAddress ? { label: "Last attempt IP", value: payload.ipAddress } : undefined,
    ];

    const details = renderDetailsSection(
      detailCandidates.filter(
        (entry): entry is { label: string; value: string } => entry !== undefined,
      ),
    );

    const bodyHtml = [
      greeting.html,
      `<p>We detected multiple unsuccessful sign-in attempts on your ${context.brand.productName} account. To protect your data, we've temporarily locked access.</p>`,
      details.html,
      `<p>You can try signing in again after the lockout period shown above.</p>`,
      `<p class="muted">If you believe this is suspicious, reset your password once access is restored.</p>`,
    ].join("\n");

    const bodyText = combineTextSections([
      greeting.text,
      `We detected multiple unsuccessful sign-in attempts on your ${context.brand.productName} account. To protect your data, we've temporarily locked access.`,
      details.text,
      "You can try signing in again after the lockout period shown above.",
      "If you believe this is suspicious, reset your password once access is restored.",
    ]);

    return renderLayout({
      subject,
      context,
      bodyHtml,
      bodyText,
      previewText: "Too many sign-in attempts temporarily locked your account.",
    });
  },
};
