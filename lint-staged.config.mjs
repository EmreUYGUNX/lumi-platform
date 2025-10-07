const eslintFix = "pnpm exec eslint --cache --cache-location .eslintcache --fix";
const prettierWrite = "pnpm exec prettier --write --ignore-unknown";

export default {
  "*.{ts,tsx,js,jsx}": [eslintFix, prettierWrite],
  "*.{json,md,yml,yaml}": [prettierWrite]
};
