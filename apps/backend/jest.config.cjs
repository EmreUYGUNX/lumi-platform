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

config.collectCoverageFrom = [
  ...(config.collectCoverageFrom || []),
  "!<rootDir>/apps/backend/src/index.ts"
];

module.exports = config;
