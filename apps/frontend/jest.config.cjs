const path = require("node:path");

const { createProjectJestConfig } = require("../../jest.preset.cjs");

module.exports = createProjectJestConfig({
  displayName: "@lumi/frontend",
  projectRoot: __dirname,
  testEnvironment: "jsdom",
  tsconfig: path.join(__dirname, "tsconfig.json"),
  moduleNameMapper: {
    "^@/(.*)$": path.join(__dirname, "src", "$1"),
  },
  coverageDirectory: path.join(__dirname, "../../coverage/apps/frontend"),
  setupFiles: []
});
