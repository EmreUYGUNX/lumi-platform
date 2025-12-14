export const customizationKeys = {
  all: ["product-customization"] as const,
  configs: () => [...customizationKeys.all, "config"] as const,
  config: (productId: string) => [...customizationKeys.configs(), productId] as const,
};
