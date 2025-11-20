export const cartKeys = {
  all: () => ["cart"] as const,
  summary: () => [...cartKeys.all(), "summary"] as const,
  items: () => [...cartKeys.summary(), "items"] as const,
  addItem: () => [...cartKeys.items(), "add"] as const,
};
