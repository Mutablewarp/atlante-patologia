import { Color } from 'three';
import { describe, expect, it } from 'vitest';
import { createLook, SHADERS } from '../src/scripts/body-3d-look.ts';

const colors = { eosin: '#ad2c5b', hema: '#3a2e8c', ink: '#211e27', surface2: '#ede5d6' };
const same = (a: Color, css: string) => a.equals(new Color().set(css));

describe('body look', () => {
  it('keeps every #include at the start of its line, or three.js leaves it in the shader source', () => {
    for (const [name, src] of Object.entries(SHADERS)) {
      for (const line of src.split('\n').filter((l) => l.includes('#include'))) expect(line.trim().startsWith('#include'), name).toBe(true);
    }
    expect(SHADERS.FRESNEL_FRAG).toContain('#include <colorspace_fragment>');
    expect(SHADERS.HULL_FRAG).toContain('#include <colorspace_fragment>');
  });

  it('grows the outline hull in eye space, so quantized meshes get a width in metres', () => {
    expect(SHADERS.HULL_VERT).toContain('modelViewMatrix * vec4(position');
    expect(SHADERS.HULL_VERT).not.toMatch(/position\s*\+\s*normal/);
  });

  it('draws muscle, bones and breast as ghosts in the whole-body view only', () => {
    const look = createLook(colors);
    expect(look.lookOf('skeletal-muscle', 'idle')).toBe('ghost');
    expect(look.lookOf('bones', 'idle')).toBe('ghost');
    expect(look.lookOf('breast', 'idle')).toBe('ghost');
    expect(look.lookOf('breast', 'system')).toBe('system');
    expect(look.lookOf('skeletal-muscle', 'system')).toBe('system');
    expect(look.lookOf('bones', 'selected')).toBe('selected');
    expect(look.lookOf('heart', 'idle')).toBe('idle');
  });

  it('shares one material per role, with the colours of the tokens', () => {
    const look = createLook(colors);
    expect(look.material('system', false)).toBe(look.material('system', false));
    expect(same(look.material('system', false).color, colors.eosin)).toBe(true);
    expect(same(look.material('selected', false).color, colors.hema)).toBe(true);
    const ghost = look.material('ghost', false);
    expect([ghost.transparent, ghost.opacity, ghost.depthWrite]).toEqual([true, 0.12, false]);
    const solid = look.material('system', false);
    expect([solid.transparent, solid.opacity, solid.depthWrite]).toEqual([false, 1, true]);
  });

  it('makes the ghost of the muscles fainter than the other ghosts, with its own material', () => {
    const look = createLook(colors);
    const muscle = look.material('ghost', false, 'skeletal-muscle');
    const other = look.material('ghost', false, 'liver');
    expect(muscle).not.toBe(other);
    expect(muscle.opacity).toBeLessThan(other.opacity);
    expect(look.material('ghost', false, 'skeletal-muscle')).toBe(muscle);
    expect(look.material('system', false, 'skeletal-muscle').opacity).toBe(1);
    look.setColors({ eosin: '#ff8db4' });
    expect(same(muscle.color, '#ff8db4')).toBe(true);
  });

  it('draws an organ with no published card lighter, but never the selected one', () => {
    const look = createLook(colors);
    expect(look.material('system', true).color.g).toBeGreaterThan(look.material('system', false).color.g);
    expect(same(look.material('selected', true).color, colors.hema)).toBe(true);
  });

  it('repaints the existing materials when the theme changes', () => {
    const look = createLook(colors);
    const m = look.material('system', false);
    look.setColors({ eosin: '#ff8db4', ink: '#e6e3dc' });
    expect(same(m.color, '#ff8db4')).toBe(true);
    expect(same(look.hull.uniforms.uColor.value, '#e6e3dc')).toBe(true);
    expect(same(look.shell.uniforms.uColor.value, '#e6e3dc')).toBe(true);
    expect(() => look.dispose()).not.toThrow();
  });
});
