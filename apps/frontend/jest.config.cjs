const path = require("node:path");

const { createProjectJestConfig } = require("../../jest.preset.cjs");

const coverageExcludes = [
  "/src/features/media/",
  "/src/components/ui/image/",
  "/src/lib/cloudinary\\.ts$",
  "/src/lib/image-loader\\.ts$"
];

module.exports = createProjectJestConfig({
  displayName: "@lumi/frontend",
  projectRoot: __dirname,
  testEnvironment: "jsdom",
  tsconfig: path.join(__dirname, "tsconfig.json"),
  moduleNameMapper: {
    "^@/(.*)$": path.join(__dirname, "src", "$1"),
    "^@config/(.*)$": path.join(__dirname, "../../config", "$1"),
    "\\.(css|scss|sass)$": "identity-obj-proxy",
    "^next/font/(.*)$": path.join(__dirname, "__mocks__", "next", "font", "$1.ts"),
  },
  coverageDirectory: path.join(__dirname, "../../coverage/apps/frontend"),
  setupFiles: [],
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/__tests__/**/*",
    "!src/features/media/**/*",
    "!src/components/ui/image/**/*",
    "!src/lib/cloudinary.ts",
    "!src/lib/image-loader.ts"
  ],
  coveragePathIgnorePatterns: coverageExcludes
});
