// 按名字取模型：优先用 Lux3D 生成的 GLB，没有就用代码画的版本顶上
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { figurine } from './figurines.js';
import { makeCanvas, canvasTex } from '../core/util.js';
import { FACE_X, MODEL_CONF as MODEL_CONF_REGISTRY } from '../data/model-registry.js';
import { modelUrl, genManifestUrl, genModelUrl } from '../core/paths.js';

// 模型登记表（FACE_X / MODEL_CONF）搬到了 ../data/model-registry.js，这里原样再导出，
// 保证 `import { MODEL_CONF } from '../actors/models.js'` 继续可用（同一个对象，不是副本）。
/**
 * 全部模型的登记表：名字 → { h, yaw, file?, tripo?, long? }。
 * @type {Record<string, import('../data/model-registry.js').ModelConf>}
 */
export const MODEL_CONF = MODEL_CONF_REGISTRY;
/** @see ../data/model-registry.js */
export { FACE_X };

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const cache = {};
/**
 * 每个名字的加载结果：true 表示 GLB 加载成功，false 表示失败（可能已用代码版本顶上）。
 * @type {Record<string, boolean>}
 */
export const loaded = {};

// Tripo 模型的材质常带奇怪的金属度，按“哑光手办”统一一下
function tameMaterials(obj) {
  obj.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m) continue;
      if ('roughness' in m) m.roughness = Math.max(0.45, m.roughness ?? 0.8);
      if ('metalness' in m) m.metalness = Math.min(0.15, m.metalness ?? 0);
      m.transparent = false; m.depthWrite = true;
    }
  });
}

function normalize(obj, conf) {
  obj.rotation.y = conf.yaw || 0;
  const wrap = new THREE.Group();
  wrap.add(obj);
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  let s = conf.h / size.y;
  if (conf.long) s = Math.min(s, conf.long / Math.max(size.x, size.z));
  obj.scale.multiplyScalar(s);
  obj.updateMatrixWorld(true);
  box.setFromObject(obj);
  const c = box.getCenter(new THREE.Vector3());
  obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= box.min.y;
  obj.traverse((m) => {
    if (m.isMesh) {
      m.castShadow = true; m.receiveShadow = true;
      if (m.material) { m.material.envMapIntensity = 1.2; }
    }
  });
  return wrap;
}

/**
 * 预加载一批模型。优先加载 assets/models/ 下的 GLB；失败时用代码画的版本顶上。
 * document.documentElement.dataset.models === 'procedural' 时直接走代码版本。
 * @param {string[]} names MODEL_CONF 里的名字
 * @param {(name: string) => void} [onEach] 每加载完一个回调一次
 * @returns {Promise<void>}
 */
export async function preload(names, onEach) {
  await Promise.all(names.map(async (name) => {
    const conf = MODEL_CONF[name];
    if (document.documentElement.dataset.models === 'procedural') {
      const factory = name === 'bigfrog' ? FALLBACK.naiwa : FALLBACK[name];
      cache[name] = normalize(factory ? factory() : figurine(name), { ...conf, yaw: 0 });
      loaded[name] = true;
      onEach?.(name);
      return;
    }
    try {
      const g = await loader.loadAsync(modelUrl(conf.file || name));
      if (conf.tripo) tameMaterials(g.scene);
      if (name === 'naiwa') g.scene.traverse((o) => {
        if (o.isSkinnedMesh) {
          o.material = o.material.clone();
          o.material.normalMap = null;
          o.material.normalScale?.set(0, 0);
          o.material.roughness = .62;
        }
      });
      cache[name] = normalize(g.scene, conf);
      cache[name].animations = g.animations || []; // 复制时会一起带上，NPC 用 AnimationMixer 播
      loaded[name] = true;
    } catch (e) {
      console.warn(`[models] ${name}.glb 加载失败${FALLBACK[name] ? '，用代码版本顶上' : '，这个角色先不出场'}：`, e && e.message);
      if (FALLBACK[name]) cache[name] = normalize(FALLBACK[name](), { ...conf, yaw: 0 });
      loaded[name] = false;
    }
    if (onEach) onEach(name);
  }));
}

/**
 * 这个模型有没有加载成功。
 * @param {string} name MODEL_CONF 里的名字
 * @returns {boolean}
 */
export const hasModel = (name) => !!cache[name];

// 带骨骼的模型要用 SkeletonUtils 复制，不然复制品会跟着原件的骨骼跑
/**
 * 取一份模型副本（带骨骼的用 SkeletonUtils 深拷贝，动画片段挂在 .animations 上）。
 * @param {string} name MODEL_CONF 里的名字
 * @returns {THREE.Object3D} 可以直接加进场景的副本
 */
export function getModel(name) {
  return cloneSkinned(cache[name]);
}

// ---------- 代码画的备用模型 ----------
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0, ...o });

function eye(r = 0.12) {
  const g = new THREE.Group();
  const w = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), std(0xffffff, { roughness: 0.15 }));
  const p = new THREE.Mesh(new THREE.SphereGeometry(r * 0.55, 16, 12), std(0x111111, { roughness: 0.05 }));
  p.position.z = r * 0.6;
  g.add(w, p);
  return g;
}

function riceCooker() {
  const g = new THREE.Group();
  const metal = std(0xd8dde2, { metalness: 0.9, roughness: 0.22 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.38, 0.36, 40), metal);
  const lid = new THREE.Mesh(new THREE.SphereGeometry(0.43, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), std(0xf2f2f2, { roughness: 0.3 }));
  lid.scale.y = 0.45; lid.position.y = 0.18;
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.08, 16), std(0x333333));
  knob.position.y = 0.38;
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.02), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.3, 0.2) }));
  led.position.set(0, 0.02, 0.4);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 8, 24, Math.PI), std(0x222222));
  handle.position.y = 0.3; handle.rotation.y = Math.PI / 2;
  g.add(body, lid, knob, led, handle);
  return g;
}

const FALLBACK = {
  naiwa() {
    const g = new THREE.Group();
    const white = std(0xf7f3ea, { roughness: 0.32 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 40, 28), white);
    body.scale.set(1, 0.95, 0.9); body.position.y = 0.55; g.add(body);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.38, 32, 20), std(0xfff6d8, { roughness: 0.4 }));
    belly.position.set(0, 0.48, 0.18); belly.scale.set(1, 0.9, 0.6); g.add(belly);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 40, 28), white);
    head.scale.set(1.15, 0.8, 1); head.position.y = 1.0; g.add(head);
    for (const s of [-1, 1]) {
      const e = eye(0.13); e.position.set(s * 0.22, 1.18, 0.25); g.add(e);
      const leg = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 14), white);
      leg.scale.set(1.2, 0.6, 1.6); leg.position.set(s * 0.25, 0.08, 0.1); g.add(leg);
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.25, 6, 12), white);
      arm.position.set(s * 0.5, 0.6, 0.05); arm.rotation.z = s * 0.6; g.add(arm);
      const blush = new THREE.Mesh(new THREE.CircleGeometry(0.06, 16), new THREE.MeshBasicMaterial({ color: 0xff9aa8 }));
      blush.position.set(s * 0.3, 0.98, 0.39); g.add(blush);
    }
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.02, 8, 24, Math.PI), std(0x553333));
    mouth.position.set(0, 0.95, 0.4); mouth.rotation.z = Math.PI; g.add(mouth);
    const rc = riceCooker(); rc.position.y = 1.28; rc.scale.setScalar(0.85); g.add(rc);
    return g;
  },
  kangaroo() {
    const g = new THREE.Group();
    const fur = std(0xb7794a, { roughness: 0.7 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.6, 8, 20), fur);
    body.position.y = 0.9; body.rotation.x = 0.2; g.add(body);
    const vest = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.4, 0.5, 24, 1, true), std(0xffc81e, { roughness: 0.5 }));
    vest.position.y = 1.0; g.add(vest);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 24, 16), fur);
    head.position.set(0, 1.6, 0.1); head.scale.set(1, 1, 1.3); g.add(head);
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.3, 12), fur);
      ear.position.set(s * 0.12, 1.85, 0); g.add(ear);
      const e = eye(0.06); e.position.set(s * 0.1, 1.66, 0.36); g.add(e);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 0.5), fur);
      foot.position.set(s * 0.18, 0.05, 0.15); g.add(foot);
    }
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.9, 12), fur);
    tail.position.set(0, 0.4, -0.5); tail.rotation.x = -1.2; g.add(tail);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 0.25), std(0xc8a070, { roughness: 0.9 }));
    box.position.set(0, 0.85, 0.35); g.add(box);
    return g;
  },
  niulai() {
    const g = new THREE.Group();
    const hide = std(0x3b2a22, { roughness: 0.6 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 1.6, 4, 4, 4), hide);
    body.position.y = 0.9; g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.55, 0.6), hide);
    head.position.set(0, 1.25, 0.95); g.add(head);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.2), std(0xe8a0a0));
    snout.position.set(0, 1.1, 1.3); g.add(snout);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.015, 8, 20), std(0xffd040, { metalness: 1, roughness: 0.2 }));
    ring.position.set(0, 1.0, 1.41); g.add(ring);
    const glasses = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.12, 0.05), std(0x050505, { roughness: 0.05, metalness: 0.5 }));
    glasses.position.set(0, 1.35, 1.26); g.add(glasses);
    for (const s of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3, 12), std(0xf0e6d0));
      horn.position.set(s * 0.33, 1.6, 0.9); horn.rotation.z = -s * 0.8; g.add(horn);
      for (const z of [-0.6, 0.6]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.55, 0.2), hide);
        leg.position.set(s * 0.3, 0.27, z); g.add(leg);
      }
    }
    return g;
  },
  ebike() {
    const g = new THREE.Group();
    const mint = std(0x8fe3c8, { roughness: 0.25, metalness: 0.1 });
    const dark = std(0x1c1c1c, { roughness: 0.6 });
    for (const z of [-0.7, 0.7]) {
      const w = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.09, 12, 28), dark);
      w.rotation.y = Math.PI / 2; w.position.set(0, 0.32, z); g.add(w);
    }
    const deck = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 1.2), mint);
    deck.position.set(0, 0.45, 0); g.add(deck);
    const front = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.7, 0.25), mint);
    front.position.set(0, 0.8, 0.6); front.rotation.x = -0.25; g.add(front);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.55), dark);
    seat.position.set(0, 0.75, -0.3); g.add(seat);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7), dark);
    bar.rotation.z = Math.PI / 2; bar.position.set(0, 1.2, 0.7); g.add(bar);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 5, 4) }));
    lamp.position.set(0, 1.05, 0.78); g.add(lamp);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.45), std(0xffd21e, { roughness: 0.4 }));
    box.position.set(0, 1.02, -0.65); g.add(box);
    return g;
  },
};

// ---------- 纸板立牌（梗角色、亲戚、班主任） ----------
/**
 * 画一张纸板立牌（梗角色、亲戚、班主任）。正反两面各一块，从背后看字也是正的。
 * @param {{name: string, color?: string, face?: 'grin'|'sleep'|'shy'|'side'|'star'|'eat'|'calm', label?: boolean, h?: number}} opts 立牌参数
 * @returns {THREE.Group} 立牌（底面在 y=0）
 */
export function standee({ name, color = '#ffcf5a', face = 'grin', label = true, h = 1.8 }) {
  const [c, x] = makeCanvas(256, 512);
  x.clearRect(0, 0, 256, 512);
  // 身体轮廓
  x.fillStyle = '#b48a5a';
  x.beginPath(); x.ellipse(128, 150, 92, 96, 0, 0, Math.PI * 2); x.fill();
  x.fillRect(58, 220, 140, 250);
  x.fillStyle = color;
  x.beginPath(); x.ellipse(128, 146, 84, 88, 0, 0, Math.PI * 2); x.fill();
  x.fillRect(66, 228, 124, 236);
  x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(66, 228, 124, 30);
  // 脸
  x.fillStyle = '#222'; x.strokeStyle = '#222'; x.lineWidth = 8; x.lineCap = 'round';
  const eyes = (y, closed) => {
    if (closed) { x.beginPath(); x.moveTo(84, y); x.lineTo(112, y); x.moveTo(144, y); x.lineTo(172, y); x.stroke(); }
    else { x.beginPath(); x.arc(98, y, 12, 0, 7); x.arc(158, y, 12, 0, 7); x.fill(); }
  };
  if (face === 'sleep') { eyes(130, true); x.font = '700 40px sans-serif'; x.fillText('z', 190, 80); }
  else if (face === 'shy') { eyes(130, false); x.fillStyle = '#ff8aa0'; x.fillRect(70, 160, 30, 12); x.fillRect(156, 160, 30, 12); }
  else if (face === 'side') { x.beginPath(); x.arc(110, 130, 10, 0, 7); x.arc(170, 130, 10, 0, 7); x.fill(); }
  else if (face === 'star') { x.font = '700 44px sans-serif'; x.fillText('★', 74, 146); x.fillText('★', 136, 146); }
  else eyes(130, false);
  x.beginPath();
  if (face === 'eat') { x.arc(128, 185, 26, 0, Math.PI * 2); x.fill(); }
  else if (face === 'calm') { x.moveTo(104, 186); x.lineTo(152, 186); x.stroke(); }
  else { x.arc(128, 172, 30, 0.15, Math.PI - 0.15); x.stroke(); }
  if (label) {
    x.fillStyle = 'rgba(0,0,0,0.75)'; x.fillRect(28, 300, 200, 64);
    x.fillStyle = '#fff'; x.font = '800 40px "PingFang SC", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(name, 128, 334);
  }
  const tex = canvasTex(c); tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  const front = new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.5, roughness: 0.85, side: THREE.DoubleSide });
  const g = new THREE.Group();
  const w = h / 2;
  // 背面是一张转了 180 度的正面，这样从背后看字也是正的
  front.side = THREE.FrontSide; const back = front;
  for (const [z, mat, ry] of [[0.025, front, 0], [-0.025, back, Math.PI]]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    p.position.set(0, h / 2, z); p.rotation.y = ry; p.castShadow = true; g.add(p);
  }
  const stand = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, 0.04, 0.4), new THREE.MeshStandardMaterial({ color: 0x8a6a44, roughness: 0.9 }));
  stand.position.y = 0.02; g.add(stand);
  return g;
}

// ---------- 批量生成的模型：assets/models/gen/manifest.json ----------
// 同事用 Lux3D 批量生成的角色、载具、地标、道具会放进 assets/models/gen/，带一份 manifest.json。
// 街区代码按名字要模型：genModel(['bigapple_statue', '自由奶蛙像'], 8) —— 有就用 GLB，没有就返回 null，调用方用代码画的版本顶上。
// manifest 格式尽量宽松：数组，或 { items | models | assets: [...] }；每项里认 id/key/name/en/zh/name_en/name_zh 和 file/path/glb/url。
const genCache = {};       // 规范化以后的模型（按 manifest 项）
const genIndex = new Map(); // 各种名字 → manifest 项
/**
 * 批量生成模型的加载统计。
 * @type {{items: number, loaded: number, failed: string[]}}
 */
export const genInfo = { items: 0, loaded: 0, failed: [] };
const keyOf = (s) => String(s || '').trim().toLowerCase().replace(/\.glb$/, '').replace(/[\s\-]+/g, '_');

/**
 * 读 assets/models/gen/manifest.json，把里面登记的 GLB 全加载进来，并按各种名字建索引。
 * manifest 格式尽量宽松：数组，或 { items | models | assets: [...] }。
 * @param {(file: string) => void} [onEach] 每处理完一项回调一次（参数是清单里的文件名）
 * @returns {Promise<void>}
 */
export async function preloadGen(onEach) {
  if (document.documentElement.dataset.models === 'procedural') return;
  let man;
  try {
    const r = await fetch(genManifestUrl(), { cache: 'no-cache' });
    if (!r.ok) return;
    man = await r.json();
  } catch { return; }
  const items = Array.isArray(man) ? man : (man.items || man.models || man.assets || Object.entries(man).map(([k, v]) => (typeof v === 'string' ? { id: k, file: v } : { id: k, ...v })));
  genInfo.items = items.length;
  await Promise.all(items.map(async (it) => {
    const file = it.file || it.path || it.glb || it.url;
    if (!file) return;
    const href = genModelUrl(file);
    try {
      const g = await loader.loadAsync(href);
      tameMaterials(g.scene);
      const h = +it.height || +it.h || 1.6;
      const obj = normalize(g.scene, { h, yaw: +it.yaw || 0 });
      obj.animations = g.animations || [];
      obj.userData.gen = it;
      for (const n of [it.id, it.key, it.name, it.en, it.zh, it.name_en, it.name_zh, it.cn, String(file).split('/').pop()]) if (n) genIndex.set(keyOf(n), obj);
      genInfo.loaded++;
    } catch (e) { genInfo.failed.push(file); console.warn('[gen] 模型加载失败，用代码版本顶上：', file); }
    onEach?.(file);
  }));
}

// names：候选名字（中英文都行），h：想要的高度（米）。找不到返回 null
/**
 * 按候选名字（中英文都行）取一份生成模型的副本。
 * @param {string|string[]} names 候选名字
 * @param {number|null} [h] 想要的高度（米），给了就等比缩放到这个高度
 * @returns {THREE.Object3D|null} 找不到返回 null
 */
export function genModel(names, h = null) {
  for (const n of [].concat(names)) {
    const src = genIndex.get(keyOf(n));
    if (!src) continue;
    const o = cloneSkinned(src);
    if (h) { const box = new THREE.Box3().setFromObject(o); const sy = box.max.y - box.min.y; if (sy > 0) o.scale.multiplyScalar(h / sy); }
    o.animations = src.animations;
    return o;
  }
  return null;
}
