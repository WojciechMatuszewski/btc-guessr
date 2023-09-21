import { join } from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    root: join(__dirname, ".."),
    setupFiles: [join(__dirname, "./setup.ts")],
  },
});
