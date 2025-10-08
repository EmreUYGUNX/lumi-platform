const path = require("node:path");

const { pathsToModuleNameMapper } = require("ts-jest");
const { compilerOptions } = require("./tsconfig.base.json");

const sharedModuleNameMapper =
  compilerOptions?.paths != null
    ? pathsToModuleNameMapper(compilerOptions.paths, {
        prefix: "<rootDir>/",
      })
    : {};

/**
 * Creates a Jest project configuration that aligns with our monorepo structure.
 *
 * @param {object} options
 * @param {string} options.displayName Human readable project label.
 * @param {string} options.projectRoot Absolute path to the project root.
 * @param {string} [options.tsconfig] Absolute path to the tsconfig used for the project.
 * @param {string} [options.testEnvironment='node'] Jest test environment.
 * @param {string[]} [options.setupFiles=[]] Additional setup files relative to the project root.
 * @param {Record<string,string>} [options.moduleNameMapper={}] Module name overrides.
 * @param {string} [options.coverageDirectory] Where project specific coverage should be emitted.
 * @returns {import('@jest/types').Config.InitialOptions}
 */
function createProjectJestConfig({
  displayName,
  projectRoot,
  testEnvironment = "node",
  setupFiles = [],
  moduleNameMapper = {},
  coverageDirectory,
}) {
  const repoRoot = path.resolve(__dirname);
  const projectRelativeRoot = path.relative(repoRoot, projectRoot).replace(/\\/g, "/");
  const coverageLabel = displayName.replace(/[^a-z0-9]/gi, "_");
  const jestTsConfig = path.join(repoRoot, "tsconfig.jest.json");

  return {
    displayName,
    preset: "ts-jest/presets/default-esm",
    rootDir: repoRoot,
    roots: [projectRoot],
    setupFiles: [
      path.join(repoRoot, "jest.polyfills.ts"),
      ...setupFiles.map((filePath) => path.join(projectRoot, filePath)),
    ],
    testEnvironment,
    extensionsToTreatAsEsm: [".ts", ".tsx"],
    transform: {
      "^.+\\.(t|j)sx?$": [
        "ts-jest",
        {
          tsconfig: jestTsConfig,
          useESM: true,
          diagnostics: {
            warnOnly: process.env.CI !== "true",
          },
        },
      ],
    },
    moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
    setupFilesAfterEnv: [
      path.join(repoRoot, "jest.setup.ts"),
      ...setupFiles.map((filePath) => path.join(projectRoot, filePath)),
    ],
    testMatch: [
      `<rootDir>/${projectRelativeRoot}/**/__tests__/**/*.jest.(spec|test).[tj]s?(x)`,
      `<rootDir>/${projectRelativeRoot}/**/*.jest.(spec|test).[tj]s?(x)`,
    ],
    moduleNameMapper: {
      "^@lumi/testing/jest$": path.join(repoRoot, "packages/testing/src/assertions/jest.ts"),
      ...sharedModuleNameMapper,
      ...moduleNameMapper,
      "^(\\.{1,2}/.*)\\.js$": "$1",
    },
    collectCoverageFrom: [
      `<rootDir>/${projectRelativeRoot}/**/*.{ts,tsx}`,
      "!**/*.d.ts",
      "!**/__tests__/**",
      "!**/dist/**",
      "!**/coverage/**",
      `!<rootDir>/${projectRelativeRoot}/.next/**`,
      "!**/*.config.{js,ts,cjs,mjs}",
      "!**/jest.config.cjs",
    ],
    coverageReporters: ["text", "lcov", "cobertura"],
    coverageDirectory: coverageDirectory || path.join(repoRoot, "coverage", coverageLabel),
    coveragePathIgnorePatterns: [
      "/node_modules/",
      "/dist/",
      "/coverage/",
      "/.next/",
      ".config.(js|cjs|mjs|ts)",
      "jest.config.cjs",
    ],
    coverageThreshold: {
      global: {
        branches: 85,
        functions: 85,
        lines: 85,
        statements: 85,
      },
    },
    cacheDirectory: path.join(repoRoot, ".jest-cache", coverageLabel),
    reporters: process.env.CI === "true" ? ["default", "github-actions"] : ["default"],
    testTimeout: testEnvironment === "node" ? 20000 : 30000,
    verbose: false,
  };
}

module.exports = { createProjectJestConfig };
