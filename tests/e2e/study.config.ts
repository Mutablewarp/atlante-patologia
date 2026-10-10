/**
 * Playwright config for the study-engine smoke tests. Builds with the draft
 * fixtures (PREVIEW_DRAFTS=1) into .e2e-study-dist/ (never dist/) and serves it
 * with `astro preview`.
 *   npx playwright test -c tests/e2e/study.config.ts
 */
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.STUDY_E2E_PORT ?? 4373);
const DIR = '.e2e-study-dist';
export default defineConfig({
  testDir: '.',
  testMatch: 'study.spec.ts',
  timeout: 30_000,
  retries: 0,
  reporter: 'list',
  use: { baseURL: `http://localhost:${PORT}/atlante-patologia/`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `PREVIEW_DRAFTS=1 npx astro build --outDir ${DIR} && npx astro preview --outDir ${DIR} --port ${PORT} --ignore-lock`,
    cwd: fileURLToPath(new URL('../..', import.meta.url)),
    url: `http://localhost:${PORT}/atlante-patologia/it/`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
