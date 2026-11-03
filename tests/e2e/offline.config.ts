/**
 * Playwright config for the offline (service worker) tests. Production dist/ has
 * no published modules, so it builds with the draft fixtures (PREVIEW_DRAFTS=1)
 * into .e2e-dist/ (never dist/) and serves it with `astro preview`.
 *   npm run test:e2e:offline
 */
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.OFFLINE_E2E_PORT ?? 4329);
const DIR = '.e2e-dist';

export default defineConfig({
  testDir: '.',
  testMatch: 'offline.spec.ts',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: { baseURL: `http://localhost:${PORT}/atlante-patologia/` },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  // --ignore-lock: Astro 7 backgrounds `preview` when it detects an AI agent;
  // Playwright must own a foreground process or it reports "exited early".
  webServer: {
    command: `PREVIEW_DRAFTS=1 npx astro build --outDir ${DIR} && npx pagefind --site ${DIR} && node scripts/sw-manifest.mjs ${DIR} && npx astro preview --outDir ${DIR} --port ${PORT} --ignore-lock`,
    cwd: fileURLToPath(new URL('../..', import.meta.url)),
    url: `http://localhost:${PORT}/atlante-patologia/precache.json`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
