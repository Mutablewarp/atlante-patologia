#!/usr/bin/env node
/** The cards of a sub-batch that still need work (docs/agents/CONTRACTS.md §5):  node scripts/agent/next.mjs --batch W02 [--max 8]
 * Prints { packets, cards: [{ id, from }] } for content-batch.workflow.js: unpublished cards with a stage left, in manifest
 * order with P0 first; `from` is the first stage without a done report. A missing packet is built with packet.mjs. */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cli, manifestRows, option, ROOT, stageFrom } from './record.mjs';

const PACKET_FILES = ['row.json', 'source.txt', 'vocab.json', 'NOTES.md'];

/** Runs packet.mjs for one card: null on success, else why it failed. */
const buildWith = (root) => (id) => {
  const r = spawnSync(process.execPath, [join(root, 'scripts/agent/packet.mjs'), id], { cwd: root, encoding: 'utf8' });
  return r.status === 0 ? null : (r.stderr || r.stdout || r.error?.message || `exit ${r.status}`).replace(/\s+/g, ' ').trim().slice(0, 160);
};

export function next(root, { batch, max = 8, buildPacket = buildWith(root) }) {
  const queue = manifestRows(root, batch)
    .filter((r) => !r.published && r.kind !== 'pattern') // pattern rows are comparison pages with no flow yet: packet.mjs refuses them
    .map((r) => ({ id: r.id, p0: r.priority === 'P0', from: stageFrom(root, r.id) }))
    .filter((c) => c.from)
    .sort((a, b) => Number(b.p0) - Number(a.p0)); // stable: manifest order within P0 and within the rest
  const [cards, problems] = [[], []];
  for (const { id, from } of queue) {
    if (cards.length === max) break;
    const failed = PACKET_FILES.every((f) => existsSync(join(root, '.work/packets', id, f))) ? null : buildPacket(id);
    if (failed) problems.push(`${id}: ${failed}`);
    else cards.push({ id, from });
  }
  return { packets: '.work/packets', cards, problems };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  cli('next', () => {
    const batch = option(args, '--batch');
    const max = Number(option(args, '--max', '8'));
    if (!batch || !Number.isInteger(max) || max < 1) throw new Error('usage: node scripts/agent/next.mjs --batch W02 [--max 8]');
    const { problems, ...out } = next(ROOT, { batch, max });
    for (const p of problems) console.error(`next: ${p}`);
    console.log(JSON.stringify(out));
  });
}
