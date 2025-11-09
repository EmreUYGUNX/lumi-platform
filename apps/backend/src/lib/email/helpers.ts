/* istanbul ignore file */
/* helper utilities guarded by template snapshot tests */
const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export const escapeHtml = (value: string): string => {
  let result = value;

  Object.entries(HTML_ESCAPES).forEach(([target, replacement]) => {
    result = result.replaceAll(target, replacement);
  });

  return result;
};

export const renderLink = (url: string, label?: string): string => {
  const safeUrl = escapeHtml(url);
  const safeLabel = escapeHtml(label ?? url);
  return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeLabel}</a>`;
};

export const formatDateTime = (input: Date, locale: string): string => {
  const date = input instanceof Date ? input : new Date(input);

  const formatter = new Intl.DateTimeFormat(locale || "en-US", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "UTC",
  });

  return `${formatter.format(date)} UTC`;
};

export interface DetailEntry {
  label: string;
  value: string;
}

export const renderDetailsSection = (entries: DetailEntry[]): { html: string; text: string } => {
  if (entries.length === 0) {
    return { html: "", text: "" };
  }

  const rows = entries
    .map(
      ({ label, value }) => `
        <tr>
          <td class="details-label">${escapeHtml(label)}</td>
          <td class="details-value">${escapeHtml(value)}</td>
        </tr>
      `,
    )
    .join("");

  return {
    html: `<table class="details" role="presentation" cellspacing="0" cellpadding="0">${rows}</table>`,
    text: entries.map(({ label, value }) => `${label}: ${value}`).join("\n"),
  };
};

export const renderCtaButton = (label: string, url: string): { html: string; text: string } => {
  const safeLabel = escapeHtml(label);
  const safeUrl = escapeHtml(url);

  return {
    html: `<div class="cta-wrapper"><a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="cta-button">${safeLabel}</a></div>`,
    text: `${label}: ${url}`,
  };
};

export const createGreeting = (
  firstName: string | null | undefined,
  productName: string,
): { html: string; text: string } => {
  const trimmed = firstName?.trim();
  const greeting = trimmed && trimmed.length > 0 ? `Hi ${trimmed},` : `Hello from ${productName},`;

  return {
    html: `<p class="greeting">${escapeHtml(greeting)}</p>`,
    text: greeting,
  };
};

export const combineTextSections = (sections: (string | undefined)[]): string =>
  sections
    .map((section) => (section ?? "").trim())
    .filter((section) => section.length > 0)
    .join("\n\n");

export const canonicalizeQuery = (url: URL): string => {
  const entries = [...url.searchParams.entries()];
  entries.sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  const canonical = new URLSearchParams(entries);
  canonical.sort();
  return canonical.toString();
};
