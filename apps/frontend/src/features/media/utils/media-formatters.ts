export const formatFileSize = (bytes: number): string => {
  if (!Number.isFinite(bytes)) {
    return "0 B";
  }

  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${bytes} B`;
};

export const formatIsoDate = (iso: string | Date | undefined): string => {
  if (!iso) {
    return "Unknown";
  }

  const date = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

export const normaliseTagInput = (value: string): string[] =>
  value
    .split(/[\s,]+/u)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => entry.toLowerCase());
