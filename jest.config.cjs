module.exports = {
  projects: [
    "<rootDir>/apps/backend/jest.config.cjs",
    "<rootDir>/apps/frontend/jest.config.cjs",
    "<rootDir>/packages/shared/jest.config.cjs",
    "<rootDir>/packages/ui/jest.config.cjs",
    "<rootDir>/packages/testing/jest.config.cjs"
  ],
  setupFiles: ["<rootDir>/jest.polyfills.ts"],
  collectCoverage: true,
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },
  coverageReporters: ["text-summary", "lcov", "cobertura"],
  coverageDirectory: "<rootDir>/coverage/combined"
};
