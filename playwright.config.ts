import { defineConfig, devices } from "@playwright/test";

// E2E_BASE_URL lets a second checkout run its own server on another port.
const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:43123";

export default defineConfig({
  testDir: "e2e",
  timeout: 60000,
  use: { baseURL, trace: "retain-on-failure", actionTimeout: 15000 },
  expect: { timeout: 15000 },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }, { name: "mobile", use: { ...devices["Pixel 5"] } }],
  webServer: {
    command:
      process.platform === "win32"
        ? "powershell -NoProfile -Command \"Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue; Remove-Item Env:PRIVILEGED_DATABASE_URL -ErrorAction SilentlyContinue; $env:LOGIN_RATE_LIMIT='500'; npm run dev\""
        : "bash -lc 'unset DATABASE_URL PRIVILEGED_DATABASE_URL; LOGIN_RATE_LIMIT=500 npm run dev'",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
