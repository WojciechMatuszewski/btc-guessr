module.exports = {
  root: false,
  env: { browser: true, es2020: true },
  extends: ["plugin:react-hooks/recommended"],
  parser: "@typescript-eslint/parser",
  plugins: ["react-refresh"],
  rules: {
    "react-refresh/only-export-components": [
      "warn",
      { allowConstantExport: true },
    ],
  },
};
