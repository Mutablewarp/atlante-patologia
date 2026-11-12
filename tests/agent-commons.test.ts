// Commons candidate lister (scripts/agent/commons-candidates.mjs): licence screen, field mapping and the request loop,
// all without network. tests/fixtures/commons/search-response.json is one live response (generator=search for
// "coagulative necrosis", 2026-11-12) trimmed to 7 of its 20 pages; the PDF record also lost its Credit and description.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { classifyLicense, parseArgs, parseImageInfo, plain, requestUrl, searchCommons } from '../scripts/agent/commons-candidates.mjs';

const live = JSON.parse(readFileSync(new URL('./fixtures/commons/search-response.json', import.meta.url), 'utf8'));
const page = (index: number) => live.query.pages.find((p: { index: number }) => p.index === index);
const param = (url: string, name: string) => new URL(url).searchParams.get(name);

/** A copy of a fixture page with some extmetadata values replaced. */
function variant(index: number, meta: Record<string, string>) {
  const copy = structuredClone(page(index));
  for (const [key, value] of Object.entries(meta)) copy.imageinfo[0].extmetadata[key] = { value };
  return copy;
}

describe('classifyLicense', () => {
  it.each([
    ['CC BY-SA 4.0', 'CC BY-SA'],
    ['CC BY-SA 2.5', 'CC BY-SA'],
    ['CC-BY-SA-3.0', 'CC BY-SA'],
    ['CC BY-SA 3.0 de', 'CC BY-SA'],
    ['CC BY 4.0', 'CC BY'],
    ['CC BY 2.0', 'CC BY'],
    ['CC0', 'CC0'],
    ['CC0 1.0', 'CC0'],
    ['Public domain', 'public domain'],
    ['PD-old', 'public domain'],
  ])('allows %s', (name, reason) => {
    expect(classifyLicense(name, '')).toEqual({ allowed: true, reason });
  });

  it.each(['CC BY-NC 2.0', 'CC BY-NC-SA 4.0', 'CC BY-ND 2.0', 'CC BY-NC-ND 3.0', 'Educational use only', 'Fair use'])(
    'refuses %s (NC, ND, educational, fair use)',
    (name) => {
      expect(classifyLicense(name, '')).toEqual({ allowed: false, reason: 'NC, ND, educational or fair-use licence' });
    },
  );

  it('refuses a licence that is missing or not in the list', () => {
    expect(classifyLicense('', '')).toEqual({ allowed: false, reason: 'no licence' });
    expect(classifyLicense(undefined)).toEqual({ allowed: false, reason: 'no licence' });
    expect(classifyLicense('GFDL')).toEqual({ allowed: false, reason: 'licence not in the allowed list: GFDL' });
    expect(classifyLicense('Copyrighted free use').allowed).toBe(false);
    expect(classifyLicense('Attribution').allowed).toBe(false);
  });

  it('lets the licence URL veto an NC or ND licence the short name hides', () => {
    expect(classifyLicense('CC BY 2.0', 'https://creativecommons.org/licenses/by-nc/2.0/').allowed).toBe(false);
    expect(classifyLicense('CC BY 2.0', 'https://creativecommons.org/licenses/by/2.0/').allowed).toBe(true);
  });
});

describe('plain', () => {
  it('strips tags, decodes entities and folds white space', () => {
    expect(plain('<a href="x">Yale  Rosen</a> from USA<br />\n<b>H&amp;E</b> &#39;40X&#39; &quot;a&quot; &lt;b&gt; &nbsp;done')).toBe(
      `Yale Rosen from USA H&E '40X' "a" <b> done`,
    );
    expect(plain(undefined)).toBe('');
  });
});

describe('parseImageInfo', () => {
  it('maps a CC BY-SA 4.0 own-work photo, with the file URL free of the tracking query', () => {
    expect(parseImageInfo(page(4))).toEqual({
      title: 'File:Coagulative Necrosis.jpg',
      pageUrl: 'https://commons.wikimedia.org/wiki/File:Coagulative_Necrosis.jpg',
      fileUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/77/Coagulative_Necrosis.jpg',
      width: 2992,
      height: 4000,
      bytes: 836277,
      license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
      author: 'Gnanadeep s',
      credit: 'Own work',
      description: 'Coagulative necrosis is most common type of necrosis.',
      allowed: true,
      reason: 'CC BY-SA',
    });
  });

  it('takes the author out of a link and the credit out of a Flickr link', () => {
    expect(parseImageInfo(page(18))).toMatchObject({
      author: 'Yale Rosen from USA',
      credit: 'Acute infarct',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0',
      allowed: true,
    });
    expect(parseImageInfo(page(9))).toMatchObject({ author: 'Narraburra', license: 'CC0', reason: 'CC0', allowed: true });
  });

  it('keeps public domain without a licence URL, and cuts a long description to 200 characters', () => {
    const row = parseImageInfo(page(11));
    expect(row).toMatchObject({ license: 'Public domain', licenseUrl: '', allowed: true, reason: 'public domain', credit: 'U.S. Geological Survey' });
    expect(row?.description).toHaveLength(200);
    expect(row?.description.endsWith('…')).toBe(true);
    expect(row?.description.startsWith('Photomicrographs from a foothill yellow-legged frog')).toBe(true);
  });

  it('refuses an allowed licence when the author is missing or unknown', () => {
    expect(parseImageInfo(page(6))).toMatchObject({ license: 'CC BY-SA 3.0', author: '', allowed: false, reason: 'missing author' });
    expect(parseImageInfo(variant(4, { Artist: 'Unknown author' }))).toMatchObject({ allowed: false, reason: 'missing author' });
  });

  it('refuses an NC licence, and reports the licence problem before the author problem', () => {
    expect(parseImageInfo(variant(4, { LicenseShortName: 'CC BY-NC 2.0' }))).toMatchObject({ allowed: false, reason: 'NC, ND, educational or fair-use licence' });
    expect(parseImageInfo(variant(6, { LicenseShortName: 'GFDL' }))).toMatchObject({ allowed: false, reason: 'licence not in the allowed list: GFDL' });
  });

  it('returns null for a PDF, a DjVu scan and a page without image data', () => {
    expect(parseImageInfo(page(10))).toBeNull();
    const djvu = structuredClone(page(4));
    djvu.imageinfo[0].mime = 'image/vnd.djvu';
    expect(parseImageInfo(djvu)).toBeNull();
    expect(parseImageInfo({ title: 'File:Gone.jpg', missing: true })).toBeNull();
  });
});

describe('requestUrl', () => {
  it('asks for a search in the File namespace with the image data of each hit', () => {
    const url = requestUrl({ query: 'coagulative necrosis' });
    expect(url.startsWith('https://commons.wikimedia.org/w/api.php?')).toBe(true);
    expect(param(url, 'generator')).toBe('search');
    expect(param(url, 'gsrsearch')).toBe('coagulative necrosis');
    expect(param(url, 'gsrnamespace')).toBe('6');
    expect(param(url, 'prop')).toBe('imageinfo');
    expect(param(url, 'iiprop')).toBe('url|size|mime|extmetadata');
    expect(param(url, 'formatversion')).toBe('2');
  });

  it('limits a search to a category with incategory:, and lists a category when there is no query', () => {
    expect(param(requestUrl({ query: 'gangrene', category: 'Category:Gangrene' }), 'gsrsearch')).toBe('gangrene incategory:"Gangrene"');
    const members = requestUrl({ category: 'Category:Gangrene' });
    expect(param(members, 'generator')).toBe('categorymembers');
    expect(param(members, 'gcmtitle')).toBe('Category:Gangrene');
    expect(param(members, 'gcmtype')).toBe('file');
    expect(param(members, 'gsrsearch')).toBeNull();
  });

  it('adds the continuation of the previous answer', () => {
    const url = requestUrl({ query: 'x' }, { gsroffset: 20, continue: 'gsroffset||' });
    expect(param(url, 'gsroffset')).toBe('20');
    expect(param(url, 'continue')).toBe('gsroffset||');
  });
});

describe('searchCommons', () => {
  const second = {
    batchcomplete: true,
    query: {
      pages: [
        {
          pageid: 9,
          ns: 6,
          title: 'File:Second page.png',
          index: 21,
          imageinfo: [
            {
              size: 1000,
              width: 1000,
              height: 800,
              url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Second_page.png',
              descriptionurl: 'https://commons.wikimedia.org/wiki/File:Second_page.png',
              mime: 'image/png',
              extmetadata: { LicenseShortName: { value: 'CC BY 4.0' }, Artist: { value: 'A. Person' } },
            },
          ],
        },
      ],
    },
  };

  /** Fake network: answers in order, remembers the URLs and the pauses. */
  function fakes(...answers: unknown[]) {
    const urls: string[] = [];
    const pauses: number[] = [];
    const queue = [...answers];
    return {
      urls,
      pauses,
      io: {
        fetchJson: async (url: string) => {
          urls.push(url);
          return queue.shift();
        },
        sleep: async (ms: number) => {
          pauses.push(ms);
        },
      },
    };
  }
  const titles = (rows: { title: string }[]) => rows.map((r) => r.title);

  it('lists the wide images in rank order, follows the continuation after a 1 s pause, and drops PDFs and narrow files', async () => {
    const net = fakes(live, second);
    const rows = await searchCommons({ query: 'coagulative necrosis' }, net.io);
    expect(titles(rows)).toEqual([
      'File:Coagulative Necrosis.jpg',
      'File:Ruptured myocardial infarct.jpg',
      'File:Photomicrographs from a foothill yellow-legged frog (Rana boylii).jpg',
      'File:Leiomyoma with changes secondary to tranexamic acid treatment high magnification.jpg',
      'File:Acute infarct (5917780085).jpg',
      'File:Second page.png',
    ]);
    expect(net.urls).toHaveLength(2);
    expect(param(net.urls[0], 'gsroffset')).toBeNull();
    expect(param(net.urls[1], 'gsroffset')).toBe('20');
    expect(param(net.urls[1], 'continue')).toBe('gsroffset||');
    expect(net.pauses).toEqual([1000]);
  });

  it('stops at the limit without asking for more', async () => {
    const net = fakes(live, second);
    const rows = await searchCommons({ query: 'x', limit: 2 }, net.io);
    expect(titles(rows)).toEqual(['File:Coagulative Necrosis.jpg', 'File:Ruptured myocardial infarct.jpg']);
    expect(net.urls).toHaveLength(1);
    expect(net.pauses).toEqual([]);
  });

  it('keeps narrow images with --min-width 0, still refused when the author is missing, and still no PDF', async () => {
    const rows = await searchCommons({ query: 'x', minWidth: 0 }, fakes(live, { batchcomplete: true }).io);
    expect(rows).toHaveLength(6);
    const small = rows.find((r: { width: number }) => r.width === 500);
    expect(small).toMatchObject({ allowed: false, reason: 'missing author' });
    expect(titles(rows).some((t) => t.endsWith('.pdf'))).toBe(false);
  });

  it('makes at most three requests, one pause between two', async () => {
    const more = { continue: { gsroffset: 50, continue: 'gsroffset||' }, query: { pages: [] } };
    const net = fakes(more, more, more, more);
    expect(await searchCommons({ query: 'x' }, net.io)).toEqual([]);
    expect(net.urls).toHaveLength(3);
    expect(net.pauses).toEqual([1000, 1000]);
  });

  it('reads an answer without pages (an empty category) and reports an API error', async () => {
    expect(await searchCommons({ category: 'Category:Empty' }, fakes({ batchcomplete: true }).io)).toEqual([]);
    await expect(searchCommons({ query: 'x' }, fakes({ error: { code: 'badvalue', info: 'Unrecognized value' } }).io)).rejects.toThrow('badvalue: Unrecognized value');
  });
});

describe('parseArgs', () => {
  it('reads the options and fills the defaults', () => {
    expect(parseArgs(['--query', 'gangrene'])).toEqual({ query: 'gangrene', category: '', limit: 30, minWidth: 800 });
    expect(parseArgs(['--category', 'Category:Gangrene', '--limit', '50', '--min-width', '0'])).toEqual({
      query: '',
      category: 'Category:Gangrene',
      limit: 30,
      minWidth: 0,
    });
  });

  it('refuses a call without a query or a category, and bad numbers', () => {
    expect(() => parseArgs([])).toThrow(/--query/);
    expect(() => parseArgs(['--query', 'x', '--limit', 'many'])).toThrow(/--limit/);
    expect(() => parseArgs(['--query', 'x', '--min-width', '-5'])).toThrow(/--min-width/);
  });
});
