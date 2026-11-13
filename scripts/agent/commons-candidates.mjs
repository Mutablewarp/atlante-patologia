#!/usr/bin/env node
/**
 * Image candidates from Wikimedia Commons for the scout agent (plan I-7), as JSON lines.
 *
 *   node scripts/agent/commons-candidates.mjs --query "<text>" [--category "Category:..."] [--limit 30] [--min-width 800]
 *
 * A search in the File namespace; with --category too the search is limited to that category (`incategory:`), and with
 * only --category the files of the category are listed. One request at a time, 1 s apart, at most 3 requests. Prints at
 * most 30 lines { title, pageUrl, fileUrl, width, height, bytes, license, licenseUrl, author, credit, description,
 * allowed, reason }. Writes nothing. Allowed: public domain, CC0, CC BY and CC BY-SA of any version, with a named author.
 */
import { fileURLToPath } from 'node:url';

const API = 'https://commons.wikimedia.org/w/api.php';
const USER_AGENT = 'atlante-patologia-tooling/1.0 (https://github.com/Mutablewarp/atlante-patologia)';
const MAX_ROWS = 30;
const MAX_REQUESTS = 3;
const PAUSE_MS = 1000;
const MAX_TEXT = 200;
const IMAGEINFO = {
  prop: 'imageinfo',
  iiprop: 'url|size|mime|extmetadata',
  iiextmetadatafilter: 'Artist|Credit|ImageDescription|LicenseShortName|LicenseUrl',
};
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** Licence screen on the Commons `LicenseShortName` (and `LicenseUrl`): { allowed, reason }. */
export function classifyLicense(shortName, url = '') {
  const name = String(shortName ?? '').trim();
  if (!name) return { allowed: false, reason: 'no licence' };
  const text = name.toUpperCase().replace(/[-_]+/g, ' ');
  if (/\b(NC|ND)\b|NON ?COMMERCIAL|NO ?DERIV|EDUCATION|FAIR USE/.test(text) || /licenses\/by-(nc|nd)/i.test(url))
    return { allowed: false, reason: 'NC, ND, educational or fair-use licence' };
  // CC BY-SA before CC BY: the second pattern also matches the first.
  const family = [[/^CC0\b/, 'CC0'], [/^CC BY SA\b/, 'CC BY-SA'], [/^CC BY\b/, 'CC BY'], [/^(PUBLIC DOMAIN|PD)\b/, 'public domain']].find(([re]) => re.test(text));
  return family ? { allowed: true, reason: family[1] } : { allowed: false, reason: `licence not in the allowed list: ${name}` };
}

/** The HTML of an extmetadata value as one line of plain text. */
export function plain(html) {
  return String(html ?? '')
    .replace(/<\/?(?:br|p|div|li|dd|dt|dl|tr|td)\b[^>]*>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, name) => {
      if (name[0] !== '#') return ENTITIES[name.toLowerCase()] ?? entity;
      const code = name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1));
      return code <= 0x10ffff ? String.fromCodePoint(code) : entity;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

const cut = (text) => (text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT - 1)}…` : text);

/**
 * One page of the API answer as a candidate, or null when it has no image data (not an image, or no imageinfo).
 * @param {any} page
 */
export function parseImageInfo(page) {
  const info = page?.imageinfo?.[0];
  // DjVu scans are `image/*` too but are not pictures a page can show.
  if (!info?.url || !/^image\/(?!vnd\.djvu)/.test(info.mime ?? '')) return null;
  const meta = info.extmetadata ?? {};
  const text = (key) => plain(meta[key]?.value);
  const license = text('LicenseShortName');
  const licenseUrl = text('LicenseUrl');
  const author = text('Artist');
  let verdict = classifyLicense(license, licenseUrl);
  if (verdict.allowed && (!author || /^(unknown|anonymous)\b/i.test(author))) verdict = { allowed: false, reason: 'missing author' };
  return {
    title: page.title,
    pageUrl: info.descriptionurl,
    fileUrl: info.url.replace(/\?.*$/, ''), // the API adds a tracking query to the original's URL
    width: info.width,
    height: info.height,
    bytes: info.size,
    license,
    licenseUrl,
    author,
    credit: cut(text('Credit')),
    description: cut(text('ImageDescription')),
    ...verdict,
  };
}

/**
 * The URL of one API request, for 30 hits: a search (inside a category when one is given), or the files of a category when there is no query.
 * @param {{ query?: string, category?: string }} source
 * @param {Record<string, string | number>} [cont] the `continue` object of the previous answer
 */
export function requestUrl({ query = '', category = '' }, cont = {}) {
  const cat = category.replace(/^category:/i, '').trim();
  const search = query.trim();
  const generator = search
    ? { generator: 'search', gsrsearch: cat ? `${search} incategory:"${cat}"` : search, gsrnamespace: '6', gsrlimit: String(MAX_ROWS) }
    : { generator: 'categorymembers', gcmtitle: `Category:${cat}`, gcmtype: 'file', gcmlimit: String(MAX_ROWS) };
  return `${API}?${new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', ...IMAGEINFO, ...generator, ...cont })}`;
}

async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  return res.json();
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Candidates for a search or a category, in the API's order (relevance for a search) or, for a category listing, sorted by title; the unusable ones are left out.
 * @param {{ query?: string, category?: string, limit?: number, minWidth?: number }} options
 * @param {{ fetchJson?: (url: string) => Promise<any>, sleep?: (ms: number) => Promise<unknown> }} [io] replaced in tests
 */
export async function searchCommons({ query = '', category = '', limit = MAX_ROWS, minWidth = 800 }, { fetchJson = getJson, sleep = pause } = {}) {
  const rows = [];
  const seen = new Set();
  let cont = {};
  for (let n = 0; n < MAX_REQUESTS && rows.length < limit; n += 1) {
    if (n) await sleep(PAUSE_MS);
    const data = await fetchJson(requestUrl({ query, category }, cont));
    if (data.error) throw new Error(`${data.error.code}: ${data.error.info}`);
    // The pages of a generator come sorted by id; `index` is the rank in a search. A category listing has none: sort by title.
    const byRank = (a, b) => (a.index ?? 0) - (b.index ?? 0) || String(a.title).localeCompare(String(b.title));
    for (const page of [...(data.query?.pages ?? [])].sort(byRank)) {
      const row = parseImageInfo(page);
      if (!row || row.width < minWidth || seen.has(row.pageUrl)) continue;
      seen.add(row.pageUrl);
      rows.push(row);
    }
    if (!data.continue) break;
    cont = data.continue;
  }
  return rows.slice(0, Math.min(limit, MAX_ROWS));
}

/** Command-line options as search options. Throws a message for the user on a missing or bad value. */
export function parseArgs(args) {
  const known = ['--query', '--category', '--limit', '--min-width'];
  const given = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!known.includes(args[i])) throw new Error(`unknown option: ${args[i]}`);
    const value = args[i + 1];
    if (value === undefined || value.trim() === '' || value.startsWith('--')) throw new Error(`${args[i]} needs a value`);
    given[args[i]] = value;
  }
  const opts = { query: given['--query'] ?? '', category: given['--category'] ?? '', limit: Number(given['--limit'] ?? MAX_ROWS), minWidth: Number(given['--min-width'] ?? 800) };
  if ('--category' in given && !opts.category.replace(/^category:/i, '').trim()) throw new Error('--category needs a name after "Category:"');
  if (!opts.query.trim() && !opts.category.trim()) throw new Error('give --query "<text>" and/or --category "Category:..."');
  if (!Number.isInteger(opts.limit) || opts.limit < 1) throw new Error('--limit must be a whole number from 1 to 30');
  if (!Number.isInteger(opts.minWidth) || opts.minWidth < 0) throw new Error('--min-width must be a whole number of pixels');
  return { ...opts, limit: Math.min(opts.limit, MAX_ROWS) };
}

async function main(args) {
  const fail = (error, code) => {
    console.error(`commons-candidates: ${error.message}`);
    process.exit(code);
  };
  let opts;
  try {
    opts = parseArgs(args);
  } catch (error) {
    return fail(error, 2);
  }
  try {
    for (const row of await searchCommons(opts)) console.log(JSON.stringify(row));
  } catch (error) {
    fail(error, 1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
