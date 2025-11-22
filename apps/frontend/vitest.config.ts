/* eslint-disable import/no-extraneous-dependencies */
import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: path.join(__dirname, "vitest.setup.tsx"),
    include: ["__tests__/**/*.{test,spec}.{ts,tsx}", "src/**/*.{test,spec}.{ts,tsx}"],
    alias: {
      "@": path.join(__dirname, "src"),
      "@lumi/shared": path.join(__dirname, "..", "..", "packages", "shared", "src"),
      "@lumi/types": path.join(__dirname, "..", "..", "packages", "types", "src"),
      "@lumi/ui": path.join(__dirname, "..", "..", "packages", "ui", "src"),
    },
    coverage: {
      provider: "istanbul",
      reporter: ["text", "lcov"],
      reportsDirectory: path.join(__dirname, "..", "..", "coverage", "apps", "frontend"),
      extension: [".ts", ".tsx"],
      include: [
        "src/components/ui/button.tsx",
        "src/components/ui/form.tsx",
        "src/components/ui/navigation-menu.tsx",
        "src/components/ui/dialog.tsx",
        "src/components/ui/toast.tsx",
        "src/components/theme/ThemeToggle.tsx",
        "src/hooks/use-toast.ts",
        "src/lib/api-client.ts",
        "src/features/products/hooks/useProducts.ts",
        "src/app/(auth)/**/*.tsx",
        "src/app/(dashboard)/dashboard/layout.tsx",
      ],
      all: false,
      thresholds: {
        lines: 85,
        statements: 85,
        functions: 85,
        branches: 80,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.join(__dirname, "src"),
      "@lumi/shared": path.join(__dirname, "..", "..", "packages", "shared", "src"),
      "@lumi/types": path.join(__dirname, "..", "..", "packages", "types", "src"),
      "@lumi/ui": path.join(__dirname, "..", "..", "packages", "ui", "src"),
    },
  },
});
