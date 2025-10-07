const path = require("node:path");

module.exports = {
  extends: ["../../.eslintrc.cjs", "plugin:@next/next/core-web-vitals"],
  parserOptions: {
    project: path.join(__dirname, "tsconfig.json"),
    tsconfigRootDir: __dirname
  }
};
