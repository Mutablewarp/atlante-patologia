/**
 * Look of the body (docs/BODY_SPEC.md section 7): the shell, the organ and outline materials, and the colours they read.
 * No scene, no loading: body-3d.ts owns those. Built with plain three.js classes, so it runs without WebGL.
 */
import { BackSide, Color, MeshLambertMaterial, ShaderMaterial } from 'three';
import type { Role } from '../lib/body-view.ts';

/** CSS colours by token name: `eosin`, `hema`, `ink`, `surface2`. Any string three.js can parse (hex, rgb(), hsl()). */
export type Colors = Record<string, string>;

/** Solid, these hide every other organ in the whole-body view (spec section 7): the breast covers the chest. */
export const GHOST_WHOLE = new Set(['skeletal-muscle', 'bones', 'breast']);
const GHOST_ALPHA = 0.12;
/** Hundreds of overlapping muscles at the usual alpha make a fog over the organ in front of the camera. */
const FAINT = new Set(['skeletal-muscle']);
const FAINT_ALPHA = 0.04;

// Each `#include` stands on its own line, or three.js leaves it in the source and the shader does not compile.
const FRESNEL_VERT = `
varying vec3 vN;
varying vec3 vV;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const FRESNEL_FRAG = `
uniform vec3 uColor;
uniform float uAlpha;
varying vec3 vN;
varying vec3 vV;
void main() {
  float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.5);
  gl_FragColor = vec4(uColor, clamp(uAlpha * (0.15 + f), 0.0, 1.0));
  #include <colorspace_fragment>
}`;
// The hull grows in eye space: the meshes are quantized, so their local units are the organ's own half-size, not metres.
const HULL_VERT = `
uniform float uT;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  mv.xyz += normalize(normalMatrix * normal) * uT;
  gl_Position = projectionMatrix * mv;
}`;
const HULL_FRAG = `
uniform vec3 uColor;
void main() {
  gl_FragColor = vec4(uColor, 1.0);
  #include <colorspace_fragment>
}`;

export const SHADERS = { FRESNEL_VERT, FRESNEL_FRAG, HULL_VERT, HULL_FRAG };

export function createLook(initial: Colors) {
  const colors: Colors = { ...initial };
  const col = (name: string, fallback: string) => new Color().set(colors[name] ?? fallback);
  /** The translucent body outline, drawn last. Uniform `uAlpha` is set by the scene. */
  const shell = new ShaderMaterial({ vertexShader: FRESNEL_VERT, fragmentShader: FRESNEL_FRAG, transparent: true, depthWrite: false, uniforms: { uColor: { value: new Color() }, uAlpha: { value: 0.5 } } });
  /** Back-face copy of the selected organ. Uniform `uT` is its width in metres. */
  const hull = new ShaderMaterial({ vertexShader: HULL_VERT, fragmentShader: HULL_FRAG, side: BackSide, uniforms: { uColor: { value: new Color() }, uT: { value: 0.0015 } } });
  type Key = { role: Role; empty: boolean };
  const organs = new Map<string, MeshLambertMaterial & { userData: Key }>();

  const tint = (role: Role, empty: boolean): Color => {
    const base = col(role === 'selected' ? 'hema' : 'eosin', '#b4476b');
    if (role === 'idle') base.lerp(col('surface2', '#eeeeee'), 0.4);
    return empty && role !== 'selected' ? base.lerp(col('surface2', '#eeeeee'), 0.5) : base;
  };
  const paint = () => {
    for (const m of organs.values()) m.color.copy(tint(m.userData.role, m.userData.empty));
    shell.uniforms.uColor.value.copy(col('ink', '#222222'));
    hull.uniforms.uColor.value.copy(col('ink', '#222222'));
  };
  paint();

  return {
    shell,
    hull,
    /** The role an organ is drawn with: in the whole-body view muscle and bones are ghosts, not solid. */
    lookOf: (id: string, role: Role): Role => (role === 'idle' && GHOST_WHOLE.has(id) ? 'ghost' : role),
    /** One shared material per role; an organ with no published card (`empty`) is lighter; `id` picks the fainter ghost of the muscles. */
    material(role: Role, empty: boolean, id = ''): MeshLambertMaterial {
      const ghost = role === 'ghost';
      const faint = ghost && FAINT.has(id);
      const key = `${role}${empty ? '-empty' : ''}${faint ? '-faint' : ''}`;
      let m = organs.get(key);
      if (!m) {
        m = new MeshLambertMaterial({ color: tint(role, empty), transparent: ghost, opacity: !ghost ? 1 : faint ? FAINT_ALPHA : GHOST_ALPHA, depthWrite: !ghost }) as MeshLambertMaterial & { userData: Key };
        m.userData = { role, empty };
        organs.set(key, m);
      }
      return m;
    },
    /** A theme change: new token colours, same materials. */
    setColors(next: Colors) {
      Object.assign(colors, next);
      paint();
    },
    dispose() {
      shell.dispose();
      hull.dispose();
      for (const m of organs.values()) m.dispose();
    },
  };
}
export type Look = ReturnType<typeof createLook>;
