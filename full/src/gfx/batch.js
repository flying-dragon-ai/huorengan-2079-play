// 静态批处理：把不透明网格按材质合并成一个几何体，砍掉逐对象的 draw call 开销。
//
// 为什么：Three.js 每帧对每个可见对象都要重新推导程序参数（getParameters /
// getProgramCacheKey）、重设材质与 uniform，并单独发一次 draw call。南门黄昏镜头里
// 2100 多个网格、每帧 2600+ 次 draw call，约三分之一的 CPU 花在这种逐对象开销上。
// 合并后画面完全一致，draw call 与 CPU 同步下降。
//
// 两条入口：
//  - batchStatic(scene, ...)：整场景静态批处理。只合并「除了父子链没人引用」的网格，
//    因为被街区字段、粒子数组、NPC root 之类引用的对象随时可能被改位置/可见性/材质。
//    判定方式是可达性扫描：从游戏对象出发遍历属性，凡是在场景树里被命中的对象，
//    连同它的所有子孙一起标记为动态。场景本身和 island.root 这类「结构性根」由调用方
//    显式传入，扫描遇到它们就停，避免整棵树被判成动态。
//  - batchRigid(root, ...)：刚体道具内部合并。物理只动外层容器（位置/旋转/翻滚），
//    零件之间的相对变换永远不变，所以可以安全地合成一个网格挂在容器下面。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// 合并后保留的顶点属性。其余（tangent / 蒙皮 / 实例 / 自定义）一律剥离，
// 保证同一批次内属性集一致；顶点色要留，否则 vertexColors 材质会变白。
const KEEP_ATTRS = ['position', 'normal', 'uv', 'color', 'uv1', 'uv2'];

// 遍历游戏对象时不下探的键：渲染器、DOM、以及会绕回自身的反向引用。
// 注意 root 不在这里：NPC / 玩家 / 道具的 root 被引用，就说明那棵子树是动态的。
const SKIP_KEYS = new Set(['scene', 'world', 'children', 'parent', 'pipe', 'camera', 'renderer',
  'domElement', 'canvas', 'ui', 'audio', 'input', 'orbit', 'rig', 'hall', 'views', 'ctx', 'g', 'game',
  'geometry', 'material', 'materials', 'shadow', 'uniforms', 'programs', 'attributes']);

const isDom = (v) => typeof Element !== 'undefined' && v instanceof Element;

/**
 * 规整后的顶点属性签名：只数白名单里的属性，缺 normal / uv 时会在克隆后补齐。
 * @param {THREE.BufferGeometry} geo 几何
 * @returns {string} 签名
 */
function geoSignature(geo) {
  const parts = KEEP_ATTRS.filter((k) => geo.attributes[k]).map((k) => {
    const a = geo.attributes[k];
    return k + a.itemSize + (a.normalized ? 'n' : '') + a.array.constructor.name;
  });
  return parts.join(',') + '|' + (geo.index ? 'idx' : 'raw');
}

/**
 * 材质数值签名：参数相同即渲染结果相同，可以共用一个批次。
 * 被游戏逻辑持有引用的材质不参与跨实例合并（调用方改用 uuid 分组）。
 * @param {THREE.Material} m 材质
 * @returns {string} 签名
 */
function matSignature(m) {
  const tex = (t) => (t ? t.uuid : '-');
  const map = m.map;
  return [m.type, m.color ? m.color.getHexString() : '-', m.emissive ? m.emissive.getHexString() : '-',
    m.emissiveIntensity, m.roughness, m.metalness, m.opacity, m.side, m.blending, m.flatShading ? 1 : 0,
    m.vertexColors ? 1 : 0, m.envMapIntensity, m.alphaTest, m.depthWrite ? 1 : 0, m.depthTest ? 1 : 0,
    m.toneMapped ? 1 : 0, m.fog === false ? 0 : 1, m.polygonOffset ? 1 : 0, m.wireframe ? 1 : 0,
    tex(map), tex(m.normalMap), tex(m.roughnessMap), tex(m.metalnessMap), tex(m.emissiveMap),
    tex(m.aoMap), tex(m.alphaMap), tex(m.envMap), tex(m.lightMap), tex(m.bumpMap), tex(m.displacementMap),
    map ? [map.repeat.x, map.repeat.y, map.offset.x, map.offset.y, map.rotation, map.center.x, map.center.y].join('/') : '-',
  ].join('|');
}

/**
 * 从若干根对象出发，找出场景树里被外部引用的对象及其全部子孙。
 * @param {Iterable<any>} owners 扫描起点（通常是 game 实例）
 * @param {Set<any>} structural 结构性根：命中即停止，不标记
 * @returns {{ dynamic: Set<THREE.Object3D>, dynamicMaterials: Set<THREE.Material>, from: Map<THREE.Object3D, string> }} 结果
 */
function scanReferences(owners, structural) {
  const dynamic = new Set(), dynamicMaterials = new Set();
  const seen = new Set();
  const from = new Map(); // 对象 → 第一次被外部引用时的属性路径
  const stack = [...owners].map((o) => [o, '']);
  let budget = 300000;
  const markTree = (o, path) => {
    if (!from.has(o)) from.set(o, path);
    o.traverse((c) => {
      dynamic.add(c);
      const m = c.material;
      if (m) for (const x of (Array.isArray(m) ? m : [m])) dynamicMaterials.add(x);
    });
  };
  const push = (v, path) => { if (v && typeof v === 'object') stack.push([v, path]); };
  while (stack.length && budget-- > 0) {
    const [v, path] = stack.pop();
    if (!v || typeof v !== 'object' || seen.has(v)) continue;
    seen.add(v);
    if (v.isObject3D) {
      if (!structural.has(v)) markTree(v, path);
      continue;
    }
    if (v.isMaterial) { dynamicMaterials.add(v); continue; }
    if (isDom(v) || typeof v === 'function' || v instanceof Promise) continue;
    if (ArrayBuffer.isView(v) || v instanceof Date) continue;
    if (v instanceof Map) { for (const [k, x] of v) push(x, `${path}.map[${k}]`); continue; }
    if (v instanceof Set) { for (const x of v) push(x, `${path}.set`); continue; }
    if (Array.isArray(v)) { v.forEach((x, i) => push(x, `${path}[${i}]`)); continue; }
    for (const k of Object.keys(v)) {
      if (SKIP_KEYS.has(k)) continue;
      let child;
      try { child = v[k]; } catch { continue; }
      push(child, path ? `${path}.${k}` : k);
    }
  }
  return { dynamic, dynamicMaterials, from };
}

/**
 * 合并一批网格：几何按（材质签名 + 顶点属性签名 + 阴影/渲染顺序/层）分组，
 * 每组变成挂在 root 下的一个 Mesh，原网格从父节点摘掉。
 * @param {THREE.Object3D} root 批次挂载点
 * @param {THREE.Mesh[]} list 候选网格
 * @param {THREE.Matrix4} toRoot 世界矩阵 → root 局部矩阵
 * @param {Map<THREE.Material, boolean>} frozen 不参与跨实例合并的材质（用 uuid 分组）
 * @param {Map<THREE.BufferGeometry, number>} users 几何被多少网格共用（共用的不销毁）
 * @param {number} min 至少几个网格才合并
 * @returns {{ batches: number, merged: number, kept: number }} 统计
 */
function mergeInto(root, list, toRoot, frozen, users, min) {
  const groups = new Map();
  for (const o of list) {
    const m = o.material;
    const key = [frozen.has(m) ? 'u' + m.uuid : 's' + matSignature(m), geoSignature(o.geometry),
      o.castShadow ? 1 : 0, o.receiveShadow ? 1 : 0, o.renderOrder, o.layers.mask].join('#');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(o);
  }
  let batches = 0, merged = 0, kept = 0;
  for (const group of groups.values()) {
    if (group.length < min) { kept += group.length; continue; }
    const geos = [];
    for (const o of group) {
      const geo = o.geometry.clone();
      for (const k of Object.keys(geo.attributes)) if (!KEEP_ATTRS.includes(k)) geo.deleteAttribute(k);
      if (!geo.attributes.normal) geo.computeVertexNormals();
      if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
      geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toRoot, o.matrixWorld));
      geos.push(geo);
    }
    const one = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!one) { kept += group.length; continue; }
    const src = group[0];
    const mesh = new THREE.Mesh(one, src.material);
    mesh.name = 'batch:' + batches;
    mesh.castShadow = src.castShadow; mesh.receiveShadow = src.receiveShadow;
    mesh.renderOrder = src.renderOrder; mesh.layers.mask = src.layers.mask;
    root.add(mesh);
    for (const o of group) {
      o.parent?.remove(o);
      if (users.get(o.geometry) === 1) o.geometry.dispose();
      merged++;
    }
    batches++;
  }
  return { batches, merged, kept };
}

/**
 * 收集一棵子树里可以合并的网格。蒙皮、实例化、透明、带 alphaTest、有 morph、
 * 自带 onBeforeRender 钩子、被标记 noBatch 的都不动。
 * @param {THREE.Object3D} root 子树根
 * @param {(o: THREE.Mesh) => boolean} [skip] 额外排除
 * @returns {THREE.Mesh[]} 候选
 */
function collect(root, skip) {
  const list = [];
  const noHook = THREE.Object3D.prototype.onBeforeRender;
  root.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh || o.isInstancedMesh) return;
    const m = o.material;
    if (!m || Array.isArray(m) || m.transparent || m.alphaTest > 0) return;
    if (!o.geometry || !o.geometry.attributes.position) return;
    if (o.geometry.morphAttributes && Object.keys(o.geometry.morphAttributes).length) return;
    if (!o.visible || o.onBeforeRender !== noHook) return;
    if (o.userData && o.userData.noBatch) return;
    if (skip && skip(o)) return;
    list.push(o);
  });
  return list;
}

/**
 * 统计几何的共享次数：只被一个网格用到的几何在合并后可以销毁。
 * @param {THREE.Object3D} root 子树根
 * @returns {Map<THREE.BufferGeometry, number>} 次数
 */
function geometryUsers(root) {
  const users = new Map();
  root.traverse((o) => { if (o.isMesh && o.geometry) users.set(o.geometry, (users.get(o.geometry) || 0) + 1); });
  return users;
}

/**
 * 刚体容器内部合并：物理只动容器本身时，把零件按材质合成一个网格挂在容器下。
 * 相对变换保持不变，画面一致；容器被撞飞/翻滚时整块一起动。
 * @param {THREE.Object3D} root 容器（通常是道具的外层 Group）
 * @param {{ min?: number }} [opts] min：至少几个网格才合并
 * @returns {{ batches: number, merged: number, kept: number }} 统计
 */
export function batchRigid(root, opts = {}) {
  const { min = 2 } = opts;
  root.updateMatrixWorld(true);
  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const list = collect(root, (o) => o === root);
  const res = mergeInto(root, list, toRoot, new Map(), geometryUsers(root), min);
  return res;
}

/**
 * 整场景静态批处理。
 * @param {THREE.Scene} scene 主场景
 * @param {{ owners?: Iterable<any>, structural?: Iterable<THREE.Object3D>, min?: number, skip?: (o: THREE.Mesh) => boolean }} [opts]
 *   owners：外部引用扫描起点；structural：结构性根（默认只有场景本身）；
 *   min：一个批次至少要合并几个网格（默认 2）；skip：额外的排除判定。
 * @returns {{ batches: number, merged: number, kept: number, dynamic: number, dynamicKinds: object, dynamicRoots: object[] }} 统计
 */
export function batchStatic(scene, opts = {}) {
  const { owners = [], structural = [], min = 2, skip = null } = opts;
  const struct = new Set([scene, ...structural]);
  const { dynamic, dynamicMaterials, from } = scanReferences(owners, struct);

  scene.updateMatrixWorld(true);
  const toScene = new THREE.Matrix4().copy(scene.matrixWorld).invert();
  const users = geometryUsers(scene);
  const list = collect(scene, (o) => dynamic.has(o) || (skip ? skip(o) : false));
  const res = mergeInto(scene, list, toScene, dynamicMaterials, users, min);

  // 被判定为动态的子树：排查「为什么这批景物没合并」时看这个
  const roots = [], kinds = {};
  for (const o of dynamic) {
    const k = o.type + (o.isSkinnedMesh ? '/skinned' : '');
    kinds[k] = (kinds[k] || 0) + 1;
    if (!o.parent || !dynamic.has(o.parent)) {
      let n = 0; o.traverse(() => n++);
      roots.push({ name: o.name || o.type, n, path: from.get(o) });
    }
  }
  roots.sort((a, b) => b.n - a.n);
  return { ...res, dynamic: dynamic.size, dynamicKinds: kinds, dynamicRoots: roots.slice(0, 6) };
}
