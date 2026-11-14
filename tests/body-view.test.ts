import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { cameraFor, parseHash, roles, selectable, step, systemsFor, toHash, type BodyManifest } from '../src/lib/body-view.ts';

const box = (min: number[], max: number[]) => ({ box: { min, max }, centre: min.map((v, i) => (v + max[i]) / 2) });

const manifest: BodyManifest = {
  organs: {
    skin: { system: 'integumentary', kind: 'mesh', of: [], inside: null, ...box([-0.3, 0, -0.15], [0.3, 1.8, 0.15]) },
    heart: { system: 'cardiovascular', kind: 'mesh', of: [], inside: null, ...box([0, 1.2, 0], [0.1, 1.3, 0.1]) },
    aorta: { system: 'cardiovascular', kind: 'proxy', of: ['heart'], inside: null },
    lung: { system: 'respiratory', kind: 'mesh', of: [], inside: null, ...box([-0.2, 1.2, -0.1], [0.2, 1.5, 0.1]) },
    pleura: { system: 'respiratory', kind: 'mesh', of: [], inside: 'lung', ...box([-0.2, 1.2, -0.1], [0.2, 1.5, 0.1]) },
    marrow: { system: 'lymphoid', kind: 'none', of: [], inside: null },
  },
};

describe('parseHash', () => {
  it('reads a system and an organ, with or without #', () => {
    expect(parseHash('#sys-respiratory', manifest)).toEqual({ system: 'respiratory', organ: null });
    expect(parseHash('sys-respiratory', manifest)).toEqual({ system: 'respiratory', organ: null });
    expect(parseHash('#organ-lung', manifest)).toEqual({ system: 'respiratory', organ: 'lung' });
  });
  it('gives nulls for unknown ids and other hashes', () => {
    expect(parseHash('#sys-nope', manifest)).toEqual({ system: null, organ: null });
    expect(parseHash('#organ-nope', manifest)).toEqual({ system: null, organ: null });
    expect(parseHash('#other', manifest)).toEqual({ system: null, organ: null });
    expect(parseHash('', manifest)).toEqual({ system: null, organ: null });
  });
  it('round-trips with toHash', () => {
    expect(toHash({ system: null, organ: null })).toBe('');
    expect(toHash({ system: 'respiratory', organ: null })).toBe('#sys-respiratory');
    expect(toHash({ system: 'respiratory', organ: 'lung' })).toBe('#organ-lung');
    expect(parseHash(toHash({ system: 'respiratory', organ: 'lung' }), manifest)).toEqual({ system: 'respiratory', organ: 'lung' });
  });
});

describe('roles', () => {
  const all = new Set(Object.keys(manifest.organs));
  it('is idle everywhere when nothing is selected', () => {
    const { roles: r } = roles(manifest, { system: null, organ: null }, all);
    expect([...r.values()].every((v) => v === 'idle')).toBe(true);
    expect([...r.keys()]).toEqual(Object.keys(manifest.organs));
  });
  it('marks a system and ghosts the others', () => {
    const { roles: r } = roles(manifest, { system: 'respiratory', organ: null }, all);
    expect(r.get('lung')).toBe('system');
    expect(r.get('pleura')).toBe('system');
    expect(r.get('heart')).toBe('ghost');
  });
  it('selects an organ, keeps its system and ghosts other systems', () => {
    const { roles: r } = roles(manifest, { system: 'cardiovascular', organ: 'heart' }, all);
    expect(r.get('heart')).toBe('selected');
    expect(r.get('lung')).toBe('ghost');
  });
  it('a proxy selects its of', () => {
    const { roles: r } = roles(manifest, { system: 'cardiovascular', organ: 'aorta' }, all);
    expect(r.get('heart')).toBe('selected');
  });
  it('inside ghosts the container', () => {
    const { roles: r } = roles(manifest, { system: 'respiratory', organ: 'pleura' }, all);
    expect(r.get('pleura')).toBe('selected');
    expect(r.get('lung')).toBe('ghost');
  });
  it('lists organs without a published card as empty', () => {
    const { empty } = roles(manifest, { system: null, organ: null }, new Set(['heart', 'lung']));
    expect([...empty]).toEqual(['skin', 'aorta', 'pleura', 'marrow']);
  });
});

describe('selectable', () => {
  it('lists every organ but the shell, in anatomy order, when no system is selected', () => {
    expect(selectable(manifest, { system: null, organ: null })).toEqual(['heart', 'aorta', 'lung', 'pleura', 'marrow']);
  });
  it('limits to the system', () => {
    expect(selectable(manifest, { system: 'respiratory', organ: null })).toEqual(['lung', 'pleura']);
  });
  it('offers the shell only for skin', () => {
    expect(selectable(manifest, { system: 'integumentary', organ: null })).toEqual(['skin']);
  });
});

describe('step', () => {
  const list = ['a', 'b', 'c'];
  it('moves and wraps', () => {
    expect(step(list, 'a', 1)).toBe('b');
    expect(step(list, 'c', 1)).toBe('a');
    expect(step(list, 'a', -1)).toBe('c');
  });
  it('starts at the ends when nothing is current, and handles an empty list', () => {
    expect(step(list, null, 1)).toBe('a');
    expect(step(list, null, -1)).toBe('c');
    expect(step([], 'a', 1)).toBeNull();
  });
});

describe('cameraFor', () => {
  const body = { min: [-0.3, 0, -0.15], max: [0.3, 1.8, 0.15] };
  const dist = (p: number[], t: number[]) => Math.hypot(p[0] - t[0], p[1] - t[1], p[2] - t[2]);
  it('looks at the box centre from the front, back and side', () => {
    const front = cameraFor(body, 1, 'front');
    expect(front.target).toEqual([0, 0.9, 0]);
    expect(front.position[2]).toBeGreaterThan(0);
    expect(front.position[0]).toBe(0);
    expect(cameraFor(body, 1, 'back').position[2]).toBeLessThan(0);
    expect(cameraFor(body, 1, 'side').position[0]).toBeGreaterThan(0);
  });
  it('fits the whole body: a portrait aspect stands farther than a landscape one', () => {
    const portrait = dist(cameraFor(body, 0.5, 'front').position, [0, 0.9, 0]);
    const landscape = dist(cameraFor(body, 2, 'front').position, [0, 0.9, 0]);
    expect(portrait).toBeGreaterThanOrEqual(landscape);
    const halfHeight = Math.tan((40 * Math.PI) / 360) * (portrait - 0.15);
    expect(halfHeight).toBeGreaterThan(0.9);
  });
  it('fits the width in a very narrow portrait view', () => {
    const wide = { min: [-1, 0, -0.1], max: [1, 0.2, 0.1] };
    const d = dist(cameraFor(wide, 0.4, 'front').position, [0, 0.1, 0]);
    expect(Math.tan((40 * Math.PI) / 360) * 0.4 * (d - 0.1)).toBeGreaterThan(1);
  });
  it('fits a small organ closer than the body', () => {
    const heart = manifest.organs.heart.box!;
    const near = dist(cameraFor(heart, 1, 'organ').position, manifest.organs.heart.centre!);
    expect(near).toBeLessThan(dist(cameraFor(body, 1, 'front').position, [0, 0.9, 0]));
    expect(cameraFor(heart, 1, 'organ').target).toEqual(manifest.organs.heart.centre);
  });
});

describe('systemsFor', () => {
  const m: BodyManifest = {
    organs: {
      bones: { system: 'skeleton', kind: 'mesh', of: [], inside: null },
      marrow: { system: 'blood', kind: 'proxy', of: ['bones'], inside: null },
      spleen: { system: 'blood', kind: 'mesh', of: [], inside: null },
      valves: { system: 'heart', kind: 'mesh', of: [], inside: 'heart-wall' },
      'heart-wall': { system: 'vessels', kind: 'mesh', of: [], inside: null },
    },
  };

  it('is the system alone when nothing stands for another system', () => {
    expect(systemsFor(m, 'skeleton')).toEqual(['skeleton']);
  });

  it('adds the system of the organ a proxy stands for, and of the container of an inner organ', () => {
    expect(systemsFor(m, 'blood')).toEqual(['blood', 'skeleton']);
    expect(systemsFor(m, 'heart')).toEqual(['heart', 'vessels']);
  });

  it('on the real manifest, bone marrow and the peritoneum bring the files of the organs they stand for', () => {
    const real = JSON.parse(readFileSync('public/anatomy/manifest.json', 'utf8')) as BodyManifest;
    expect(systemsFor(real, 'hematolymphoid')).toContain('bone-soft-tissue');
    expect(systemsFor(real, 'female-genital')).toContain('gastrointestinal');
    expect(systemsFor(real, 'heart')).toEqual(['heart']);
  });
});
