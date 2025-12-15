export const customizationKeys = {
  all: ["product-customization"] as const,
  configs: () => [...customizationKeys.all, "config"] as const,
  config: (productId: string) => [...customizationKeys.configs(), productId] as const,
  adminConfigs: () => [...customizationKeys.all, "admin-config"] as const,
  adminConfig: (productId: string) => [...customizationKeys.adminConfigs(), productId] as const,
};
