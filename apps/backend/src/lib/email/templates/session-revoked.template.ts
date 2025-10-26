import {
  combineTextSections,
  createGreeting,
  formatDateTime,
  renderDetailsSection,
} from "../helpers.js";
import { renderLayout } from "../layout.js";
import type { EmailTemplateDefinition } from "../types.js";

export const sessionRevokedTemplate: EmailTemplateDefinition<"auth.session-revoked"> = {
  id: "auth.session-revoked",
  render: (payload, context) => {
    const subject = `We signed you out of ${context.brand.productName}`;
    const greeting = createGreeting(payload.firstName, context.brand.productName);
    const revokedAt = formatDateTime(payload.revokedAt, context.locale);

    const detailCandidates = [
      { label: "Signed out", value: revokedAt },
      payload.reason ? { label: "Reason", value: payload.reason } : undefined,
      payload.ipAddress ? { label: "Origin IP", value: payload.ipAddress } : undefined,
    ];

    const details = renderDetailsSection(
      detailCandidates.filter(
        (entry): entry is { label: string; value: string } => entry !== undefined,
      ),
    );

    const bodyHtml = [
      greeting.html,
      `<p>Your account was signed out from one or more sessions for security reasons.</p>`,
      details.html,
      `<p>If you initiated this action, no further steps are needed. Otherwise, we recommend resetting your password and reviewing active sessions.</p>`,
    ].join("\n");

    const bodyText = combineTextSections([
      greeting.text,
      "Your account was signed out from one or more sessions for security reasons.",
      details.text,
      "If you initiated this action, no further steps are needed. Otherwise, reset your password and review active sessions.",
    ]);

    return renderLayout({
      subject,
      context,
      bodyHtml,
      bodyText,
      previewText: "We ended one of your active sessions for security.",
    });
  },
};
