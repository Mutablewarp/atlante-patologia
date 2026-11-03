import { defineConfig, devices } from '@playwright/test';

// E2E runs against a production build with draft fixtures (PREVIEW_DRAFTS=1)
// in .e2e-dist/, so the real dist/ never contains fixture pages.
const PORT = 4329;
const DIR = '.e2e-dist';

export default defineConfig({
  testDir: 'tests/e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: `http://localhost:${PORT}/atlante-patologia/` },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  // --ignore-lock: Astro 7 backgrounds `preview` when it detects an AI agent;
  // Playwright must own a foreground process or it reports "exited early".
  webServer: {
    command: `PREVIEW_DRAFTS=1 astro build --outDir ${DIR} && pagefind --site ${DIR} && node scripts/sw-manifest.mjs ${DIR} && astro preview --outDir ${DIR} --port ${PORT} --ignore-lock`,
    url: `http://localhost:${PORT}/atlante-patologia/precache.json`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
