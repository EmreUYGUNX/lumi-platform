const path = require("node:path");

const { createProjectJestConfig } = require("../../jest.preset.cjs");

module.exports = createProjectJestConfig({
  displayName: "@lumi/ui",
  projectRoot: __dirname,
  testEnvironment: "jsdom",
  tsconfig: path.join(__dirname, "tsconfig.json"),
  coverageDirectory: path.join(__dirname, "../../coverage/packages/ui")
});
