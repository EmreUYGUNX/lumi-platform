export const wishlistKeys = {
  all: () => ["wishlist"] as const,
  list: () => [...wishlistKeys.all(), "list"] as const,
  items: () => [...wishlistKeys.list(), "items"] as const,
  addItem: () => [...wishlistKeys.items(), "add"] as const,
  removeItem: () => [...wishlistKeys.items(), "remove"] as const,
};
