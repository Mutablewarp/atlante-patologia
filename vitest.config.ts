import { defineConfig } from 'vitest/config';

// `npm test` runs the unit project; `npm run test:dist` runs the validators
// that read the built site (they need `npm run build` first).
// Playwright specs (tests/e2e/*.spec.ts) are never collected by Vitest.
export default defineConfig({
  test: {
    projects: [
      { test: { name: 'unit', include: ['tests/*.test.ts', 'tests/content/**/*.test.ts', 'tests/content-one/*.test.ts'] } },
      { test: { name: 'dist', include: ['tests/dist/**/*.test.ts'] } },
    ],
  },
});
