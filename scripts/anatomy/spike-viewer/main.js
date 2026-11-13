import {
  AmbientLight, BackSide, Box3, Color, DirectionalLight, DoubleSide, Group, HemisphereLight,
  Mesh, MeshBasicMaterial, MeshLambertMaterial, PerspectiveCamera, Raycaster, Scene,
  ShaderMaterial, Vector2, Vector3, WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

// Hard-coded copies of the tokens in src/styles/tokens.css (light, dark).
const THEMES = {
  light: { paper: '#f6f1e7', surface2: '#ede5d6', ink: '#211e27', hema: '#3a2e8c', eosin: '#ad2c5b' },
  dark: { paper: '#1b1c21', surface2: '#2c2e35', ink: '#e6e3dc', hema: '#aea7ff', eosin: '#ff8db4' },
};
const params = new URLSearchParams(location.search);
const theme = params.get('theme') === 'dark' ? 'dark' : 'light';
const C = THEMES[theme];
document.documentElement.style.colorScheme = theme;
document.body.style.background = C.paper;
document.body.style.color = C.ink;

const canvas = document.getElementById('stage');
const statusEl = document.getElementById('status');
const fpsEl = document.getElementById('fps');
const say = (t) => { statusEl.textContent = t; };

const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new Scene();
const camera = new PerspectiveCamera(35, 1, 0.1, 100);
scene.add(new HemisphereLight(0xffffff, 0x888888, 1.6));
const key = new DirectionalLight(0xffffff, 1.4);
key.position.set(2, 3, 4);
scene.add(key);
scene.add(new AmbientLight(0xffffff, 0.2));

const pivot = new Group();
scene.add(pivot);
const home = { yaw: 0, dist: 3 };
const view = { ...home };
const organs = [];
let shell = null;
let selected = null;
let needsFrame = true;

const shellMaterial = new ShaderMaterial({
  transparent: true, depthWrite: false, side: DoubleSide,
  uniforms: { color: { value: new Color(C.ink) }, alpha: { value: 0.5 } },
  vertexShader: `varying vec3 vN; varying vec3 vV;
    void main() { vec4 p = modelViewMatrix * vec4(position, 1.0);
      vN = normalize(normalMatrix * normal); vV = normalize(-p.xyz); gl_Position = projectionMatrix * p; }`,
  fragmentShader: `uniform vec3 color; uniform float alpha; varying vec3 vN; varying vec3 vV;
    void main() { float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.5);
      gl_FragColor = vec4(color, alpha * (0.04 + f)); }`,
});
const organMaterial = () => new MeshLambertMaterial({ color: C.eosin });
const hullMaterial = new MeshBasicMaterial({ color: C.ink, side: BackSide });

function paint() {
  for (const m of organs) {
    const on = m === selected;
    m.material.color.set(on ? C.hema : C.eosin);
    m.userData.hull.visible = on;
  }
  needsFrame = true;
}

function select(mesh) {
  selected = mesh;
  say(mesh ? `selected: ${mesh.name || '(unnamed)'}` : 'nothing selected');
  paint();
  render();
}

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * renderer.getPixelRatio())) renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function render() {
  needsFrame = false;
  resize();
  camera.position.set(Math.sin(view.yaw) * view.dist, 0, Math.cos(view.yaw) * view.dist);
  camera.lookAt(0, 0, 0);
  renderer.render(scene, camera);
}
const request = () => {
  if (needsFrame) return;
  needsFrame = true;
  requestAnimationFrame(() => needsFrame && render());
};

async function listAssets() {
  try {
    const r = await fetch('./assets/manifest.json');
    if (r.ok) return (await r.json()).map((n) => `./assets/${n}`);
  } catch { /* fall through to the directory listing */ }
  const html = await (await fetch('./assets/')).text();
  const names = [...html.matchAll(/href="([^"?#]+\.glb)"/g)].map((m) => m[1].split('/').pop());
  return [...new Set(names)].map((n) => `./assets/${n}`);
}

async function load() {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const urls = await listAssets();
  if (!urls.length) { say('no .glb in ./assets/'); return; }
  for (const url of urls) {
    const gltf = await loader.loadAsync(url);
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      if (/shell|skin/i.test(`${url} ${o.name}`)) {
        o.material = shellMaterial;
        o.renderOrder = 2;
        shell = o;
      } else {
        o.material = organMaterial();
        const hull = new Mesh(o.geometry, hullMaterial);
        hull.scale.setScalar(1.03);
        hull.visible = false;
        o.add(hull);
        o.userData.hull = hull;
        organs.push(o);
      }
    });
    pivot.add(gltf.scene);
  }
  const box = new Box3().setFromObject(pivot);
  const size = box.getSize(new Vector3()).length() || 1;
  pivot.position.copy(box.getCenter(new Vector3()).negate());
  home.dist = view.dist = size * 1.2;
  camera.far = size * 10;
  say(`${organs.length} organs${shell ? ' + shell' : ''}`);
  paint();
  render();
}

const step = { left: () => (view.yaw -= 0.3), right: () => (view.yaw += 0.3),
  in: () => (view.dist *= 0.8), out: () => (view.dist *= 1.25),
  reset: () => Object.assign(view, home) };
for (const b of document.querySelectorAll('button[data-act]')) {
  b.addEventListener('click', () => { step[b.dataset.act](); request(); });
}

const ray = new Raycaster();
let down = null;
canvas.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
canvas.addEventListener('pointerup', (e) => {
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) >= 6) return;
  const r = canvas.getBoundingClientRect();
  ray.setFromCamera(new Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
  const hit = ray.intersectObjects(organs, false)[0];
  select(hit ? hit.object : null);
});
addEventListener('resize', request);

function spin(ms) {
  let frames = 0;
  const t0 = performance.now();
  const tick = (t) => {
    view.yaw = ((t - t0) / 1000) * 0.8;
    render();
    frames += 1;
    if (t - t0 < ms) { requestAnimationFrame(tick); return; }
    const fps = (frames / (t - t0)) * 1000;
    fpsEl.textContent = `${fps.toFixed(1)} fps avg over ${((t - t0) / 1000).toFixed(1)} s`;
    document.body.dataset.fps = fps.toFixed(1);
  };
  requestAnimationFrame(tick);
}

load().then(() => { if (params.get('spin') === '1') spin(5000); })
  .catch((e) => say(`error: ${e.message}`));
