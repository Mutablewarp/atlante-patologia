// WHO watch (scripts/who-watch.mjs): parsers on handwritten fixtures, diff, dedup, issue bodies.
// No network: every fetch goes through an injected function that serves tests/fixtures/who-watch/.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BASELINE,
  SOURCES,
  brokenIssue,
  changeIssue,
  corrigendaSources,
  decode,
  diff,
  editionOf,
  fingerprint,
  isoWeek,
  modulesFor,
  parseCatalogue,
  parseCorrigenda,
  parseIcd11,
  parseMonographs,
  parseOnlineVolumes,
  parsePubmed,
  parseRss,
  plan,
  publish,
  readAll,
  toBaseline,
} from '../scripts/who-watch.mjs';

const fx = (name: string) => readFileSync(new URL(`fixtures/who-watch/${name}`, import.meta.url), 'utf8');
const source = (id: string) => SOURCES.find((s: { id: string }) => s.id === id)!;
const ctx = { date: '2026-11-03', runUrl: 'https://example.org/run/1', week: '2026-W45' };

describe('parsers', () => {
  it('catalogue: slug → edition, title, year, status; skips incomplete items', () => {
    expect(parseCatalogue(fx('catalogue.html'))).toEqual({
      'Alpha-Tumours-2026': '6th Edition, Volume 1 | Alpha & Beta Tumours | 2026 | current',
      'Alpha-Tumours-2019': '5th Edition, Volume 1 | Alpha Tumours | 2019 | new edition available',
      'Old-Alpha-Tumours-2016': 'Revised 4th Edition, Volume 1 | Old Alpha Tumours | 2016 | new edition available',
    });
    expect(parseCatalogue('<html>maintenance</html>')).toEqual({});
  });
  it('edition numbers: only plain "Nth Edition" counts', () => {
    expect([editionOf('6th Edition, Volume 1 | x'), editionOf('5th Edition | x'), editionOf('Revised 4th Edition | x')]).toEqual([6, 5, undefined]);
  });
  it('corrigenda: decoded, sorted PDF names from the Corrigenda tab only, or "none"', () => {
    expect(parseCorrigenda(fx('volume-with-corrigenda.html'))).toEqual({ corrigenda: 'Zeta Corrigenda_2025-01-02.pdf, alpha_corrigenda.pdf' });
    expect(parseCorrigenda(fx('volume-no-corrigenda.html'))).toEqual({ corrigenda: 'none' });
    expect(parseCorrigenda('<div id="errata"><p>something new</p></div>')).toEqual({});
    expect(parseCorrigenda('<p>no tab</p>')).toEqual({});
  });
  it('online volumes: bluebooks array only (not cytopath, not commented lines)', () => {
    expect(parseOnlineVolumes(fx('bbdata.js'))).toEqual({
      'Alpha Tumours (6th ed.)': 'Beta version ahead of print | not in print',
      'Gamma Tumours (6th ed.)': 'no beta label | in print',
    });
    expect(parseOnlineVolumes('//bluebooks = []')).toEqual({});
  });
  it('topic feed: guid → title, decoded, filtered to classification news', () => {
    expect(source('news').parse(fx('topic-feed.xml'))).toEqual({
      'https://example.org/?post_type=news-events&p=101': 'Publication of the WHO Classification of Tumours, 6th Edition, Volume 9: Alpha Tumours',
      'https://example.org/?post_type=news-events&p=103': 'ICD-O tables & notes',
    });
  });
  it('IRIS feed: handle link → title (items without guid use <link>)', () => {
    expect(parseRss(fx('iris.xml'))).toEqual({
      'https://iris.example.org/handle/10665/1': 'Example guidelines on tuberculosis: module 9',
      'https://iris.example.org/handle/10665/2': 'Example guideline on malaria, 1 January 2026',
    });
  });
  it('Monographs last update, ICD-11 release, PubMed ids', () => {
    expect(parseMonographs(fx('monographs.html'))).toEqual({ 'last-update': '1 January 2026' });
    expect(parseMonographs('<p>nothing</p>')).toEqual({});
    expect(parseIcd11('https://icd.who.int/browse/2027-01/mms/en')).toEqual({ release: '2027-01' });
    expect(parseIcd11('https://icd.who.int/error')).toEqual({});
    expect(parsePubmed(fx('esearch.json'))).toEqual({ '11111111': '', '22222222': '' });
  });
  it('decodes numeric, hex and named entities and CDATA', () => {
    expect(decode('A &#8211; B &#x2019; &amp; <![CDATA[C]]>  D')).toBe('A – B ’ & C D');
  });
});

describe('diff and fingerprints', () => {
  const list = { id: 'catalogue' };
  const feed = { id: 'news', feed: true };
  it('reports added, changed and removed items', () => {
    expect(diff(list, { a: '1', b: '2', c: '3' }, { a: '1', b: '9', d: '4' })).toEqual([
      { kind: 'changed', id: 'b', before: '2', value: '9' },
      { kind: 'added', id: 'd', value: '4' },
      { kind: 'removed', id: 'c', before: '3' },
    ]);
  });
  it('feeds ignore items that scrolled out of the window', () => {
    expect(diff(feed, { old: 't' }, { new: 'u' })).toEqual([{ kind: 'added', id: 'new', value: 'u' }]);
  });
  it('fingerprints are 12 hex chars, stable, and differ per change', () => {
    expect(fingerprint('a', 'b')).toMatch(/^[0-9a-f]{12}$/);
    expect(fingerprint('a', 'b')).toBe(fingerprint('a', 'b'));
    expect(fingerprint('a', 'b')).not.toBe(fingerprint('a', 'c'));
  });
  it('ISO weeks, including year boundaries', () => {
    expect(isoWeek(new Date('2026-11-03T06:17:00Z'))).toBe('2026-W45');
    expect(isoWeek(new Date('2026-01-01T00:00:00Z'))).toBe('2026-W01');
    expect(isoWeek(new Date('2027-01-01T00:00:00Z'))).toBe('2026-W53');
    expect(isoWeek(new Date('2024-12-30T00:00:00Z'))).toBe('2025-W01');
  });
  it('maps titles to atlas modules (female genital is not male genital)', () => {
    expect(modulesFor({}, 'Female Genital Tumours')).toEqual(['o24']);
    expect(modulesFor({}, 'Urinary and Male Genital Tumours')).toEqual(['o22', 'o23']);
    expect(modulesFor({}, 'consolidated guidelines on tuberculosis')).toEqual(['g09', 'o18']);
    expect(modulesFor({ modules: ['g05', 'g08'] }, 'Last update')).toEqual(['g05', 'g08']);
  });
});

describe('issues', () => {
  it('change issue: metadata, item URL, modules, human checklist and the fingerprint marker', () => {
    const i = changeIssue(source('catalogue'), { kind: 'added', id: 'Breast-Tumours-2027', value: '6th Edition, Volume 2 | Breast Tumours | 2027 | current' }, ctx);
    expect(i.title).toBe('WHO watch: IARC catalogue, WHO Classification of Tumours: added 6th Edition, Volume 2 | Breast Tumours | 2027 | current');
    expect(i.body).toContain('Who-Classification-Of-Tumours/Breast-Tumours-2027');
    expect(i.body).toContain('**Atlas modules to check (proposed, from titles only):** o25');
    expect(i.body).toContain('- [ ] Update those entities in a normal pull request: our own words only');
    expect(i.body).toContain('run: https://example.org/run/1');
    expect(i.body.trim().endsWith(`who-watch:${i.fingerprint}`)).toBe(true);
  });
  it('broken-source issue: one per source per ISO week', () => {
    const a = brokenIssue(source('icd11'), new Error('HTTP 503'), ctx);
    expect(a.title).toBe('WHO watch: source broken: icd11 (2026-W45)');
    expect(a.body).toContain('HTTP 503');
    expect(brokenIssue(source('icd11'), new Error('other'), ctx).fingerprint).toBe(a.fingerprint);
    expect(brokenIssue(source('icd11'), new Error('x'), { ...ctx, week: '2026-W46' }).fingerprint).not.toBe(a.fingerprint);
  });
});

/** Serves fixtures by URL; `overrides` replaces the text for one source id (or throws). */
function fakeGet(overrides: Record<string, string | Error> = {}) {
  const byUrl = new Map<string, string>([
    [source('catalogue').url, 'catalogue.html'],
    [source('online').url, 'bbdata.js'],
    [source('news').url, 'topic-feed.xml'],
    [source('monographs').url, 'monographs.html'],
    [source('iris').url, 'iris.xml'],
    [source('pubmed').url, 'esearch.json'],
  ]);
  const idOf = new Map<string, string>(SOURCES.map((s: { id: string; url: string }) => [s.url, s.id]));
  return async (url: string) => {
    const id = idOf.get(url) ?? `corrigenda/${url.split('/').at(-1)}`;
    const o = overrides[id];
    if (o instanceof Error) throw o;
    if (o !== undefined) return o;
    if (id === 'icd11') return 'https://icd.who.int/browse/2026-01/mms/en';
    if (id.startsWith('corrigenda/')) return fx('volume-no-corrigenda.html');
    return fx(byUrl.get(url)!);
  };
}

describe('pipeline (offline)', () => {
  it('a fresh baseline reports no changes; volume pages come from 5th/6th-edition catalogue items', async () => {
    const results = await readAll({ get: fakeGet() });
    expect(results.map((r: { source: { id: string } }) => r.source.id)).toEqual([
      ...SOURCES.map((s: { id: string }) => s.id),
      'corrigenda/Alpha-Tumours-2026',
      'corrigenda/Alpha-Tumours-2019',
    ]);
    const baseline = toBaseline(results, '2026-11-03');
    expect(plan(results, baseline)).toEqual({ issues: [], unbaselined: [] });
  });
  it('a change opens an issue, a failure a broken-source issue, an unknown source is skipped', async () => {
    const baseline = toBaseline(await readAll({ get: fakeGet() }), '2026-11-03');
    delete baseline.sources['corrigenda/Alpha-Tumours-2019'];
    const results = await readAll({
      get: fakeGet({ icd11: 'https://icd.who.int/browse/2027-01/mms/en', monographs: new Error('HTTP 429'), pubmed: '{"esearchresult":{"idlist":[]}}' }),
    });
    const { issues, unbaselined } = plan(results, baseline, { now: new Date('2026-11-03T06:17:00Z') });
    expect(issues.map((i: { title: string }) => i.title)).toEqual([
      'WHO watch: source broken: monographs (2026-W45)',
      'WHO watch: ICD-11 MMS latest release: changed 2027-01',
      'WHO watch: source broken: pubmed (2026-W45)',
    ]);
    expect(unbaselined).toEqual(['corrigenda/Alpha-Tumours-2019']);
  });
  it('refuses to write a baseline while a source is broken', async () => {
    const results = await readAll({ get: fakeGet({ online: 'garbage' }) });
    expect(() => toBaseline(results, '2026-11-03')).toThrow(/broken: online/);
  });
  it('if the catalogue is broken, volume pages come from the baseline', async () => {
    const baseline = { sources: { catalogue: { 'Kappa-Tumours-2021': '5th Edition, Volume 3 | Kappa | 2021 | current' } } };
    const results = await readAll({ get: fakeGet({ catalogue: new Error('HTTP 500') }), baseline });
    expect(results.at(-1)!.source.id).toBe('corrigenda/Kappa-Tumours-2021');
    expect(corrigendaSources({ x: 'Revised 4th Edition, Volume 1 | X | 2016 | current' })).toEqual([]);
  });
});

describe('publish (GitHub client injected)', () => {
  function fakeGh(existingBodies: string[], labels: string[] = []) {
    const calls: string[] = [];
    const gh = async (method: string, path: string, body?: { title?: string; name?: string }) => {
      calls.push(`${method} ${path}${body?.title ? ` ${body.title}` : body?.name ? ` ${body.name}` : ''}`);
      if (method === 'GET' && path.startsWith('/labels/')) return labels.includes(decodeURIComponent(path.slice(8))) ? { status: 200, data: {} } : { status: 404, data: null };
      if (method === 'GET' && path.startsWith('/issues')) return { status: 200, data: existingBodies.map((b) => ({ body: b })) };
      return { status: 201, data: { html_url: `https://example.org/issues/${calls.length}` } };
    };
    return { gh, calls };
  }
  const a = { fingerprint: 'aaaaaaaaaaaa', title: 'A', body: 'x\nwho-watch:aaaaaaaaaaaa' };
  const b = { fingerprint: 'bbbbbbbbbbbb', title: 'B', body: 'y\nwho-watch:bbbbbbbbbbbb' };

  it('creates missing labels, skips fingerprints already in any issue, never opens a duplicate in one run', async () => {
    const { gh, calls } = fakeGh(['closed earlier\nwho-watch:aaaaaaaaaaaa'], ['who-watch']);
    const opened = await publish([a, b, b], gh);
    expect(opened).toHaveLength(1);
    expect(calls).toEqual([
      'GET /labels/who-watch',
      'GET /labels/needs-human-review',
      'POST /labels needs-human-review',
      'GET /issues?labels=who-watch&state=all&per_page=100&page=1',
      'POST /issues B',
    ]);
  });
});

describe('committed baseline', () => {
  const data = JSON.parse(readFileSync(BASELINE, 'utf8'));
  it('has a review date and every static source', () => {
    expect(data.reviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const s of SOURCES) expect(Object.keys(data.sources[s.id] ?? {}).length, s.id).toBeGreaterThan(0);
  });
  it('has corrigenda for every 5th- and 6th-edition volume in its catalogue, and nothing else', () => {
    const expected = corrigendaSources(data.sources.catalogue).map((s: { id: string }) => s.id).sort();
    expect(expected.length).toBeGreaterThanOrEqual(15);
    expect(Object.keys(data.sources).filter((k) => k.startsWith('corrigenda/')).sort()).toEqual(expected);
  });
});
