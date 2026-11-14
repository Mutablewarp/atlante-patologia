import { describe, expect, it } from 'vitest';
import { execute } from '../scripts/agent/run-stage.mjs';

describe('execute (the wall-clock limit of a stage)', () => {
  it('kills a child that ignores SIGTERM', async () => {
    const started = Date.now();
    const deaf = 'process.on("SIGTERM", () => {}); setInterval(() => {}, 1000);';
    const result = await execute(process.execPath, ['-e', deaf], { timeoutMs: 1500, killAfterMs: 300 });
    const elapsed = Date.now() - started;
    expect(result.status).toBe(124);
    expect(elapsed).toBeGreaterThanOrEqual(1790); // SIGTERM at 1500 ms did not end it; SIGKILL at 1800 ms did
    expect(elapsed).toBeLessThan(8000);
  }, 12_000);

  it('returns the exit code and the output of a child that ends by itself', async () => {
    const result = await execute(process.execPath, ['-e', 'console.log("ok"); process.exit(3);'], { timeoutMs: 5000 });
    expect(result.status).toBe(3);
    expect(result.stdout.trim()).toBe('ok');
  });
});
