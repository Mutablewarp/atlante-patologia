/**
 * Image metadata helpers (CONTENT_SCHEMA §5), pure so the build, the viewer
 * script and Vitest share them: stain code from the free `stain` text, relative
 * power from the free `magnification` text, the images of one `group`, and the
 * scale-bar length when `mpp` is known.
 */

/** Controlled stain list; `IHC:<marker>` and `other` complete it. */
export const STAINS = [
  'HE',
  'PAS',
  'PAS-D',
  'Perls',
  'von Kossa',
  'Alizarin red',
  'Congo red',
  'Masson trichrome',
  'reticulin',
  'Oil Red O',
  'Sudan',
  'Ziehl-Neelsen',
  'Grocott',
  'Gram',
  'Giemsa',
] as const;
export type StainCode = (typeof STAINS)[number] | `IHC:${string}` | 'other';

const STAIN_RE: [StainCode, RegExp][] = [
  // Case-sensitive on purpose: "HE"/"EE" must not match ordinary words.
  ['HE', /\bH\s*&\s*E\b|\bHE\b|\bEE\b|[Hh]a?ematoxylin[\s-]+(?:and|&)[\s-]+[Ee]osin|[Ee]matossilina[\s-]+(?:ed?\s+)?[Ee]osina/],
  ['PAS-D', /\bPAS[\s-]*(?:D\b|diastas)|\bD[\s-]*PAS\b/i],
  ['PAS', /\bPAS\b/i],
  ['Perls', /\bPerls\b|Prussian blue|blu di Prussia/i],
  ['von Kossa', /von\s*Kossa/i],
  ['Alizarin red', /alizarin/i],
  ['Congo red', /\bCongo\b/i],
  ['Masson trichrome', /tric(?:h)?rom/i],
  ['reticulin', /reticulin|reticolin/i],
  ['Oil Red O', /oil\s*red/i],
  ['Sudan', /\bSudan\b/i],
  ['Ziehl-Neelsen', /Ziehl|\bZN\b/],
  ['Grocott', /Grocott|\bGMS\b|methenamine silver/i],
  ['Gram', /\bGram\b/],
  ['Giemsa', /Giemsa/i],
];
const IHC_RE = [
  /(?:immunohistochemistry|immunoistochimica|\bIHC)\s*(?:for|per|:)?\s*(?!(?:and|with|e|con)\b)([A-Za-z0-9][\w-]*)/i,
  /\b([A-Za-z0-9][\w-]*)\s+(?:immunohistochemistry|immunoistochimica|IHC)\b/i,
];

/**
 * Controlled code for a free stain text: the one stain it names, `IHC:<marker>`
 * for one immunostain, else `other` (none recognised, or several in one figure).
 */
export function stainCode(text: string | undefined): StainCode | undefined {
  if (!text?.trim()) return undefined;
  const found = new Set<StainCode>(STAIN_RE.filter(([, re]) => re.test(text)).map(([code]) => code));
  if (found.has('PAS-D')) found.delete('PAS');
  const marker = IHC_RE.map((re) => re.exec(text)?.[1]).find(Boolean);
  if (marker) found.add(`IHC:${marker}`);
  return found.size === 1 ? [...found][0] : 'other';
}

export const POWERS = ['low', 'medium', 'high'] as const;
export type Power = (typeof POWERS)[number];

/** Relative power named first in the free `magnification` text ("intermediate" counts as medium). */
export function powerOf(text: string | undefined): Power | undefined {
  const m = /\b(low|medium|intermediate|high)\b/i.exec(text ?? '')?.[1]?.toLowerCase();
  return m === 'intermediate' ? 'medium' : (m as Power | undefined);
}

type Groupable = { id: string; group?: string | undefined; magnification?: string | undefined };

/** The image and the other images of its `group`, low to high power, then by id. */
export function groupMembers<T extends Groupable>(all: readonly T[], image: T): T[] {
  if (!image.group) return [image];
  const rank = (i: T) => POWERS.indexOf(powerOf(i.magnification)!) >>> 0; // unknown power sorts last
  return [image, ...all.filter((i) => i.group === image.group && i.id !== image.id)].sort(
    (a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id),
  );
}

/**
 * Scale bar for an image of `naturalW` px shown `shownW` CSS px wide: the
 * longest 1-2-5 length (µm) that fits in `maxPx`, and its width in CSS px.
 */
export function scaleBar(mpp: number, naturalW: number, shownW: number, maxPx = 120): { um: number; px: number } | undefined {
  if (!(mpp > 0 && naturalW > 0 && shownW > 0)) return undefined;
  const umPerPx = (mpp * naturalW) / shownW;
  const max = umPerPx * maxPx;
  const p = 10 ** Math.floor(Math.log10(max));
  const um = Number(([5, 2, 1].map((k) => k * p).find((v) => v <= max) ?? p).toPrecision(1));
  return { um, px: um / umPerPx };
}
