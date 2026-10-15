import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 60000,
  use: { baseURL: "http://127.0.0.1:43123", trace: "retain-on-failure", actionTimeout: 15000 },
  expect: { timeout: 15000 },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }, { name: "mobile", use: { ...devices["Pixel 5"] } }],
  webServer: {
    command:
      process.platform === "win32"
        ? "powershell -NoProfile -Command \"Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue; Remove-Item Env:PRIVILEGED_DATABASE_URL -ErrorAction SilentlyContinue; npm run dev\""
        : "bash -lc 'unset DATABASE_URL PRIVILEGED_DATABASE_URL; npm run dev'",
    url: "http://127.0.0.1:43123",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
