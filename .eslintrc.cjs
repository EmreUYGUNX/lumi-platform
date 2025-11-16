const path = require("node:path");

module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    project: [
      "./tsconfig.json",
      "./apps/*/tsconfig.json",
      "./packages/*/tsconfig.json",
      "./packages/*/tsconfig.eslint.json",
      "./tools/tsconfig.json",
      "./prisma/tsconfig.json",
    ],
    tsconfigRootDir: __dirname,
  },
  settings: {
    "import/resolver": {
      typescript: {
        project: [
          "./tsconfig.json",
          "./apps/*/tsconfig.json",
          "./packages/*/tsconfig.json",
          "./packages/*/tsconfig.eslint.json",
          "./tools/tsconfig.json",
          "./prisma/tsconfig.json",
        ],
      },
      node: {
        extensions: [".js", ".jsx", ".ts", ".tsx"],
        version: ">=20.11.0",
      },
    },
    react: {
      version: "detect",
    },
    next: {
      rootDir: ["apps/frontend/"],
    },
  },
  plugins: [
    "@typescript-eslint",
    "import",
    "unused-imports",
    "promise",
    "security",
    "unicorn",
    "sonarjs",
  ],
  extends: [
    "airbnb-base",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/stylistic",
    "plugin:import/typescript",
    "plugin:promise/recommended",
    "plugin:security/recommended",
    "plugin:unicorn/recommended",
    "plugin:sonarjs/recommended",
    "plugin:prettier/recommended",
  ],
  rules: {
    "no-console": ["warn", { allow: ["warn", "error", "info"] }],
    "import/extensions": [
      "error",
      "ignorePackages",
      {
        ts: "never",
        tsx: "never",
        js: "never",
        jsx: "never",
      },
    ],
    "import/order": [
      "error",
      {
        groups: ["builtin", "external", "internal", ["parent", "sibling"], "index"],
        "newlines-between": "always",
        alphabetize: { order: "ignore", caseInsensitive: true },
        pathGroups: [
          { pattern: "react", group: "external", position: "before" },
          { pattern: "next/**", group: "external", position: "after" },
          { pattern: "@lumi/**", group: "internal" },
          { pattern: "@/**", group: "internal" },
        ],
        pathGroupsExcludedImportTypes: ["react"],
      },
    ],
    "import/no-extraneous-dependencies": [
      "error",
      {
        devDependencies: [
          "**/*.test.{ts,tsx}",
          "**/*.spec.{ts,tsx}",
          "**/test/**",
          "**/__tests__/**",
          "tools/**",
          "*.config.{js,cjs,mjs,ts}",
          "*.config.*.ts",
          "scripts/**",
          ".husky/**",
          "jest.*.{ts,tsx}",
          "**/jest.*.{ts,tsx}"
        ],
        optionalDependencies: false,
      },
    ],
    "no-use-before-define": [
      "error",
      {
        functions: false,
        classes: true,
        variables: true,
      },
    ],
    "unused-imports/no-unused-imports": "error",
    "unused-imports/no-unused-vars": [
      "warn",
      {
        args: "after-used",
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        ignoreRestSiblings: true,
      },
    ],
    "unicorn/prefer-module": "off",
    "unicorn/prevent-abbreviations": "off",
    "unicorn/prefer-event-target": "off",
    "unicorn/no-array-for-each": "off",
    "unicorn/filename-case": [
      "error",
      {
        cases: {
          camelCase: true,
          pascalCase: true,
          kebabCase: true,
        },
      },
    ],
    "sonarjs/no-duplicate-string": "warn",
    "import/prefer-default-export": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "@typescript-eslint/no-empty-function": ["warn", { allow: ["arrowFunctions"] }],
    "@typescript-eslint/consistent-type-imports": [
      "error",
      { prefer: "type-imports", fixStyle: "inline-type-imports" },
    ],
  },
  overrides: [
    {
      files: ["apps/backend/**/*.{ts,tsx}"],
      env: { node: true },
      parserOptions: {
        project: [path.join(__dirname, "apps/backend/tsconfig.json")],
      },
      plugins: ["n"],
      extends: ["plugin:n/recommended"],
      rules: {
        "n/no-missing-import": "off",
        "n/no-unsupported-features/es-syntax": "off",
        "n/no-unsupported-features/node-builtins": "off",
      },
    },
    {
      files: ["apps/frontend/**/*.{ts,tsx,js,jsx}"],
      env: { browser: true },
      parserOptions: {
        project: [path.join(__dirname, "apps/frontend/tsconfig.json")],
      },
      plugins: ["react", "react-hooks", "jsx-a11y", "@next/next"],
      extends: [
        "plugin:@next/next/recommended",
        "plugin:react/recommended",
        "plugin:react-hooks/recommended",
        "plugin:jsx-a11y/recommended",
      ],
      rules: {
        "react/react-in-jsx-scope": "off",
        "react/require-default-props": "off",
        "@next/next/no-html-link-for-pages": "off",
      },
    },
    {
      files: ["**/*.config.{js,cjs,mjs,ts}", ".husky/**/*"],
      env: { node: true },
    },
    {
      files: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
      rules: {
        "security/detect-object-injection": "off",
        "sonarjs/no-duplicate-string": "off",
      },
    },
    {
      files: ["prisma/seed.ts"],
      rules: {
        "no-await-in-loop": "off",
        "no-restricted-syntax": "off",
        "sonarjs/cognitive-complexity": "off",
      },
    },
  ],
};
