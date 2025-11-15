const coverageIgnorePatterns = [
  "/apps/frontend/src/features/media/",
  "/apps/frontend/src/components/ui/image/",
  "/apps/frontend/src/lib/cloudinary\\.ts$",
  "/apps/frontend/src/lib/image-loader\\.ts$"
];

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
  coveragePathIgnorePatterns: coverageIgnorePatterns,
  coverageReporters: ["text-summary", "lcov", "cobertura"],
  coverageDirectory: "<rootDir>/coverage/combined"
};
