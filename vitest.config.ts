import { defineConfig } from "vitest/config";
import path from "path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const packageJson = require("./package.json") as { version: string };

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
  },
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
