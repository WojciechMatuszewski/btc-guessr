/// <reference types="vitest" />

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
  optimizeDeps: {
    include: ["@btc-guessr/transport"],
  },
  build: {
    rollupOptions: {
      /**
       * https://github.com/vitejs/vite-plugin-react/issues/137
       */
      onLog: (level, log, defaultHandler) => {
        if (
          log.code === "MODULE_LEVEL_DIRECTIVE" &&
          log.message.includes("use client")
        ) {
          return;
        }

        defaultHandler(level, log);
      },
    },
    commonjsOptions: {
      include: [/transport/, /node_modules/],
    },
  },
  test: {
    setupFiles: ["./test/setup.ts"],
    environment: "jsdom",
  },
});
