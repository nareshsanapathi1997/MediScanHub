import path from "path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "vitest/config";

loadEnv({ path: ".env.test", override: true });

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    globalSetup: ["./tests/global-setup.ts"],
    fileParallelism: false,
    exclude: ["e2e/**", "node_modules/**", ".next/**"],
    hookTimeout: 180000,
    testTimeout: 60000,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
