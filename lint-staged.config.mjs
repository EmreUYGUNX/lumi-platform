const eslintFix = "pnpm exec eslint --cache --cache-location .eslintcache --fix";
const prettierWrite = "pnpm exec prettier --write --ignore-unknown";
const secretlintCheck = "pnpm exec secretlint --maskSecrets";

export default {
  "*.{ts,tsx,js,jsx}": [eslintFix, prettierWrite, secretlintCheck],
  "*.{json,md,yml,yaml}": [prettierWrite, secretlintCheck],
  "*.{env,env.example,env.template,sh,txt,toml}": [secretlintCheck],
  ".env*": [secretlintCheck]
};
