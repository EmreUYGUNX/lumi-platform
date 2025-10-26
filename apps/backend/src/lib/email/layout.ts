import { escapeHtml } from "./helpers.js";
import type { EmailContent, EmailTemplateContext } from "./types.js";

interface RenderLayoutOptions {
  subject: string;
  context: EmailTemplateContext;
  bodyHtml: string;
  bodyText: string;
  previewText?: string;
}

const buildSupportFooter = (context: EmailTemplateContext): { html: string; text: string } => {
  const supportEmail = escapeHtml(context.brand.supportEmail);
  const supportUrl = context.brand.supportUrl ?? context.baseUrl;
  const safeUrl = escapeHtml(supportUrl);

  const html = `
    <p class="support">
      Need help? Email us at <a href="mailto:${supportEmail}">${supportEmail}</a>
      ${supportUrl ? ` or visit <a href="${safeUrl}" target="_blank" rel="noopener noreferrer">our support centre</a>.` : "."}
    </p>
  `;

  const textSupport = supportUrl
    ? `Need help? Contact us at ${context.brand.supportEmail} or visit ${supportUrl}.`
    : `Need help? Contact us at ${context.brand.supportEmail}.`;

  return {
    html,
    text: textSupport,
  };
};

const buildPreheader = (previewText?: string): string => {
  if (!previewText) {
    return "";
  }

  return `<span class="preheader">${escapeHtml(previewText)}</span>`;
};

const buildHtmlDocument = (options: RenderLayoutOptions, supportHtml: string): string => {
  const { subject, context, bodyHtml, previewText } = options;
  const year = new Date().getUTCFullYear();
  const brand = escapeHtml(context.brand.productName);

  return `<!DOCTYPE html>
<html lang="${escapeHtml(context.locale || "en")}">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="x-ua-compatible" content="ie=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
    <style>
      body {
        margin: 0;
        background-color: #f4f4f7;
        color: #111827;
        font-family: "Inter", "Segoe UI", -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
      }

      a {
        color: #2563eb;
      }

      .email-wrapper {
        width: 100%;
        padding: 32px 0;
      }

      .email-content {
        max-width: 640px;
        margin: 0 auto;
        background-color: #ffffff;
        border-radius: 14px;
        box-shadow: 0 20px 45px rgba(15, 23, 42, 0.15);
        overflow: hidden;
      }

      .header {
        background: radial-gradient(circle at top, #1f2937, #111827);
        color: #f9fafb;
        padding: 28px 36px;
        font-size: 22px;
        font-weight: 600;
      }

      .body {
        padding: 36px;
        line-height: 1.7;
        font-size: 16px;
      }

      .body p {
        margin: 0 0 18px;
      }

      .greeting {
        font-weight: 600;
      }

      .cta-wrapper {
        margin: 28px 0;
        text-align: left;
      }

      .cta-button {
        display: inline-block;
        padding: 12px 24px;
        background: linear-gradient(135deg, #2563eb, #4f46e5);
        border-radius: 8px;
        color: #ffffff !important;
        text-decoration: none;
        font-weight: 600;
        box-shadow: 0 10px 25px rgba(37, 99, 235, 0.35);
      }

      .cta-button:hover {
        filter: brightness(1.05);
      }

      .details {
        width: 100%;
        margin: 24px 0;
        border-collapse: collapse;
      }

      .details-label {
        width: 40%;
        color: #6b7280;
        font-weight: 600;
        padding: 6px 0;
        font-size: 14px;
      }

      .details-value {
        color: #111827;
        padding: 6px 0;
        font-size: 14px;
      }

      .muted {
        color: #6b7280;
        font-size: 14px;
      }

      .support {
        color: #6b7280;
        font-size: 14px;
      }

      .footer {
        padding: 28px 36px;
        background-color: #f9fafb;
        text-align: center;
        font-size: 12px;
        color: #9ca3af;
      }

      .preheader {
        display: none !important;
        visibility: hidden;
        opacity: 0;
        height: 0;
        width: 0;
        color: transparent;
        line-height: 0;
        overflow: hidden;
      }
    </style>
  </head>
  <body>
    ${buildPreheader(previewText)}
    <div class="email-wrapper">
      <div class="email-content">
        <div class="header">${brand}</div>
        <div class="body">
          ${bodyHtml}
          ${supportHtml}
        </div>
        <div class="footer">&copy; ${year} ${brand}. All rights reserved.</div>
      </div>
    </div>
  </body>
</html>`;
};

const buildTextDocument = (options: RenderLayoutOptions, supportText: string): string => {
  const segments = [options.bodyText, supportText, `${options.context.brand.productName}`];

  if (options.context.brand.supportUrl ?? options.context.baseUrl) {
    segments.push(options.context.brand.supportUrl ?? options.context.baseUrl);
  }

  return segments
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .join("\n\n");
};

export const renderLayout = (options: RenderLayoutOptions): Omit<EmailContent, "templateId"> => {
  const support = buildSupportFooter(options.context);
  return {
    subject: options.subject,
    html: buildHtmlDocument(options, support.html),
    text: buildTextDocument(options, support.text),
    previewText: options.previewText,
  };
};
