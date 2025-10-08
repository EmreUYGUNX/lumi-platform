const path = require("node:path");

const { createProjectJestConfig } = require("../../jest.preset.cjs");

module.exports = createProjectJestConfig({
  displayName: "@lumi/shared",
  projectRoot: __dirname,
  testEnvironment: "node",
  tsconfig: path.join(__dirname, "tsconfig.json"),
  coverageDirectory: path.join(__dirname, "../../coverage/packages/shared")
});
