import { configDefaults, defineConfig } from 'vitest/config';

// Playwright specs live in tests/e2e and run with `npx playwright test`, not Vitest.
export default defineConfig({
  test: { exclude: [...configDefaults.exclude, 'tests/e2e/**'] },
});
