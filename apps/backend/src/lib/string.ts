const slugify = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replaceAll(/[^\da-z]+/gu, "-")
    .replaceAll(/(^-|-$)+/gu, "");

const MIN_KEYWORD_LENGTH = 3;
const MAX_KEYWORDS = 50;

const toKeywordToken = (value: string): string[] =>
  value
    .toLowerCase()
    .split(/[\s,/|;:]+/u)
    .map((token) => token.replaceAll(/[^a-z0-9]+/gu, ""))
    .filter((token) => token.length >= MIN_KEYWORD_LENGTH);

export const generateSlug = (value: string): string => slugify(value);

export const deriveSearchKeywords = (
  title: string,
  summary?: string | null,
  explicit?: readonly string[],
): string[] => {
  const keywords = new Set<string>();

  toKeywordToken(title).forEach((token) => keywords.add(token));

  if (summary) {
    toKeywordToken(summary).forEach((token) => keywords.add(token));
  }

  (explicit ?? []).forEach((token) => {
    if (token) {
      toKeywordToken(token).forEach((entry) => keywords.add(entry));
    }
  });

  return [...keywords].slice(0, MAX_KEYWORDS);
};
