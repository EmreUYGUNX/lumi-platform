const path = require("node:path");

const { createProjectJestConfig } = require("../../jest.preset.cjs");

const config = createProjectJestConfig({
  displayName: "@lumi/backend",
  projectRoot: __dirname,
  testEnvironment: "node",
  tsconfig: path.join(__dirname, "tsconfig.json"),
  coverageDirectory: path.join(__dirname, "../../coverage/apps/backend"),
  setupFiles: []
});

config.setupFilesAfterEnv = [
  ...(config.setupFilesAfterEnv || []),
  path.join(__dirname, "src/__tests__/setup.ts")
];

config.collectCoverageFrom = [
  ...(config.collectCoverageFrom || []),
  "!<rootDir>/apps/backend/src/index.ts",
  "!<rootDir>/apps/backend/src/routes/admin.ts",
  "!<rootDir>/apps/backend/src/routes/index.ts",
  "!<rootDir>/apps/backend/src/routes/registry.ts",
  "!<rootDir>/apps/backend/src/modules/auth/auth.controller.ts",
  "!<rootDir>/apps/backend/src/modules/catalog/catalog.controller.ts",
  "!<rootDir>/apps/backend/src/modules/product/product.service.ts",
  "!<rootDir>/apps/backend/src/modules/category/category.repository.ts",
  "!<rootDir>/apps/backend/src/lib/email/helpers.ts",
  "!<rootDir>/apps/backend/src/config/swagger.ts"
];

config.coveragePathIgnorePatterns = [
  ...(config.coveragePathIgnorePatterns || []),
  "<rootDir>/vendor/",
  "<rootDir>/apps/backend/src/lib/prisma/middleware.ts",
  "<rootDir>/apps/backend/src/modules/catalog/catalog.service.ts",
  "<rootDir>/apps/backend/src/modules/catalog/catalog.cache.ts",
  "<rootDir>/apps/backend/src/modules/product/product.repository.ts",
  "<rootDir>/apps/backend/src/routes/",
  "<rootDir>/apps/backend/src/modules/auth/auth.controller.ts",
  "<rootDir>/apps/backend/src/modules/catalog/catalog.controller.ts",
  "<rootDir>/apps/backend/src/modules/product/product.service.ts",
  "<rootDir>/apps/backend/src/modules/category/category.repository.ts",
  "<rootDir>/apps/backend/src/lib/email/helpers.ts",
  "<rootDir>/apps/backend/src/config/swagger.ts"
];

config.transformIgnorePatterns = [
  ...(config.transformIgnorePatterns || []),
  "node_modules/(?!embedded-postgres/|@embedded-postgres/)"
];

config.modulePathIgnorePatterns = [
  ...(config.modulePathIgnorePatterns || []),
  "<rootDir>/apps/frontend/.next",
  "<rootDir>/.next"
];

config.moduleNameMapper = {
  "^@/(.*)\\.js$": "<rootDir>/apps/backend/src/$1.ts",
  ...(config.moduleNameMapper || {}),
  "^@/(.*)$": "<rootDir>/apps/backend/src/$1"
};

module.exports = config;
