// WHO watch (scripts/who-watch.mjs): parsers on handwritten fixtures, diff, dedup, issue bodies.
// No network: every fetch goes through an injected function that serves tests/fixtures/who-watch/.
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BASELINE,
  MARKER,
  SOURCES,
  brokenIssue,
  changeIssue,
  changeSummaryIssue,
  corrigendaSources,
  decode,
  diff,
  editionOf,
  fingerprint,
  githubClient,
  brokenSummaryIssue,
  MAX_BROKEN,
  MAX_CHANGES,
  neutral,
  oneLine,
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
const ctx = { date: '2026-11-03', runUrl: 'https://example.org/run/1' };

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
  it('keeps an invalid numeric entity as written instead of failing the source', () => {
    expect(decode('Title &#99999999; x &#x110000;')).toBe('Title &#99999999; x &#x110000;');
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
  it('broken-source issue: one per source, the same in every week', () => {
    const a = brokenIssue(source('icd11'), new Error('HTTP 503'), ctx);
    expect(a.title).toBe('WHO watch: source broken: icd11');
    expect(a.kind).toBe('broken');
    expect(a.body).toContain('HTTP 503');
    expect(brokenIssue(source('icd11'), new Error('other'), { ...ctx, date: '2026-11-10' }).fingerprint).toBe(a.fingerprint);
    expect(brokenIssue(source('online'), new Error('x'), ctx).fingerprint).not.toBe(a.fingerprint);
  });
  it('fetched text cannot mention users, reference issues, inject HTML, break code spans or fake a fingerprint', () => {
    const hostile = 'WHO Classification of Tumours update @octocat see owner/repo#1 <img src=x> <!-- who-watch:0123456789ab --> `x`\n::error::x';
    const i = changeIssue(source('news'), { kind: 'added', id: 'https://e.org/a?b=1@c', value: hostile }, ctx);
    expect(i.body).not.toMatch(/@octocat|repo#1|<img|<!--|`x`|\n::error/);
    expect(i.body).toContain('@\u200boctocat');
    expect(i.body).toContain('**Item URL:** https://e.org/a?b=1%40c');
    expect(i.body).toContain('&lt;!-- who-watch:0123456789ab --&gt;'); // escaped, and not on the last line
    expect(i.body.match(MARKER)?.[1]).toBe(i.fingerprint);
    expect(neutral('a\u0000b')).toBe('a b');
    expect(oneLine('x\n::error::y')).toBe('x ::error::y');
  });
  it('a corrigenda source built from hostile catalogue text cannot inject through its label or URL', () => {
    const [src] = corrigendaSources({ 'Bad`@evil Slug': '5th Edition, Volume 1 <img src=x> @octocat owner/repo#1 | Alpha | 2020 | current' });
    const issues = [changeIssue(src, { kind: 'changed', id: 'corrigenda', before: 'none', value: 'a.pdf' }, ctx), brokenIssue(src, new Error('HTTP 500'), ctx)];
    for (const i of issues) {
      expect(`${i.title}\n${i.body}`).not.toMatch(/@octocat|@evil|repo#1|<img|`@/);
      expect(i.body).toContain('Bad%60%40evil%20Slug');
      expect(i.body.match(MARKER)?.[1]).toBe(i.fingerprint);
    }
    expect(issues[0].title).toContain('@​octocat');
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
      'WHO watch: source broken: monographs',
      'WHO watch: source broken: pubmed',
      'WHO watch: ICD-11 MMS latest release: changed 2027-01',
    ]);
    expect(unbaselined).toEqual(['corrigenda/Alpha-Tumours-2019']);
  });
  it('circuit breaker: many broken sources give one summary issue', async () => {
    const baseline = toBaseline(await readAll({ get: fakeGet() }), '2026-11-03');
    const down = Object.fromEntries(SOURCES.map((s: { id: string }) => [s.id, new Error('HTTP 403')]));
    const results = await readAll({ get: fakeGet(down), baseline });
    const { issues } = plan(results, baseline);
    expect(results.filter((r: { error?: unknown }) => r.error).length).toBeGreaterThan(MAX_BROKEN);
    expect(issues.map((i: { title: string }) => i.title)).toEqual([`WHO watch: ${SOURCES.length} sources broken in one run`]);
    expect(issues[0].fingerprint).toBe(brokenSummaryIssue([], ctx).fingerprint);
  });
  it('many removed items report the source as broken instead of one issue per item', async () => {
    const baseline = { sources: { catalogue: Object.fromEntries(Array.from({ length: 20 }, (_, k) => [`V-${k}`, `5th Edition, Volume ${k} | V | 2020 | current`])) } };
    const results = [{ source: source('catalogue'), entries: Object.fromEntries(Object.entries(baseline.sources.catalogue).slice(0, 15)) }];
    const { issues } = plan(results, baseline);
    expect(issues).toHaveLength(1);
    expect(issues[0].title).toBe('WHO watch: source broken: catalogue');
    expect(issues[0].body).toContain('5 of 20 baseline items missing');
    // A couple of removals are still reported item by item.
    const two = [{ source: source('catalogue'), entries: Object.fromEntries(Object.entries(baseline.sources.catalogue).slice(0, 18)) }];
    expect(plan(two, baseline).issues.map((i: { title: string }) => i.title.split(': ').slice(-1)[0])).toHaveLength(2);
  });
  it('a burst of changes (e.g. every value in a new format) gives one summary issue that lists them', () => {
    const volumes = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, k) => [`V-${k}`, `5th Edition, Volume ${k} | V | 2020 | current`]));
    const reformatted = (n: number) => Object.fromEntries(Object.entries(volumes(n)).map(([k, v]) => [k, `${v} | new layout`]));
    const run = (n: number) => plan([{ source: source('catalogue'), entries: reformatted(n) }], { sources: { catalogue: volumes(n) } }, { now: new Date('2026-11-03') });
    expect(run(MAX_CHANGES).issues).toHaveLength(MAX_CHANGES); // up to the cap, one issue per change
    const { issues } = run(MAX_CHANGES + 2);
    expect(issues).toHaveLength(1);
    expect(issues[0].title).toBe(`WHO watch: ${MAX_CHANGES + 2} changes in one run, check the sources first`);
    expect(issues[0].body).toContain('- IARC catalogue, WHO Classification of Tumours: changed 5th Edition, Volume 11 | V | 2020 | current | new layout');
    expect(issues[0].body.match(MARKER)?.[1]).toBe(issues[0].fingerprint);
    // The same burst in any order has the same fingerprint (seen once, never reopened); another burst gets a new one.
    const changes = Object.entries(volumes(MAX_CHANGES + 2)).map(([id, v]) => changeIssue(source('catalogue'), { kind: 'changed', id, before: v, value: `${v} | new layout` }, ctx));
    expect(changeSummaryIssue([...changes].reverse(), ctx).fingerprint).toBe(issues[0].fingerprint);
    expect(changeSummaryIssue(changes.slice(1), ctx).fingerprint).not.toBe(issues[0].fingerprint);
    expect(run(60).issues[0].body).toContain('- … and 10 more');
  });
  it('past the run deadline the remaining sources are reported broken without being fetched', async () => {
    let calls = 0;
    const get = async () => {
      calls++;
      throw new Error('timeout');
    };
    const results = await readAll({ get, budgetMs: 0 });
    expect(calls).toBe(0);
    expect(results.every((r) => /deadline/.test(String((r.error as Error).message)))).toBe(true);
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
      if (method === 'GET' && path.startsWith('/issues'))
        return { status: 200, data: existingBodies.map((b) => ({ body: b.replace(/^open:/, ''), state: b.startsWith('open:') ? 'open' : 'closed' })) };
      return { status: 201, data: { html_url: `https://example.org/issues/${calls.length}` } };
    };
    return { gh, calls };
  }
  const a = { fingerprint: 'aaaaaaaaaaaa', title: 'A', body: 'x\nwho-watch:aaaaaaaaaaaa' };
  const b = { fingerprint: 'bbbbbbbbbbbb', title: 'B', body: 'y\nwho-watch:bbbbbbbbbbbb' };

  it('creates missing labels, skips fingerprints already in any issue, never opens a duplicate in one run', async () => {
    const { gh, calls } = fakeGh(['closed earlier\nwho-watch:aaaaaaaaaaaa', 'mentions who-watch:bbbbbbbbbbbb mid-text\nwho-watch:cccccccccccc'], ['who-watch']);
    const opened = await publish([a, b, b], gh, { pause: async () => {} });
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

describe('publish: broken sources and pacing', () => {
  it('reopens a broken-source issue only when no open one exists, and pauses between POSTs', async () => {
    const broken = { kind: 'broken', fingerprint: 'dddddddddddd', title: 'D', body: 'z\nwho-watch:dddddddddddd' };
    const change = { kind: 'change', fingerprint: 'eeeeeeeeeeee', title: 'E', body: 'z\nwho-watch:eeeeeeeeeeee' };
    const posts: string[] = [];
    let pauses = 0;
    const gh = (state: string) => async (method: string, path: string, body?: { title?: string }) => {
      if (method === 'GET' && path.startsWith('/labels/')) return { status: 200, data: {} };
      if (method === 'GET') return { status: 200, data: [{ body: 'x\nwho-watch:dddddddddddd', state }] };
      posts.push(body!.title!);
      return { status: 201, data: {} };
    };
    await publish([broken, change], gh('open'), { pause: async () => void pauses++ });
    expect(posts).toEqual(['E']);
    await publish([broken, change], gh('closed'), { pause: async () => void pauses++ });
    expect(posts).toEqual(['E', 'D', 'E']);
    expect(pauses).toBe(1);
  });
});

describe('GitHub client (fetch stubbed)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
  /** Replies with the given statuses in order; records the requests. */
  function stubFetch(replies: { status: number; headers?: Record<string, string> }[]) {
    const requests: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      requests.push({ url, init });
      const r = replies.shift()!;
      return new Response(r.status < 300 ? '{"html_url":"https://example.org/issues/1"}' : '{}', { status: r.status, headers: r.headers });
    });
    return requests;
  }

  it('waits as long as retry-after says on a secondary rate limit, then retries once', async () => {
    vi.useFakeTimers();
    const requests = stubFetch([{ status: 403, headers: { 'retry-after': '7' } }, { status: 201 }]);
    const call = githubClient('t0ken', 'owner/repo')('POST', '/issues', { title: 'x' });
    await vi.advanceTimersByTimeAsync(6_999);
    expect(requests).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(call).resolves.toEqual({ status: 201, data: { html_url: 'https://example.org/issues/1' } });
    expect(requests.map((r) => r.url)).toEqual(['https://api.github.com/repos/owner/repo/issues', 'https://api.github.com/repos/owner/repo/issues']);
    expect((requests[0]!.init.headers as Record<string, string>).authorization).toBe('Bearer t0ken'); // the token travels only as a header
  });

  it('gives up after one retry, and at once without retry-after', async () => {
    vi.useFakeTimers();
    stubFetch([{ status: 429, headers: { 'retry-after': '1' } }, { status: 429, headers: { 'retry-after': '1' } }]);
    const call = githubClient('t', 'o/r')('POST', '/issues', { title: 'x' });
    const failed = expect(call).rejects.toThrow('GitHub POST /issues: HTTP 429');
    await vi.advanceTimersByTimeAsync(1_000);
    await failed;
    stubFetch([{ status: 403 }]);
    await expect(githubClient('t', 'o/r')('POST', '/issues', { title: 'x' })).rejects.toThrow('HTTP 403');
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
