/**
 * The heavy half of <ap-body> (body-viewer.ts): loaded with a dynamic import when the learner starts 3D.
 * Assets are local (public/anatomy/); nothing is fetched from another origin. Selection logic lives in
 * src/lib/body-view.ts and the materials in body-3d-look.ts; this file loads the meshes and draws what those decide
 * (docs/BODY_SPEC.md sections 6 and 7).
 */
import { DirectionalLight, HemisphereLight, Mesh, PerspectiveCamera, Raycaster, Scene, Vector2, Vector3, WebGLRenderer, type Group, type Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { cameraFor, roles, selectable, systemsFor, type BodyManifest, type BodyState, type Box, type Role, type View } from '../lib/body-view.ts';
import { createLook, GHOST_WHOLE, type Colors } from './body-3d-look.ts';

export type { Colors };
type Manifest = BodyManifest & { shell: { file: string }; systems: Record<string, { file: string; organs: string[] }> };
type Pose = { target: Vector3; yaw: number; pitch: number; dist: number };

export type Controller = {
  showSystem(id: string | null): Promise<void>;
  select(organ: string | null): void;
  pick(x: number, y: number): string | null;
  act(name: 'left' | 'right' | 'up' | 'down' | 'in' | 'out' | 'reset' | 'front' | 'back' | 'side'): void;
  organs(): string[];
  setColors(colors: Colors): void;
  dispose(): void;
};
export type Options = {
  manifestUrl: string;
  reducedMotion: boolean;
  colors: Colors;
  /** Organs with a published card; the others are drawn lighter. Absent: all count as published. */
  published?: Iterable<string>;
  /** Called after each frame with the canvas position (CSS px) of the selected organ, or null: the page places its label there. */
  labelAt?: (point: { x: number; y: number } | null) => void;
  /** Called when the browser takes the WebGL context away after mount() has resolved (or a frame throws): show the poster and offer a retry. */
  onLost?: () => void;
  /** Called when a file of the whole-body prefetch fails: the viewer keeps what it has. A failure of showSystem(id) rejects instead. */
  onError?: (error: unknown) => void;
};

const SHELL = 'skin';
const MOVE_MS = 400;
const MIN_DIST = 0.06;
const MAX_DIST = 6;
const STEP = 0.3;
const PITCH_MAX = 1.4;

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const unionBox = (boxes: Box[]): Box => ({
  min: [0, 1, 2].map((i) => Math.min(...boxes.map((b) => b.min[i]))),
  max: [0, 1, 2].map((i) => Math.max(...boxes.map((b) => b.max[i]))),
});
const freeGeometries = (root: Object3D) => root.traverse((o) => (o as Mesh).geometry?.dispose());

export async function mount(canvas: HTMLCanvasElement, opts: Options): Promise<Controller> {
  const manifestUrl = new URL(opts.manifestUrl, location.href);
  const res = await fetch(manifestUrl);
  if (!res.ok) throw new Error(`manifest: HTTP ${res.status}`);
  const manifest = (await res.json()) as Manifest;
  const published = new Set(opts.published ?? Object.keys(manifest.organs));
  const allOrgans = Object.keys(manifest.organs);

  // Multisampling at pixel ratio 2 costs about 4x the memory for little gain: phones are already at that density.
  const renderer = new WebGLRenderer({ canvas, antialias: window.devicePixelRatio < 2, alpha: true });
  renderer.setClearColor(0x000000, 0);
  let lostReject: (e: Error) => void = () => {};
  const lost = new Promise<never>((_, reject) => (lostReject = reject));
  lost.catch(() => {}); // a rejection nobody awaits is not an unhandled error
  const onLost = (e: Event) => {
    e.preventDefault();
    lostReject(new Error('webglcontextlost'));
    opts.onLost?.();
  };
  canvas.addEventListener('webglcontextlost', onLost);
  const guard = <T>(p: Promise<T>) => Promise.race([p, lost]);

  const scene = new Scene();
  const camera = new PerspectiveCamera(40, 1, 0.01, 20);
  const key = new DirectionalLight(0xffffff, 2);
  key.position.set(-1, 2, 2);
  camera.add(key);
  scene.add(camera, new HemisphereLight(0xffffff, 0x8a8078, 2));

  const look = createLook(opts.colors);
  const meshesOf = new Map<string, Mesh[]>();
  const loaded: Group[] = [];
  const hulls: Mesh[] = [];
  const state: BodyState = { system: null, organ: null };
  let pose: Pose = { target: new Vector3(0, 0.86, 0), yaw: 0, pitch: 0, dist: 3 };
  let view: View | null = 'front'; // where the pose came from; null once the learner moved the camera by hand
  let move: { from: Pose; to: Pose; start: number } | null = null;
  let frame = 0;
  let shown = false; // the shell is in the scene
  let firstFrame = () => {};
  const ready = new Promise<void>((resolve) => (firstFrame = resolve));
  let disposed = false;
  let observer: ResizeObserver | undefined;

  const framing = (): Box => {
    const ids = state.organ ? [state.organ, ...(manifest.organs[state.organ]?.of ?? [])] : allOrgans.filter((id) => state.system !== null && manifest.organs[id].system === state.system);
    const boxes = ids.map((id) => manifest.organs[id]?.box).filter((b): b is Box => !!b);
    return boxes.length ? unionBox(boxes) : manifest.organs[SHELL].box!;
  };
  const poseFor = (v: View): Pose => {
    const { position, target } = cameraFor(framing(), camera.aspect, v);
    const off = new Vector3(...position).sub(new Vector3(...target));
    return { target: new Vector3(...target), dist: off.length(), yaw: Math.atan2(off.x, off.z), pitch: Math.asin(off.y / off.length()) };
  };
  const goTo = (to: Pose) => {
    if (opts.reducedMotion) {
      move = null;
      pose = to;
    } else {
      to.yaw = pose.yaw + Math.atan2(Math.sin(to.yaw - pose.yaw), Math.cos(to.yaw - pose.yaw));
      move = { from: { ...pose, target: pose.target.clone() }, to, start: performance.now() };
    }
    invalidate();
  };

  function restyle() {
    const { roles: map, empty } = roles(manifest, state, published);
    for (const h of hulls) h.removeFromParent();
    hulls.length = 0;
    if (state.organ) {
      const box = framing();
      look.hull.uniforms.uT.value = clamp(0.012 * Math.max(...box.max.map((v, i) => v - box.min[i])), 0.0004, 0.002); // metres
    }
    for (const [id, meshes] of meshesOf) {
      const role = map.get(id) ?? 'idle';
      if (id === SHELL) {
        for (const m of meshes) {
          m.material = look.shell;
          m.renderOrder = 3;
        }
        look.shell.uniforms.uAlpha.value = role === 'selected' || role === 'system' ? 0.9 : 0.5;
        continue;
      }
      const as: Role = look.lookOf(id, role);
      for (const m of meshes) {
        m.material = look.material(as, empty.has(id), id);
        m.renderOrder = as === 'ghost' ? 1 : 0;
        m.userData.ghost = as === 'ghost';
        if (role !== 'selected') continue;
        const hull = new Mesh(m.geometry, look.hull);
        hull.position.copy(m.position); // the node carries the quantization scale: copy it, the matrix may not be built yet
        hull.quaternion.copy(m.quaternion);
        hull.scale.copy(m.scale);
        m.parent?.add(hull);
        hulls.push(hull);
      }
    }
    invalidate();
  }

  let token = 0;
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const collect = (root: Object3D, ids: Set<string>, shell: boolean) => {
    root.traverse((o) => {
      if (!(o as Mesh).isMesh) return;
      const id = shell ? SHELL : ids.has(o.name) ? o.name : ids.has(o.parent?.name ?? '') ? o.parent!.name : null;
      if (!id) return;
      o.userData.organ = id;
      meshesOf.set(id, [...(meshesOf.get(id) ?? []), o as Mesh]);
    });
  };
  const loadFile = async (file: string, ids: Set<string>, shell: boolean) => {
    const gltf = await guard(loader.loadAsync(new URL(file, manifestUrl).href));
    if (disposed) return freeGeometries(gltf.scene);
    collect(gltf.scene, ids, shell);
    loaded.push(gltf.scene);
    scene.add(gltf.scene);
    restyle();
  };
  const pending = new Map<string, Promise<void>>();
  const ensure = (system: string): Promise<void> => {
    const s = manifest.systems[system];
    if (!s || disposed) return Promise.resolve(); // `skin` has no file of its own: the shell is its mesh
    let p = pending.get(system);
    if (!p) {
      p = loadFile(s.file, new Set(s.organs), false);
      pending.set(system, p);
      p.catch(() => pending.delete(system)); // a failed file can be retried
    }
    return p;
  };

  /** The whole-body view: every system, the heavy ghosts last, one file at a time (each decode runs on the main thread). */
  const prefetch = async (mine: number) => {
    const late = new Set([...GHOST_WHOLE].map((id) => manifest.organs[id]?.system));
    const order = Object.keys(manifest.systems).sort((a, b) => Number(late.has(a)) - Number(late.has(b)));
    try {
      for (const s of order) {
        if (mine !== token || disposed) return;
        await guard(ensure(s));
      }
    } catch (e) {
      if (!disposed) opts.onError?.(e);
    }
  };

  const place = () => {
    const { target, yaw, pitch, dist } = pose;
    camera.position.set(target.x + dist * Math.sin(yaw) * Math.cos(pitch), target.y + dist * Math.sin(pitch), target.z + dist * Math.cos(yaw) * Math.cos(pitch));
    camera.lookAt(target);
  };
  const draw = (now: number) => {
    frame = 0;
    if (disposed) return;
    try {
      drawFrame(now);
    } catch (e) {
      lostReject(e instanceof Error ? e : new Error(String(e))); // the same way out as a lost context: poster, message, retry
      opts.onLost?.();
    }
  };
  const drawFrame = (now: number) => {
    if (move) {
      const t = clamp((now - move.start) / MOVE_MS, 0, 1);
      const k = ease(t);
      const { from, to } = move;
      pose = { target: from.target.clone().lerp(to.target, k), yaw: from.yaw + (to.yaw - from.yaw) * k, pitch: from.pitch + (to.pitch - from.pitch) * k, dist: from.dist + (to.dist - from.dist) * k };
      if (t === 1) move = null;
    }
    place();
    renderer.render(scene, camera);
    if (shown) firstFrame();
    if (opts.labelAt) {
      const o = state.organ ? manifest.organs[state.organ] : undefined;
      const at = o?.centre ?? manifest.organs[o?.of[0] ?? '']?.centre; // a proxy points at the organ it stands for
      const p = at ? new Vector3(at[0], at[1], at[2]).project(camera) : null;
      opts.labelAt(p && p.z < 1 ? { x: ((p.x + 1) / 2) * canvas.clientWidth, y: ((1 - p.y) / 2) * canvas.clientHeight } : null);
    }
    if (move) invalidate();
  };
  function invalidate() {
    if (!frame && !disposed) frame = requestAnimationFrame(draw);
  }

  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    if (renderer.getPixelRatio() !== ratio) renderer.setPixelRatio(ratio);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (view && !move) pose = poseFor(view); // the stage changed shape: fit again, unless the learner moved the camera
    // setSize cleared the canvas: draw now, or one frame shows an empty stage
    if (frame) cancelAnimationFrame(frame);
    draw(performance.now());
  };

  // Drag rotates (touch: horizontally only, the page keeps the vertical scroll); a pinch, or ctrl + wheel, zooms.
  const pointers = new Map<number, { x: number; y: number }>();
  let pinch = 0;
  const spread = () => {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  const zoom = (f: number) => {
    move = null;
    view = null;
    pose.dist = clamp(pose.dist * f, MIN_DIST, MAX_DIST);
    invalidate();
  };
  const onDown = (e: PointerEvent) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    canvas.setPointerCapture(e.pointerId);
    if (pointers.size === 2) pinch = spread();
  };
  const onMove = (e: PointerEvent) => {
    const last = pointers.get(e.pointerId);
    if (!last) return;
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const now = spread();
      if (pinch && now) zoom(pinch / now);
      pinch = now;
      return;
    }
    move = null;
    view = null;
    pose.yaw -= dx * 0.008;
    if (e.pointerType !== 'touch') pose.pitch = clamp(pose.pitch + dy * 0.008, -PITCH_MAX, PITCH_MAX);
    invalidate();
  };
  const onUp = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    pinch = 0;
  };
  const onWheel = (e: WheelEvent) => {
    if (!e.ctrlKey) return; // a plain wheel scrolls the page; a pinch on a trackpad arrives as ctrl + wheel
    e.preventDefault();
    zoom(Math.exp(clamp(e.deltaY, -25, 25) * 0.01));
  };
  function dispose() {
    disposed = true;
    cancelAnimationFrame(frame);
    observer?.disconnect();
    canvas.removeEventListener('webglcontextlost', onLost);
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onUp);
    canvas.removeEventListener('wheel', onWheel);
    for (const g of loaded) freeGeometries(g);
    look.dispose();
    renderer.dispose();
    renderer.forceContextLoss(); // dispose() leaves the context alive; the next start gets a new canvas
  }

  try {
    observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    await loadFile(manifest.shell.file, new Set([SHELL]), true);
    shown = true;
    pose = poseFor('front');
    invalidate();
    await guard(ready); // the poster goes away only once a frame with the shell has been drawn
  } catch (e) {
    dispose();
    throw e;
  }

  const ray = new Raycaster();
  return {
    async showSystem(id) {
      const mine = ++token;
      state.system = id;
      state.organ = null;
      restyle();
      view = 'front';
      goTo(poseFor('front'));
      if (id === null) {
        void prefetch(mine); // nothing waits for the whole body: a tap on a system must not queue behind 17 files
        return;
      }
      for (const s of systemsFor(manifest, id)) {
        if (mine !== token || disposed) return;
        await guard(ensure(s));
      }
    },
    select(organ) {
      state.organ = organ && manifest.organs[organ] ? organ : null;
      restyle();
      view = state.organ ? 'organ' : 'front';
      goTo(poseFor(view));
    },
    pick(x, y) {
      const meshes = selectable(manifest, state).flatMap((id) => meshesOf.get(id) ?? []);
      ray.setFromCamera(new Vector2((x / canvas.clientWidth) * 2 - 1, -(y / canvas.clientHeight) * 2 + 1), camera);
      // A ghost (muscle and bones in the whole-body view, the container of an inner organ) loses to a solid organ behind
      // it, and is tested only when no solid organ is under the point: the ghosts are the largest meshes.
      const hit = ray.intersectObjects(meshes.filter((m) => !m.userData.ghost), false)[0] ?? ray.intersectObjects(meshes.filter((m) => m.userData.ghost), false)[0];
      return (hit?.object.userData.organ as string | undefined) ?? null;
    },
    act(name) {
      if (name === 'front' || name === 'back' || name === 'side' || name === 'reset') {
        view = name === 'reset' ? (state.organ ? 'organ' : 'front') : name;
        goTo(poseFor(view));
        return;
      }
      view = null;
      const to: Pose = { ...pose, target: pose.target.clone() };
      if (name === 'left') to.yaw += STEP;
      else if (name === 'right') to.yaw -= STEP;
      else if (name === 'up') to.pitch = clamp(to.pitch + STEP, -PITCH_MAX, PITCH_MAX);
      else if (name === 'down') to.pitch = clamp(to.pitch - STEP, -PITCH_MAX, PITCH_MAX);
      else to.dist = clamp(to.dist * (name === 'in' ? 0.8 : 1.25), MIN_DIST, MAX_DIST);
      goTo(to);
    },
    organs: () => selectable(manifest, state),
    setColors(next) {
      look.setColors(next);
      invalidate();
    },
    dispose,
  };
}
