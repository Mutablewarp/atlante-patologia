#!/usr/bin/env node
// WHO watch (docs/WHO_WATCH.md). Plain Node ESM, built-in fetch, no dependencies.
//
//   node scripts/who-watch.mjs            check the sources; open one GitHub issue per change
//                                         (needs GH_TOKEN and GH_REPO; set by .github/workflows/who-watch.yml)
//   node scripts/who-watch.mjs --dry-run  print the would-be issues; never calls GitHub
//   node scripts/who-watch.mjs --init     write data/who-watch/baseline.json from the live sources
//
// Public metadata only: it never logs in, never downloads PDFs or subscription
// content, never commits and never edits content. Issues hold metadata (title,
// edition, volume, year, URL) and a checklist for the human who reviews them.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const BASELINE = fileURLToPath(new URL('../data/who-watch/baseline.json', import.meta.url));
export const LABELS = [
  { name: 'who-watch', color: '1d76db', description: 'Opened by the WHO watch (metadata only)' },
  { name: 'needs-human-review', color: 'd93f0b', description: 'A person must check this before any content change' },
];
const UA = 'atlante-patologia-who-watch/1 (+https://mutablewarp.github.io/atlante-patologia/)';
const SERIES = 'https://publications.iarc.who.int/Book-And-Report-Series/Who-Classification-Of-Tumours';
const PUBMED_TERM =
  '("classification"[ti]) AND ("6th edition"[ti] OR "sixth edition"[ti]) AND (WHO[ti] OR "World Health Organization"[ti])';

// ── Parsers: text → { itemId: value }. An empty result means "source broken". ──

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
/** One invalid numeric entity must not break the whole source: keep it as written. */
function codePoint(raw, n) {
  try {
    return String.fromCodePoint(n);
  } catch {
    return raw;
  }
}
/** Decode the HTML/XML entities that appear in titles and URLs. */
export function decode(s) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => codePoint(m, parseInt(h, 16)))
    .replace(/&#(\d+);/g, (m, d) => codePoint(m, Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

/** IARC series catalogue: slug → "6th Edition, Volume 1 | Digestive System Tumours | 2026 | current". */
export function parseCatalogue(html) {
  const out = {};
  for (const block of html.split(/class="result-item\b/).slice(1)) {
    const link = block.match(/<h2>\s*<a href="[^"]*\/Who-Classification-Of-Tumours\/([^"/?#]+)"[^>]*>([^<]+)<\/a>/);
    const ed = block.match(/<h3>\s*WHO Classification of Tumours,\s*([^<]+?)\s*<\/h3>/);
    const year = block.match(/<p>\s*(\d{4})\s*<\/p>/);
    if (!link || !ed || !year) continue;
    const status = /New edition\s*<a\b/i.test(block) ? 'new edition available' : 'current';
    out[link[1]] = [decode(ed[1]), decode(link[2]), year[1], status].join(' | ');
  }
  return out;
}

/** Edition number at the start of a catalogue value ("5th Edition, …" → 5; "Revised 4th …" → undefined). */
export const editionOf = (value) => Number(value.match(/^(\d+)(?:st|nd|rd|th) Edition\b/)?.[1]) || undefined;

/** Volume page, Corrigenda tab: { corrigenda: "file-a.pdf, file-b.pdf" } or { corrigenda: "none" }. */
export function parseCorrigenda(html) {
  const pane = html.match(/id="errata"[^>]*>([\s\S]*?)<\/div>/)?.[1];
  if (!pane) return {};
  const files = [...pane.matchAll(/href="[^"]*\/download\/([^"]+)"/g)].map((m) => safeDecodeUri(decode(m[1])));
  if (files.length > 0) return { corrigenda: files.sort().join(', ') };
  return /No corrigenda/i.test(pane) ? { corrigenda: 'none' } : {};
}
function safeDecodeUri(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** WHO Classification of Tumours Online data file: "Breast Tumours (6th ed.)" → "Beta version ahead of print | not in print". */
export function parseOnlineVolumes(js) {
  // Commented `//news` lines are skipped; `cytopath = '…'` may share the line, so match up to the first `';`.
  const line = js.split('\n').find((l) => /^\s*bluebooks\s*=/.test(l));
  const json = line?.match(/^\s*bluebooks\s*=\s*'(.*?)'\s*;/)?.[1];
  if (!json) return {};
  const out = {};
  for (const b of JSON.parse(json)) {
    if (!b.booktitle) continue;
    out[`${b.booktitle} (${b.edition})`] = `${b.version || 'no beta label'} | ${b.print ? 'in print' : 'not in print'}`;
  }
  return out;
}

/** RSS 2.0 items: guid (or link) → title. `keep` filters by title. */
export function parseRss(xml, keep = () => true) {
  const out = {};
  for (const [, item] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const title = decode(item.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '');
    const id = decode(item.match(/<guid\b[^>]*>([\s\S]*?)<\/guid>/)?.[1] ?? item.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? '');
    if (title && id && keep(title)) out[id] = title;
  }
  return out;
}
/** The tumour-classification feed also carries unrelated posts (e.g. awareness months). */
export const CLASSIFICATION_NEWS = /WHO Classification of Tumours|Blue Books?|ICD-O|Cytopathology Reporting/i;

/** IARC Monographs "agents classified" page: { "last-update": "30 October 2026" }. */
export function parseMonographs(html) {
  const date = html.match(/Last update:\s*([^<]+?)\s*</)?.[1];
  return date ? { 'last-update': decode(date) } : {};
}

/** ICD-11 latest-release redirect target: { release: "2026-01" }. */
export function parseIcd11(location) {
  const release = location.match(/\/browse\/([^/]+)\/mms\b/)?.[1];
  return release ? { release } : {};
}

/** PubMed esearch JSON: PMID → "". */
export function parsePubmed(json) {
  const ids = JSON.parse(json)?.esearchresult?.idlist ?? [];
  return Object.fromEntries(ids.map((id) => [String(id), '']));
}

// ── Sources ──────────────────────────────────────────────────────────────────
// `feed`: a rolling window (only new items matter; items that scroll out are not changes).
// `modules`: atlas modules to check for every change of this source (plan, private notes §6.8).

export const SOURCES = [
  {
    id: 'catalogue',
    label: 'IARC catalogue, WHO Classification of Tumours',
    url: `${SERIES}?limit=50`,
    parse: parseCatalogue,
    itemUrl: (slug) => `${SERIES}/${slug}`,
  },
  {
    id: 'online',
    label: 'WHO Classification of Tumours Online, volume list',
    url: 'https://tumourclassification.iarc.who.int/welcome/static/bbdata.js',
    parse: parseOnlineVolumes,
  },
  {
    id: 'news',
    label: 'IARC tumour-classification news',
    url: 'https://www.iarc.who.int/research-topic/tumour-classification/feed/',
    parse: (xml) => parseRss(xml, (t) => CLASSIFICATION_NEWS.test(t)),
    feed: true,
    itemUrl: (guid) => guid,
  },
  {
    id: 'monographs',
    label: 'IARC Monographs, agents classified',
    url: 'https://monographs.iarc.who.int/agents-classified-by-the-iarc/',
    parse: parseMonographs,
    modules: ['g05', 'g08'],
  },
  {
    id: 'icd11',
    label: 'ICD-11 MMS latest release',
    url: 'https://icd.who.int/browse/latest-release/mms/en',
    redirect: true,
    parse: parseIcd11,
  },
  {
    id: 'iris',
    label: 'WHO IRIS, WHO guideline records',
    url: 'https://iris.who.int/server/opensearch/search?format=rss&query=dc.subject:%22WHO%20guideline%22&sort=dc.date.accessioned&sort_direction=DESC&rpp=20',
    parse: (xml) => parseRss(xml),
    feed: true,
    itemUrl: (link) => link,
  },
  {
    id: 'pubmed',
    label: 'PubMed, journal summaries of WHO 6th-edition volumes',
    url: `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=200&term=${encodeURIComponent(PUBMED_TERM)}`,
    parse: parsePubmed,
    feed: true,
    itemUrl: (pmid) => `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
  },
];

/** One corrigenda source per 5th- or 6th-edition volume page (the editions the atlas can cite). */
export function corrigendaSources(catalogue) {
  return Object.entries(catalogue)
    .filter(([, value]) => (editionOf(value) ?? 0) >= 5)
    .map(([slug, value]) => ({
      id: `corrigenda/${slug}`,
      label: `Corrigenda, ${value.split(' | ').slice(0, 2).join(': ')}`,
      url: `${SERIES}/${slug}`,
      parse: parseCorrigenda,
      itemUrl: () => `${SERIES}/${slug}`,
    }));
}

/** Keyword → atlas modules (proposal from volume and guideline titles; check the table of contents). */
const MODULE_HINTS = [
  [/digestive/i, ['o19', 'o20', 'o21']],
  [/breast/i, ['o25']],
  [/soft tissue|\bbone\b/i, ['o30']],
  [/female genital|cervical|cervix|papillomavirus|\bhpv\b/i, ['o24']],
  [/thoracic|tubercul/i, ['o18']],
  [/central nervous system|\bcns\b/i, ['o32']],
  [/urinary|\bmale genital/i, ['o22', 'o23']],
  [/head and neck/i, ['o29']],
  [/endocrine/i, ['o27']],
  [/haematolymphoid|lymphoid/i, ['o26']],
  [/\bskin\b/i, ['o28']],
  [/\beye\b/i, ['o33']],
  [/genetic tumour syndromes/i, ['g05', 'g06']],
  [/tubercul|papillomavirus|\bhpv\b|mpox|malaria|leishmaniasis|filovirus|hepatitis/i, ['g09']],
  [/hepatitis/i, ['o20']],
];
export function modulesFor(source, text) {
  const hits = new Set(source.modules ?? []);
  for (const [re, mods] of MODULE_HINTS) if (re.test(text)) mods.forEach((m) => hits.add(m));
  return [...hits].sort();
}

// ── Diff, fingerprints, issues ───────────────────────────────────────────────

/** Changes of one source against its baseline entries. */
export function diff(source, before, after) {
  const changes = [];
  for (const [id, value] of Object.entries(after)) {
    if (!(id in before)) changes.push({ kind: 'added', id, value });
    else if (before[id] !== value) changes.push({ kind: 'changed', id, before: before[id], value });
  }
  if (!source.feed)
    for (const [id, value] of Object.entries(before)) if (!(id in after)) changes.push({ kind: 'removed', id, before: value });
  return changes;
}

export const fingerprint = (...parts) => createHash('sha256').update(parts.join('\n')).digest('hex').slice(0, 12);
/** The fingerprint marker is the body's last line; a marker-like string inside fetched text never counts. */
export const MARKER = /\nwho-watch:([0-9a-f]{12})\s*$/;

/**
 * Fetched text goes into issue bodies: no control characters or newlines, no @-mentions, no #-references,
 * no raw HTML, no backticks (code spans). Zero-width spaces keep @ and # readable but inert.
 */
export const neutral = (v) =>
  String(v)
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/`/g, "'")
    .replace(/([@#])/g, '$1\u200b');
/** Same for a URL: unsafe characters are percent-encoded so the link still works. */
export const neutralUrl = (u) => String(u).replace(/[\u0000-\u0020\u007f<>`"'@]/g, (c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0').toUpperCase()}`);
/** For console output (GitHub parses `::` workflow commands at a line start): one line, no control characters. */
export const oneLine = (v) => String(v).replace(/[\u0000-\u001f\u007f]+/g, ' ');

/** Above this many broken sources in one run, one summary issue replaces the per-source issues. */
export const MAX_BROKEN = 3;
/** Above this many changes in one run, one summary issue lists them (a format change, or a long-stale baseline). */
export const MAX_CHANGES = 10;
/** More removed items than this (count, or share of the baseline) means the page changed, not the catalogue. */
export const MAX_REMOVED = 3;
export const MAX_REMOVED_SHARE = 0.2;

const CHECKLIST = [
  'Open the source and confirm edition, volume, year and status (print, online beta, forthcoming).',
  'Decide the impact: none, terminology only, content update, or mark the cards edition-dependent.',
  'Add or adjust the entry in `src/content/sources.yaml` (series, edition, volume, status, supersedes, ISBN; `existsVerified` via publisher with today’s date).',
  'Find the entities to review: those whose `classification.source` is the changed or superseded volume, plus the modules listed above.',
  'Update those entities in a normal pull request: our own words only, never WHO/IARC text, tables or figures; cite series, edition, volume, title and year; claim ledger and verifier as usual.',
  'Refresh the baseline (`node scripts/who-watch.mjs --init`), review its diff, commit it, then close this issue.',
];
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Issue for one change. Metadata only: never quotes source text beyond titles. */
export function changeIssue(source, change, { date, runUrl }) {
  const fp = fingerprint(source.id, change.kind, change.id, change.before ?? '', change.value ?? '');
  const name = change.value || change.before || change.id;
  const mods = modulesFor(source, `${source.label} ${change.id} ${change.before ?? ''} ${change.value ?? ''}`);
  const lines = [
    // Corrigenda labels and URLs are built from fetched catalogue text, so they are neutralised too.
    `**Source:** ${neutral(source.label)} — ${neutralUrl(source.url)}`,
    `**Detected:** ${date} (run: ${runUrl || 'local'})`,
    `**Change:** ${change.kind} ${neutral(change.id)}`,
    ...(change.before !== undefined ? [`- before: ${neutral(change.before) || '(empty)'}`] : []),
    ...(change.value !== undefined ? [`- now: ${neutral(change.value) || '(empty)'}`] : []),
    ...(source.itemUrl ? [`**Item URL:** ${neutralUrl(source.itemUrl(change.id))}`] : []),
    `**Atlas modules to check (proposed, from titles only):** ${mods.length ? mods.join(', ') : 'none matched, decide by hand'}`,
    '',
    '**Human checklist**',
    ...CHECKLIST.map((c) => `- [ ] ${c}`),
    '',
    'The bot reports public metadata only. It never edits content and never commits. Runbook: `docs/WHO_WATCH.md`.',
    '',
    `who-watch:${fp}`,
  ];
  return { kind: 'change', fingerprint: fp, title: clip(`WHO watch: ${neutral(source.label)}: ${change.kind} ${neutral(name)}`, 200), body: lines.join('\n') };
}

/** Circuit breaker for changes: one issue lists a burst. Seen once (open or closed), the same burst never reopens. */
export function changeSummaryIssue(changes, { date, runUrl }) {
  const fp = fingerprint('changes', ...changes.map((c) => c.fingerprint).sort());
  const shown = changes.slice(0, 50); // GitHub caps a body at 65,536 characters
  const body = [
    `**Detected:** ${date} (run: ${runUrl || 'local'})`,
    `**Problem:** ${changes.length} changes in one run. Real news rarely comes in bursts: most likely a source changed its layout or format, or the baseline has not been refreshed for a long time.`,
    '',
    ...shown.map((c) => `- ${c.title.replace(/^WHO watch: /, '')}`),
    ...(changes.length > shown.length ? [`- … and ${changes.length - shown.length} more`] : []),
    '',
    '**Human checklist**',
    '- [ ] Run `node scripts/who-watch.mjs --dry-run` for the full details and open a few of the sources.',
    '- [ ] Layout or format change: fix the parser in `scripts/who-watch.mjs` and its test fixture.',
    '- [ ] Real changes: triage each one as in `docs/WHO_WATCH.md` §2, refresh the baseline, then close this issue.',
    '',
    `who-watch:${fp}`,
  ].join('\n');
  return { kind: 'change', fingerprint: fp, title: `WHO watch: ${changes.length} changes in one run, check the sources first`, body };
}

/** Issue for a source that could not be fetched or parsed: one per source, not reopened while an open one exists. */
export function brokenIssue(source, error, { date, runUrl }) {
  const fp = fingerprint('broken', source.id);
  const body = [
    `**Source:** ${neutral(source.label)} — ${neutralUrl(source.url)}`,
    `**Detected:** ${date} (run: ${runUrl || 'local'})`,
    `**Problem:** ${neutral(clip(String(error?.message ?? error), 300))}`,
    '',
    'The watch could not read this source, so changes to it are not being detected.',
    '',
    '**Human checklist**',
    '- [ ] Open the URL in a browser. Is it gone, moved, rate-limited (403/429) or changed layout?',
    '- [ ] Moved or new layout: update the URL or parser in `scripts/who-watch.mjs` and its test fixture.',
    '- [ ] Never bypass bot protection or log in; if the site blocks automated reads, drop the source.',
    '- [ ] Close this issue once the next run reads the source again.',
    '',
    `who-watch:${fp}`,
  ].join('\n');
  return { kind: 'broken', fingerprint: fp, title: `WHO watch: source broken: ${neutral(source.id)}`, body };
}

/** Circuit breaker: one issue for a run where many sources fail (often one host down), not one per source. */
export function brokenSummaryIssue(broken, { date, runUrl }) {
  const fp = fingerprint('broken-summary');
  const body = [
    `**Detected:** ${date} (run: ${runUrl || 'local'})`,
    `**Problem:** ${broken.length} sources could not be read in this run, so changes to them are not being detected.`,
    '',
    ...broken.map((r) => `- ${neutral(r.source.id)}: ${neutral(clip(String(r.error?.message ?? r.error), 160))}`),
    '',
    '**Human checklist**',
    '- [ ] Check whether one host is down or blocking automated reads (most sources are on publications.iarc.who.int).',
    '- [ ] Never bypass bot protection or log in; if the site blocks automated reads, drop the sources.',
    '- [ ] Close this issue once a run reads the sources again.',
    '',
    `who-watch:${fp}`,
  ].join('\n');
  return { kind: 'broken', fingerprint: fp, title: `WHO watch: ${broken.length} sources broken in one run`, body };
}

// ── Fetching and checking ────────────────────────────────────────────────────

/** GET with a 20 s timeout and one retry (none after 403/429). Redirect sources return the Location header. */
export async function fetchText(url, { redirect = false, deadline = Infinity } = {}) {
  let last;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        redirect: redirect ? 'manual' : 'follow',
        headers: { 'user-agent': UA },
        signal: AbortSignal.timeout(20_000),
      });
      if (redirect && res.status >= 300 && res.status < 400) return res.headers.get('location') ?? '';
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      last = e;
      if (/HTTP (403|429)/.test(String(e?.message)) || Date.now() >= deadline) break;
    }
  }
  throw last;
}

async function read(source, get, deadline) {
  // Past the run deadline the remaining sources are reported broken, so a hanging host still yields an issue.
  if (Date.now() >= deadline) return { source, error: new Error('not read: the run deadline was reached (slow or hanging host)') };
  try {
    const entries = source.parse(await get(source.url, { redirect: source.redirect, deadline }));
    if (Object.keys(entries).length === 0) throw new Error('parser found no items (layout changed?)');
    return { source, entries };
  } catch (error) {
    return { source, error };
  }
}

/** Time budget for reading all sources (the workflow job allows 20 minutes). */
export const READ_BUDGET_MS = 5 * 60_000;

/**
 * Read every source in order (politeness: one request at a time).
 * @param {{ get?: typeof fetchText, baseline?: { sources?: Record<string, Record<string, string>> }, budgetMs?: number }} [opts]
 */
export async function readAll({ get = fetchText, baseline, budgetMs = READ_BUDGET_MS } = {}) {
  const deadline = Date.now() + budgetMs;
  const results = [];
  for (const s of SOURCES) results.push(await read(s, get, deadline));
  // Volume pages come from the live catalogue; if that is broken, from the baseline's.
  const catalogue = results[0].entries ?? baseline?.sources?.catalogue ?? {};
  for (const s of corrigendaSources(catalogue)) results.push(await read(s, get, deadline));
  return results;
}

/** Sorted keys so the committed baseline diffs cleanly. */
const sortObj = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));

export function toBaseline(results, reviewed) {
  const broken = results.filter((r) => r.error);
  if (broken.length) throw new Error(`cannot write a baseline, broken: ${broken.map((r) => `${r.source.id} (${r.error.message})`).join('; ')}`);
  return {
    $comment: 'Reviewed state for scripts/who-watch.mjs. Only a human updates it (docs/WHO_WATCH.md).',
    reviewed,
    sources: sortObj(Object.fromEntries(results.map((r) => [r.source.id, sortObj(r.entries)]))),
  };
}

/** Would-be issues for one run. Sources missing from the baseline are reported in `unbaselined`, not diffed. */
export function plan(results, baseline, { now = new Date(), runUrl = '' } = {}) {
  const ctx = { date: now.toISOString().slice(0, 10), runUrl };
  const changes = [];
  const broken = [];
  const unbaselined = [];
  for (const r of results) {
    if (r.error) {
      broken.push(r);
      continue;
    }
    const before = baseline.sources?.[r.source.id];
    if (!before) {
      unbaselined.push(r.source.id);
      continue;
    }
    const found = diff(r.source, before, r.entries);
    const removed = found.filter((c) => c.kind === 'removed').length;
    const total = Object.keys(before).length;
    // Many items gone at once is a layout or page-size change: report the source, not each item.
    if (removed > MAX_REMOVED || (total > 0 && removed / total > MAX_REMOVED_SHARE)) {
      broken.push({ source: r.source, error: new Error(`${removed} of ${total} baseline items missing (layout or page-size change?)`) });
      continue;
    }
    for (const c of found) changes.push(changeIssue(r.source, c, ctx));
  }
  const brokenIssues = broken.length > MAX_BROKEN ? [brokenSummaryIssue(broken, ctx)] : broken.map((r) => brokenIssue(r.source, r.error, ctx));
  const changeIssues = changes.length > MAX_CHANGES ? [changeSummaryIssue(changes, ctx)] : changes;
  return { issues: [...brokenIssues, ...changeIssues], unbaselined };
}

// ── GitHub (REST API with GH_TOKEN; the token is only ever sent as a header) ─

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function githubClient(token, repo) {
  return async function call(method, path, body, retried = false) {
    const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        'user-agent': UA,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
    // Secondary rate limit: wait as told (at most a minute) and try once more.
    const retryAfter = Number(res.headers.get('retry-after'));
    if ((res.status === 403 || res.status === 429) && retryAfter > 0 && !retried) {
      await sleep(Math.min(retryAfter, 60) * 1000);
      return call(method, path, body, true);
    }
    if (res.status === 404 && method === 'GET') return { status: 404, data: null };
    if (!res.ok) throw new Error(`GitHub ${method} ${path.split('?')[0]}: HTTP ${res.status}`);
    return { status: res.status, data: await res.json() };
  };
}

/**
 * Create missing labels and open the issues not seen before: a change is skipped if any who-watch issue (open or
 * closed) has its fingerprint; a broken-source issue only while an open one has it. At least 1 s between POSTs.
 */
export async function publish(issues, gh, { pause = () => sleep(1000) } = {}) {
  for (const l of LABELS) {
    const { status } = await gh('GET', `/labels/${encodeURIComponent(l.name)}`);
    if (status === 404) await gh('POST', '/labels', l);
  }
  const seen = new Set();
  const open = new Set();
  for (let page = 1; ; page++) {
    const { data } = await gh('GET', `/issues?labels=who-watch&state=all&per_page=100&page=${page}`);
    for (const i of data ?? []) {
      const fp = (i.body ?? '').match(MARKER)?.[1];
      if (!fp) continue;
      seen.add(fp);
      if (i.state === 'open') open.add(fp);
    }
    if (!data || data.length < 100) break;
  }
  const opened = [];
  for (const issue of issues) {
    if ((issue.kind === 'broken' ? open : seen).has(issue.fingerprint)) continue;
    seen.add(issue.fingerprint);
    open.add(issue.fingerprint);
    if (opened.length) await pause();
    const { data } = await gh('POST', '/issues', { title: issue.title, body: issue.body, labels: LABELS.map((l) => l.name) });
    opened.push(data?.html_url ?? issue.title);
  }
  return opened;
}

// ── CLI ──────────────────────────────────────────────────────────────────────

async function main(argv) {
  const mode = argv.includes('--init') ? 'init' : argv.includes('--dry-run') ? 'dry-run' : 'live';
  const baseline = mode === 'init' ? undefined : JSON.parse(readFileSync(BASELINE, 'utf8'));
  const results = await readAll({ baseline });

  if (mode === 'init') {
    const data = toBaseline(results, new Date().toISOString().slice(0, 10));
    writeFileSync(BASELINE, `${JSON.stringify(data, null, 2)}\n`);
    console.log(`who-watch: wrote ${BASELINE} (${results.length} sources). Review the diff before committing.`);
    return;
  }

  const { issues, unbaselined } = plan(results, baseline, { runUrl: process.env.RUN_URL });
  for (const id of unbaselined) console.log(`who-watch: ${oneLine(id)} is not in the baseline yet (refresh it after review)`);
  const broken = issues.filter((i) => i.kind === 'broken').length;
  console.log(`who-watch: ${results.length} sources read, ${issues.length - broken} change issue(s), ${broken} broken-source issue(s) (baseline reviewed ${oneLine(baseline.reviewed)})`);

  if (mode === 'dry-run') {
    for (const i of issues) console.log(`\n── ${i.title}\n${i.body}`);
    if (issues.length === 0) console.log('who-watch: no changes against the baseline');
    return;
  }

  const token = process.env.GH_TOKEN;
  const repo = process.env.GH_REPO;
  if (!token || !repo) throw new Error('GH_TOKEN and GH_REPO are required (or use --dry-run)');
  const opened = await publish(issues, githubClient(token, repo));
  console.log(`who-watch: opened ${opened.length} issue(s)${opened.length ? `:\n${opened.join('\n')}` : ''}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  main(process.argv.slice(2)).catch((e) => {
    console.error(`who-watch: ${e.message}`);
    process.exit(1);
  });
