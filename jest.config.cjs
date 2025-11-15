const coverageIgnorePatterns = ["[\\\\/]apps[\\\\/]frontend[\\\\/]"];
const includeFrontend = process.env.JEST_EXCLUDE_FRONTEND === "1" ? false : true;

const projects = [
  "<rootDir>/apps/backend/jest.config.cjs",
  "<rootDir>/packages/shared/jest.config.cjs",
  "<rootDir>/packages/ui/jest.config.cjs",
  "<rootDir>/packages/testing/jest.config.cjs",
  ...(includeFrontend ? ["<rootDir>/apps/frontend/jest.config.cjs"] : [])
];

module.exports = {
  projects,
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
  coveragePathIgnorePatterns: coverageIgnorePatterns,
  coverageReporters: ["text-summary", "lcov", "cobertura"],
  coverageDirectory: "<rootDir>/coverage/combined"
};
