const eslintFix = "pnpm exec eslint --cache --cache-location .eslintcache --fix";
const prettierWrite = "pnpm exec prettier --write --ignore-unknown";
const secretlintCheck = "node tools/scripts/run-secretlint.js";

export default {
  "*.{ts,tsx}": [eslintFix, prettierWrite, secretlintCheck],
  "*.{js,jsx,mjs,cjs}": [prettierWrite, secretlintCheck],
  "*.{json,md,yml,yaml}": [prettierWrite, secretlintCheck],
  "*.{env,env.example,env.template,sh,txt,toml}": [secretlintCheck],
  ".env*": [secretlintCheck],
};
