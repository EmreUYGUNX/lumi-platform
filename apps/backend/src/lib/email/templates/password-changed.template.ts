import {
  combineTextSections,
  createGreeting,
  formatDateTime,
  renderDetailsSection,
} from "../helpers.js";
import { renderLayout } from "../layout.js";
import type { EmailTemplateDefinition } from "../types.js";

export const passwordChangedTemplate: EmailTemplateDefinition<"auth.password-changed"> = {
  id: "auth.password-changed",
  render: (payload, context) => {
    const subject = `Your ${context.brand.productName} password was changed`;
    const greeting = createGreeting(payload.firstName, context.brand.productName);
    const changedAt = formatDateTime(payload.changedAt, context.locale);

    const detailsEntries = [{ label: "Changed", value: changedAt }];

    if (payload.ipAddress) {
      detailsEntries.push({ label: "IP address", value: payload.ipAddress });
    }

    const details = renderDetailsSection(detailsEntries);

    const bodyHtml = [
      greeting.html,
      `<p>This is a confirmation that your ${context.brand.productName} password was recently updated.</p>`,
      details.html,
      `<p>If you made this change, no further action is required.</p>`,
      `<p><strong>If you didn't change your password, please reset it immediately and contact support.</strong></p>`,
    ].join("\n");

    const bodyText = combineTextSections([
      greeting.text,
      `This is a confirmation that your ${context.brand.productName} password was recently updated.`,
      details.text,
      "If you made this change, no further action is required.",
      "If you didn't change your password, reset it immediately and contact support.",
    ]);

    return renderLayout({
      subject,
      context,
      bodyHtml,
      bodyText,
      previewText: "Your password was successfully updated.",
    });
  },
};
