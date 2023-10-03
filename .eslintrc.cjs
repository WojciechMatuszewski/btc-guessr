module.exports = {
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-type-checked",
    "plugin:prettier/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: [
      "./tsconfig.eslint.json",
      "./packages/*/tsconfig.json",
      "./packages/*/tsconfig.node.json",
      "./packages/*/tsconfig.app.json",
      "./packages/*/tsconfig.cypress.e2e.json",
      "./libs/*/tsconfig.json",
    ],
  },
  plugins: ["@typescript-eslint"],
  root: true,
  rules: {
    "prettier/prettier": "error",
  },
};
