import { describe, expect, it } from 'vitest';
import { allowed, exceptionFor } from '../scripts/license-scan.mjs';

describe('license allowlist', () => {
  it('reads SPDX expressions', () => {
    expect(allowed('MIT')).toBe(true);
    expect(allowed('MIT*')).toBe(true);
    expect(allowed('(MIT OR CC0-1.0)')).toBe(true);
    expect(allowed('(MIT OR GPL-3.0)')).toBe(true);
    expect(allowed('(MIT AND CC-BY-3.0)')).toBe(false);
    expect(allowed('(MIT AND Zlib)')).toBe(true); // pako via 3Dmol (D050)
    expect(allowed('GPL-3.0')).toBe(false);
    expect(allowed('UNKNOWN')).toBe(false);
  });
  it('only excuses listed packages with their listed license', () => {
    expect(exceptionFor('axe-core', 'MPL-2.0')).toBeTruthy();
    expect(exceptionFor('lightningcss-linux-x64-gnu', 'MPL-2.0')).toBeTruthy();
    expect(exceptionFor('axe-core', 'GPL-3.0')).toBeUndefined();
    expect(exceptionFor('preact', 'MPL-2.0')).toBeUndefined();
  });
});
