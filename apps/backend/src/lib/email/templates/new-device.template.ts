import {
  combineTextSections,
  createGreeting,
  formatDateTime,
  renderDetailsSection,
  renderLink,
} from "../helpers.js";
import { renderLayout } from "../layout.js";
import type { EmailTemplateDefinition } from "../types.js";

export const newDeviceTemplate: EmailTemplateDefinition<"auth.new-device"> = {
  id: "auth.new-device",
  render: (payload, context) => {
    const subject = `New sign-in to your ${context.brand.productName} account`;
    const greeting = createGreeting(payload.firstName, context.brand.productName);
    const signedInAt = formatDateTime(payload.time, context.locale);

    const detailCandidates = [
      { label: "Device", value: payload.deviceSummary },
      { label: "Signed in", value: signedInAt },
      payload.location ? { label: "Location", value: payload.location } : undefined,
      payload.ipAddress ? { label: "IP address", value: payload.ipAddress } : undefined,
    ];

    const details = renderDetailsSection(
      detailCandidates.filter(
        (entry): entry is { label: string; value: string } => entry !== undefined,
      ),
    );

    const securityAdviceHtml = `<p>If this was you, you can safely ignore this message. If you don't recognise this sign-in, <strong>reset your password immediately</strong> and review your active sessions.</p>`;
    const securityAdviceText =
      "If this was you, you can ignore this message. If you don't recognise this sign-in, reset your password immediately and review your active sessions.";

    const manageSessionsUrl = `${context.baseUrl.replace(/\/$/, "")}/security/sessions`;
    const manageSessionsText = `Manage sessions: ${manageSessionsUrl}`;

    const bodyHtml = [
      greeting.html,
      `<p>We noticed a new sign-in to your ${context.brand.productName} account.</p>`,
      details.html,
      securityAdviceHtml,
      `<p class="muted">Manage your active sessions: ${renderLink(manageSessionsUrl, "View sessions")}</p>`,
    ].join("\n");

    const bodyText = combineTextSections([
      greeting.text,
      `We noticed a new sign-in to your ${context.brand.productName} account.`,
      details.text,
      securityAdviceText,
      manageSessionsText,
    ]);

    return renderLayout({
      subject,
      context,
      bodyHtml,
      bodyText,
      previewText: "A new device just accessed your account.",
    });
  },
};
