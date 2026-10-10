import { describe, expect, it } from 'vitest';
import { checkFiles } from '../scripts/guard.mjs';

describe('containment guard', () => {
  it('flags any path under reference/, .work/ or private/', () => {
    const problems: string[] = checkFiles([
      { path: 'reference/book.txt', size: 10 },
      { path: '.work/fulltext.txt', size: 10 },
      { path: 'private/notes.md', size: 10 },
    ]);
    expect(problems).toHaveLength(3);
    expect(problems[0]).toMatch(/reference\//);
  });

  it('flags a book-format file over 100 KB but allows small ones', () => {
    expect(checkFiles([{ path: 'docs/scan.pdf', size: 150 * 1024 }])).toHaveLength(1);
    expect(checkFiles([{ path: 'docs/tiny.pdf', size: 20 * 1024 }])).toHaveLength(0);
    expect(checkFiles([{ path: 'x/Book.EPUB', size: 2 * 1024 * 1024 }])[0]).toMatch(/limit/);
  });

  it('flags any file over 10 MB', () => {
    expect(checkFiles([{ path: 'src/assets/huge.png', size: 11 * 1024 * 1024 }])).toHaveLength(1);
  });

  it('passes ordinary source files, including names that merely contain the words', () => {
    expect(
      checkFiles([
        { path: 'src/lib/url.ts', size: 2000 },
        { path: 'docs/reference-notes.md', size: 100 },
        { path: 'src/private-ish.ts', size: 100 },
      ]),
    ).toEqual([]);
  });
});
