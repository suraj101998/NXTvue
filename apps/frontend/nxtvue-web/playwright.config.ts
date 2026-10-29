import { defineConfig } from '@playwright/test'

// Runs against the Vite dev server (which proxies /api to the backend on :8000).
// Uses the installed Google Chrome so no browser download is needed.
export default defineConfig({
  testDir: 'e2e',
  timeout: 45_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:5173',
    channel: 'chrome',
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
