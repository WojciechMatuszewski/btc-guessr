import { defineConfig } from "cypress";
import { outputsToEnv } from "./scripts/outputsToEnv";

outputsToEnv();

export default defineConfig({
  e2e: {
    setupNodeEvents() {},
    baseUrl: "http://localhost:5173",
    specPattern: "cypress/e2e/**/*.spec.ts",
  },
  env: process.env,
});
