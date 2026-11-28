// 共享工具：画布贴图、材质缓存、随机数、构件工厂
import * as THREE from 'three';

/**
 * 构造 Vector3 的简写。
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @returns {THREE.Vector3}
 */
export const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const cache = new Map();

/**
 * 取缓存的 MeshStandardMaterial：同 color + 同参数只创建一次。
 * @param {number|string} color 颜色（十六进制数或 CSS 字符串）
 * @param {Partial<THREE.MeshStandardMaterialParameters>} [o] 覆盖默认参数（默认 roughness 0.65）
 * @returns {THREE.MeshStandardMaterial}
 */
export function mat(color, o = {}) {
  const k = color + JSON.stringify(o);
  if (!cache.has(k)) cache.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.65, ...o }));
  return cache.get(k);
}
/**
 * 新建 MeshBasicMaterial（不缓存，因为调用方常需独立改属性）。
 * @param {number|string} color 颜色
 * @param {Partial<THREE.MeshBasicMaterialParameters>} [o] 额外参数
 * @returns {THREE.MeshBasicMaterial}
 */
export function basic(color, o = {}) {
  return new THREE.MeshBasicMaterial({ color, ...o });
}
/**
 * 自发光材质：颜色同时作为 emissive，用于灯带、车窗等。
 * @param {number|string} color 颜色
 * @param {number} [intensity] 自发光强度
 * @returns {THREE.MeshStandardMaterial}
 */
export function emissive(color, intensity = 1.6) {
  return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.4 });
}

// 固定种子随机：每次打开布局一致
/**
 * 固定种子随机数（xorshift32）：同一 seed 每次打开布局一致。
 * @param {number} [seed] 种子
 * @returns {() => number} 返回 [0, 1) 区间的随机数生成器
 */
export function rng(seed = 2079) {
  let s = seed >>> 0;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

// 用 Canvas 画贴图：招牌、地面、窗户、法线全部代码生成
/**
 * drawTex 返回的贴图：除 CanvasTexture 外还挂着画布与 2D 上下文，便于二次绘制。
 * @typedef {THREE.CanvasTexture & { ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement }} DrawTexTexture
 */

/**
 * 用 Canvas 2D 回调生成贴图。
 * @param {number} w 画布宽（像素）
 * @param {number} h 画布高（像素）
 * @param {(ctx: CanvasRenderingContext2D, w: number, h: number) => void} fn 绘制回调
 * @param {{ repeat?: number }} [opts] repeat 不为 1 时启用 RepeatWrapping 并设置重复次数
 * @returns {DrawTexTexture}
 */
export function drawTex(w, h, fn, { repeat = 1 } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  fn(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat !== 1) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
  else { t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; }
  t.ctx = c.getContext('2d'); t.canvas = c;
  return t;
}

/**
 * 招牌贴图：多行文字自动缩放字号以适配宽度。
 * @param {string[]} lines 每行文字
 * @param {{ bg?: string, fg?: string, w?: number, h?: number }} [opts] 背景色、前景色、画布尺寸
 * @returns {DrawTexTexture}
 */
export function signTex(lines, { bg = '#12222c', fg = '#ffe9a8', w = 512, h = 160 } = {}) {
  return drawTex(w, h, (x) => {
    x.fillStyle = bg; x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(255,255,255,0.25)'; x.lineWidth = 6; x.strokeRect(6, 6, w - 12, h - 12);
    x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
    const n = lines.length;
    lines.forEach((t, i) => {
      let fs = Math.floor(h / (n + 0.8));
      x.font = `800 ${fs}px "PingFang SC", sans-serif`;
      while (x.measureText(t).width > w - 40 && fs > 14) { fs -= 4; x.font = `800 ${fs}px "PingFang SC", sans-serif`; }
      x.fillText(t, w / 2, (i + 0.65) * (h / n));
    });
  });
}

// 程序地面砖贴图 + 对应法线（用亮度差近似法线，省资源）
/**
 * 程序化地面砖贴图（错缝排布 + 每块亮度抖动）。
 * @param {{ base?: string, mortar?: string, size?: number }} [opts] 砖色、缝色、画布边长
 * @returns {THREE.CanvasTexture}
 */
export function brickTex({ base = '#b9a48a', mortar = '#8a7660', size = 256 } = {}) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d');
  x.fillStyle = mortar; x.fillRect(0, 0, size, size);
  const r = rng(7);
  const bw = size / 4, bh = size / 8;
  for (let j = 0; j < 8; j++) for (let i = -1; i < 5; i++) {
    const off = j % 2 ? bw / 2 : 0;
    const cc = new THREE.Color(base).multiplyScalar(0.85 + r() * 0.3);
    x.fillStyle = '#' + cc.getHexString();
    x.fillRect(i * bw + off + 1, j * bh + 1, bw - 2, bh - 2);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}


// 玻璃幕墙立面（含夜晚亮灯）
/**
 * 玻璃幕墙立面贴图（含夜晚亮灯窗格）。
 * @param {'glass'|'tokyo'|'brick'} [style] 立面风格
 * @param {number} [seed] 随机种子，决定亮灯分布
 * @returns {DrawTexTexture}
 */
export function facadeTex(style = 'glass', seed = 5) {
  const r = rng(seed);
  return drawTex(256, 256, (x, w, h) => {
    const night = style === 'tokyo' || style === 'glass';
    x.fillStyle = style === 'brick' ? '#7a4a3a' : night ? '#16202c' : '#c9c0b0';
    x.fillRect(0, 0, w, h);
    const cols = 6, rows = 8;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const lit = r();
      x.fillStyle = lit > 0.6 ? ['#ffd88a', '#9fe6ff', '#ffb0d0'][Math.floor(r() * 3)] : (night ? '#223140' : '#8a98a4');
      const ww = w / cols, hh = h / rows;
      x.fillRect(i * ww + 3, j * hh + 3, ww - 6, hh - 6);
    }
  });
}

// 简单几何工厂：底面在 y 的盒子
/**
 * 盒子工厂：y 为底面高度（内部已加 h/2）。
 * @param {number} w 宽
 * @param {number} h 高
 * @param {number} d 深
 * @param {THREE.Material} m 材质
 * @param {number} [x] 位置 x
 * @param {number} [y] 底面高度
 * @param {number} [z] 位置 z
 * @returns {THREE.Mesh}
 */
export function box(w, h, d, m, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  o.position.set(x, y + h / 2, z);
  o.castShadow = true; o.receiveShadow = true;
  return o;
}
/**
 * 圆柱工厂：y 为底面高度。
 * @param {number} rt 顶半径
 * @param {number} rb 底半径
 * @param {number} h 高
 * @param {THREE.Material} m 材质
 * @param {number} [x] 位置 x
 * @param {number} [y] 底面高度
 * @param {number} [z] 位置 z
 * @param {number} [seg] 径向分段
 * @returns {THREE.Mesh}
 */
export function cyl(rt, rb, h, m, x = 0, y = 0, z = 0, seg = 16) {
  const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  o.position.set(x, y + h / 2, z);
  o.castShadow = true; o.receiveShadow = true;
  return o;
}
/**
 * 球体工厂：y 为球心高度。
 * @param {number} r 半径
 * @param {THREE.Material} m 材质
 * @param {number} [x] 位置 x
 * @param {number} [y] 球心高度
 * @param {number} [z] 位置 z
 * @param {number} [seg] 经向分段（纬向取 max(8, seg/2)）
 * @returns {THREE.Mesh}
 */
export function sphere(r, m, x = 0, y = 0, z = 0, seg = 20) {
  const o = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(8, seg / 2)), m);
  o.position.set(x, y, z); o.castShadow = true;
  return o;
}
/**
 * 平面工厂：默认竖直朝 +Z，地面需自行 rotation.x = -PI/2。
 * @param {number} w 宽
 * @param {number} h 高
 * @param {THREE.Material} m 材质
 * @param {number} [x] 位置 x
 * @param {number} [y] 位置 y
 * @param {number} [z] 位置 z
 * @returns {THREE.Mesh}
 */
export function plane(w, h, m, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  o.position.set(x, y, z);
  return o;
}
/**
 * 圆环工厂。
 * @param {number} r 环半径
 * @param {number} tube 管半径
 * @param {THREE.Material} m 材质
 * @param {number} [x] 位置 x
 * @param {number} [y] 位置 y
 * @param {number} [z] 位置 z
 * @param {boolean} [flat] true 时平放（rotation.x = PI/2）
 * @returns {THREE.Mesh}
 */
export function torus(r, tube, m, x = 0, y = 0, z = 0, flat = true) {
  const o = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 10, 48), m);
  o.position.set(x, y, z);
  if (flat) o.rotation.x = Math.PI / 2;
  return o;
}

// 复用重复物体：实例化渲染
/**
 * 实例化变换：位置必填，旋转与缩放可选（s 同时作用于三轴）。
 * @typedef {{ x: number, y: number, z: number, rx?: number, ry?: number, rz?: number, s?: number, sx?: number, sy?: number, sz?: number }} InstanceTransform
 */

/**
 * 复用重复物体：把一组变换烘进 InstancedMesh。
 * @param {THREE.BufferGeometry} geo 共享几何体
 * @param {THREE.Material} material 共享材质
 * @param {InstanceTransform[]} transforms 每个实例的变换
 * @returns {THREE.InstancedMesh}
 */
export function instance(geo, material, transforms) {
  const m = new THREE.InstancedMesh(geo, material, transforms.length);
  const M = new THREE.Matrix4();
  transforms.forEach((t, i) => {
    M.compose(
      V3(t.x, t.y, t.z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(t.rx || 0, t.ry || 0, t.rz || 0)),
      V3(t.sx ?? t.s ?? 1, t.sy ?? t.s ?? 1, t.sz ?? t.s ?? 1));
    m.setMatrixAt(i, M);
  });
  m.castShadow = true; m.receiveShadow = true;
  m.instanceMatrix.needsUpdate = true;
  return m;
}
