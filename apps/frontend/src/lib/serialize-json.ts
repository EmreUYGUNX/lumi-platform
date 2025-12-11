/**
 * Safely serializes JSON for inline <script> tags.
 *
 * Browsers treat U+2028/U+2029 as line terminators inside string literals,
 * which can break JSON-LD/dataLayer scripts and throw "Invalid or unexpected token".
 * We escape them to keep the script valid.
 */
export const serializeJsonForScript = (data: unknown): string =>
  JSON.stringify(data).replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029");
