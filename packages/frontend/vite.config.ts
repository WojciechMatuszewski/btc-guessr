import { defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import react from "@vitejs/plugin-react-swc";
import { outputsToEnv } from "./scripts/outputsToEnv";

outputsToEnv();

export default defineConfig({
  plugins: [react(), nodePolyfills()],
  resolve: {
    alias: [
      /**
       * https://ui.docs.amplify.aws/react/getting-started/troubleshooting#vite
       */
      {
        find: "./runtimeConfig",
        replacement: "./runtimeConfig.browser",
      },
    ],
  },
});
