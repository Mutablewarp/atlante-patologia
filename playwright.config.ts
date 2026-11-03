import { defineConfig, devices } from '@playwright/test';

/**
 * E2E on the built site (NAVIGATION_SPEC §7): 3 engines × 5 viewports.
 * Run `npm run build` first; the web server serves dist/ under the GitHub
 * Pages base path with a 404 fallback (scripts/serve-dist.mjs).
 *
 * CI keeps the run short: the full viewport matrix on Chromium, and on
 * Firefox/WebKit only the 375 and 1280 widths and tests tagged @smoke.
 * Locally everything runs; E2E_ENGINES=chromium,webkit limits the engines.
 */
const PORT = Number(process.env.E2E_PORT ?? 47391);
const CI = !!process.env.CI;

export const VIEWPORTS = [
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 },
] as const;

const ENGINES = {
  chromium: devices['Desktop Chrome'],
  firefox: devices['Desktop Firefox'],
  webkit: devices['Desktop Safari'],
} as const;
type Engine = keyof typeof ENGINES;
const wanted = (process.env.E2E_ENGINES?.split(',') ?? Object.keys(ENGINES)) as Engine[];

const projects = wanted.flatMap((engine) =>
  VIEWPORTS.filter((v) => !CI || engine === 'chromium' || v.width === 375 || v.width === 1280).map((viewport) => ({
    name: `${engine}-${viewport.width}`,
    grep: CI && engine !== 'chromium' ? /@smoke/ : undefined,
    use: {
      ...ENGINES[engine],
      viewport,
      // Narrow widths behave like a phone (touch, mobile UA) where the engine supports it.
      ...(viewport.width < 600 && engine !== 'firefox' ? { isMobile: true, hasTouch: true } : {}),
    },
    metadata: { engine, width: viewport.width },
  })),
);

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: CI ? 4 : undefined,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}/atlante-patologia/`,
    trace: 'retain-on-failure',
  },
  projects,
  webServer: {
    command: `node scripts/serve-dist.mjs ${PORT}`,
    url: `http://127.0.0.1:${PORT}/atlante-patologia/it/`,
    // Never attach to a server we did not start: it could be serving another build.
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
