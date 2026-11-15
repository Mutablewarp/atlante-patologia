/**
 * The organ map of the interactive body (docs/BODY_SPEC.md §3): `scripts/anatomy/organ-map.yaml`, read for the
 * tree only (kind, the organs a proxy stands for, the container that hides an organ). Node-side, not for the browser.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { z } from 'astro/zod';

const Id = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const MapEntry = z.object({
  kind: z.enum(['mesh', 'hra', 'proxy', 'schematic', 'none']),
  of: z.array(Id).default([]),
  inside: Id.optional(),
  objects: z.array(z.string()).optional(), // HRA objects; their names say the sex of the reference (`lung-male/v1.3`)
});
const OrganMap = z.object({ organs: z.record(Id, MapEntry) });

export type BodyMapEntry = { kind: z.infer<typeof MapEntry>['kind']; of: string[]; inside?: string; /** an HRA organ whose reference object is male */ male?: boolean };

/** organ id -> how the body shows it. Throws when the file does not match the shape above. */
export function loadBodyMap(root: string = process.cwd()): Map<string, BodyMapEntry> {
  const raw = parse(readFileSync(join(root, 'scripts/anatomy/organ-map.yaml'), 'utf8'));
  const { organs } = OrganMap.parse(raw);
  return new Map(Object.entries(organs).map(([id, e]) => [id, { kind: e.kind, of: e.of, ...(e.inside ? { inside: e.inside } : {}), ...(e.objects?.length && e.objects.every((o) => /-male\//.test(o)) ? { male: true } : {}) }]));
}
