export const cartKeys = {
  all: () => ["cart"] as const,
  summary: () => [...cartKeys.all(), "summary"] as const,
  items: () => [...cartKeys.summary(), "items"] as const,
  addItem: () => [...cartKeys.items(), "add"] as const,
  updateItem: (itemId: string) => [...cartKeys.items(), "update", itemId] as const,
  removeItem: (itemId: string) => [...cartKeys.items(), "remove", itemId] as const,
  clear: () => [...cartKeys.all(), "clear"] as const,
};
