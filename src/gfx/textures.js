// 程序生成的 PBR 贴图：颜色、法线、粗糙度
import * as THREE from 'three';
import { rng, makeCanvas, canvasTex, clamp } from '../core/util.js';

function periodicNoise(P, seed) {
  const r = rng(seed);
  const g = new Float32Array(P * P);
  for (let i = 0; i < g.length; i++) g[i] = r();
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const ix = ((xi % P) + P) % P, iy = ((yi % P) + P) % P;
    const ix1 = (ix + 1) % P, iy1 = (iy + 1) % P;
    const a = g[iy * P + ix], b = g[iy * P + ix1], c = g[iy1 * P + ix], d = g[iy1 * P + ix1];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

/**
 * 分形噪声（可平铺）：多层周期值噪声叠加，结果归一化到 0..1。
 * @param {number} N 贴图边长（像素）
 * @param {{base?: number, oct?: number, seed?: number}} [opts] 基础周期 / 层数 / 随机种子
 * @returns {Float32Array} 长度 N*N 的高度场
 */
export function fbm(N, { base = 4, oct = 5, seed = 1 } = {}) {
  const h = new Float32Array(N * N);
  const fns = [];
  for (let o = 0; o < oct; o++) fns.push(periodicNoise(base << o, seed * 31 + o));
  let mn = 1e9, mx = -1e9;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let v = 0, a = 1, s = 0;
    for (let o = 0; o < oct; o++) {
      const P = base << o;
      v += fns[o]((x / N) * P, (y / N) * P) * a; s += a; a *= 0.5;
    }
    v /= s; h[y * N + x] = v; mn = Math.min(mn, v); mx = Math.max(mx, v);
  }
  for (let i = 0; i < h.length; i++) h[i] = (h[i] - mn) / (mx - mn);
  return h;
}

// fn(x, y, n) -> { h, r, g, b, rough }
function bake(N, fn, normalStrength = 2) {
  const [cc, cx] = makeCanvas(N, N);
  const [nc, nx] = makeCanvas(N, N);
  const [rc, rx] = makeCanvas(N, N);
  const ci = cx.createImageData(N, N), ni = nx.createImageData(N, N), ri = rx.createImageData(N, N);
  const H = new Float32Array(N * N);
  const px = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const p = fn(x, y, y * N + x);
    H[y * N + x] = p.h;
    px.push(p);
  }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x, p = px[i], o = i * 4;
    ci.data[o] = clamp(p.r, 0, 255); ci.data[o + 1] = clamp(p.g, 0, 255); ci.data[o + 2] = clamp(p.b, 0, 255); ci.data[o + 3] = 255;
    const hl = H[y * N + ((x - 1 + N) % N)], hr = H[y * N + ((x + 1) % N)];
    const hu = H[((y - 1 + N) % N) * N + x], hd = H[((y + 1) % N) * N + x];
    let dx = (hl - hr) * normalStrength, dy = (hu - hd) * normalStrength, dz = 1;
    const l = Math.hypot(dx, dy, dz); dx /= l; dy /= l; dz /= l;
    ni.data[o] = (dx * 0.5 + 0.5) * 255; ni.data[o + 1] = (dy * 0.5 + 0.5) * 255; ni.data[o + 2] = (dz * 0.5 + 0.5) * 255; ni.data[o + 3] = 255;
    const rv = clamp(p.rough, 0, 1) * 255;
    ri.data[o] = rv; ri.data[o + 1] = rv; ri.data[o + 2] = rv; ri.data[o + 3] = 255;
  }
  cx.putImageData(ci, 0, 0); nx.putImageData(ni, 0, 0); rx.putImageData(ri, 0, 0);
  return { map: canvasTex(cc), normalMap: canvasTex(nc, { srgb: false }), roughnessMap: canvasTex(rc, { srgb: false }) };
}

const cache = {};
/**
 * 取一套程序生成的 PBR 贴图（带缓存）。
 * @param {'asphalt'|'tiles'|'marble'|'sand'|'grass'|'brick'|'water'} kind 材质种类
 * @returns {{map: THREE.Texture, normalMap: THREE.Texture, roughnessMap: THREE.Texture}} 颜色 / 法线 / 粗糙度
 */
export function pbr(kind) {
  if (cache[kind]) return cache[kind];
  let t;
  if (kind === 'asphalt') {
    const N = 512, n = fbm(N, { base: 8, oct: 5, seed: 3 }), r = rng(9);
    t = bake(N, (x, y, i) => {
      const s = r() < 0.04 ? r() * 0.5 : 0;
      const v = 38 + n[i] * 30 + s * 60;
      return { h: n[i] * 0.6 + s, r: v, g: v, b: v + 3, rough: 0.78 + n[i] * 0.18 - s * 0.3 };
    }, 3);
  } else if (kind === 'tiles' || kind === 'marble') {
    const N = 512, n = fbm(N, { base: 4, oct: 5, seed: kind === 'marble' ? 11 : 5 });
    const tiles = kind === 'marble' ? 4 : 8;
    t = bake(N, (x, y, i) => {
      const cs = N / tiles, gx = x % cs, gy = y % cs;
      const grout = gx < 3 || gy < 3;
      const tileId = Math.floor(x / cs) + Math.floor(y / cs) * 7;
      const tv = ((tileId * 37) % 11) / 11;
      if (kind === 'marble') {
        const vein = Math.abs(Math.sin((x + n[i] * 160) * 0.03 + y * 0.01));
        const v = 215 + tv * 20 - (vein < 0.08 ? 40 : 0);
        return grout ? { h: 0, r: 120, g: 115, b: 108, rough: 0.9 } : { h: 0.8, r: v, g: v - 6, b: v - 14, rough: 0.12 + n[i] * 0.1 };
      }
      const v = 140 + tv * 25 + n[i] * 30;
      return grout ? { h: 0, r: 80, g: 78, b: 74, rough: 0.95 } : { h: 0.7 + n[i] * 0.2, r: v, g: v - 4, b: v - 10, rough: 0.65 + n[i] * 0.2 };
    }, 4);
  } else if (kind === 'sand') {
    const N = 512, n = fbm(N, { base: 4, oct: 6, seed: 7 });
    t = bake(N, (x, y, i) => {
      const rip = Math.sin((y + n[i] * 60) * 0.18) * 0.15;
      const v = n[i];
      return { h: v * 0.5 + rip, r: 214 + v * 30, g: 184 + v * 26, b: 132 + v * 20, rough: 0.92 };
    }, 2.5);
  } else if (kind === 'grass') {
    const N = 256, n = fbm(N, { base: 8, oct: 5, seed: 13 }), r = rng(4);
    t = bake(N, (x, y, i) => {
      const b = r() * 0.3;
      return { h: n[i] + b, r: 60 + n[i] * 40, g: 100 + n[i] * 60 + b * 40, b: 40 + n[i] * 20, rough: 0.9 };
    }, 3);
  } else if (kind === 'brick') {
    const N = 256, n = fbm(N, { base: 8, oct: 4, seed: 21 });
    t = bake(N, (x, y, i) => {
      const bh = 16, bw = 32, row = Math.floor(y / bh), off = (row % 2) * bw / 2;
      const gx = (x + off) % bw, gy = y % bh;
      const mortar = gx < 2 || gy < 2;
      const id = Math.floor((x + off) / bw) * 13 + row * 7;
      const tv = ((id * 29) % 17) / 17;
      return mortar ? { h: 0, r: 150, g: 145, b: 138, rough: 1 } : { h: 0.7 + n[i] * 0.3, r: 92 + tv * 30 + n[i] * 20, g: 92 + tv * 26 + n[i] * 18, b: 98 + tv * 22, rough: 0.85 };
    }, 3);
  } else if (kind === 'water') {
    const N = 256, n = fbm(N, { base: 4, oct: 6, seed: 17 });
    t = bake(N, (x, y, i) => ({ h: n[i], r: 0, g: 0, b: 0, rough: 0 }), 6);
  }
  cache[kind] = t;
  return t;
}

/**
 * 用程序贴图建一个 MeshStandardMaterial。
 * @param {'asphalt'|'tiles'|'marble'|'sand'|'grass'|'brick'|'water'} kind 材质种类
 * @param {number} [repeat] 贴图重复次数，默认 1
 * @param {object} [extra] 额外材质参数（会覆盖默认值）
 * @returns {THREE.MeshStandardMaterial}
 */
export function pbrMaterial(kind, repeat = 1, extra = {}) {
  const t = pbr(kind);
  const set = (tex) => { const c = tex.clone(); c.repeat.set(repeat, repeat); c.needsUpdate = true; return c; };
  return new THREE.MeshStandardMaterial({
    map: set(t.map), normalMap: set(t.normalMap), roughnessMap: set(t.roughnessMap), ...extra,
  });
}

// 楼体立面：窗户网格。返回颜色贴图和夜晚亮灯贴图。
/**
 * 楼体立面：窗户网格。返回颜色贴图和夜晚亮灯贴图。
 * @param {'concrete'|'glass'|'shikumen'|'tokyo'|'pastel'} style 立面风格
 * @param {number} [seed] 随机种子（决定哪些窗户亮灯）
 * @returns {{map: THREE.Texture, emissiveMap: THREE.Texture}} 颜色贴图与自发光贴图
 */
export function facade(style, seed = 1) {
  const W = 256, H = 256;
  const [c, x] = makeCanvas(W, H);
  const [e, ex] = makeCanvas(W, H);
  const r = rng(seed);
  const P = {
    concrete: { wall: '#cbbfae', win: '#3b4652', frame: '#8f8678', lit: 0.35, cols: 4, rows: 4 },
    glass: { wall: '#5b6b78', win: '#1d2b38', frame: '#9aa7b0', lit: 0.45, cols: 8, rows: 8 },
    shikumen: { wall: '#7d7b7a', win: '#2a1d16', frame: '#5a3b2a', lit: 0.5, cols: 3, rows: 3 },
    tokyo: { wall: '#2d2f38', win: '#151820', frame: '#454856', lit: 0.65, cols: 4, rows: 6 },
    pastel: { wall: '#e9b9a0', win: '#2f4a5a', frame: '#f5efe6', lit: 0.4, cols: 4, rows: 4 },
  }[style];
  x.fillStyle = P.wall; x.fillRect(0, 0, W, H);
  // 墙面污渍
  for (let i = 0; i < 40; i++) {
    x.fillStyle = `rgba(0,0,0,${r() * 0.05})`;
    x.fillRect(r() * W, r() * H, r() * 60, r() * 80);
  }
  ex.fillStyle = '#000'; ex.fillRect(0, 0, W, H);
  const cw = W / P.cols, ch = H / P.rows;
  const warm = ['#ffd9a0', '#ffe6c0', '#fff1d8', '#a8d8ff', '#ffc080'];
  for (let j = 0; j < P.rows; j++) for (let i = 0; i < P.cols; i++) {
    const px = i * cw, py = j * ch;
    const m = style === 'glass' ? 1 : cw * 0.18;
    x.fillStyle = P.frame; x.fillRect(px + m - 2, py + m - 2, cw - m * 2 + 4, ch - m * 2 + 4);
    const g = x.createLinearGradient(px, py, px, py + ch);
    g.addColorStop(0, P.win); g.addColorStop(1, '#0a0e14');
    x.fillStyle = g; x.fillRect(px + m, py + m, cw - m * 2, ch - m * 2);
    if (r() < P.lit) {
      ex.fillStyle = warm[Math.floor(r() * warm.length)];
      ex.globalAlpha = 0.5 + r() * 0.5;
      ex.fillRect(px + m, py + m, cw - m * 2, ch - m * 2);
      ex.globalAlpha = 1;
    }
  }
  // 左下角保留一块纯墙，给屋顶取色
  x.fillStyle = P.wall; x.fillRect(0, H - 6, 6, 6);
  ex.fillStyle = '#000'; ex.fillRect(0, H - 6, 6, 6);
  return { map: canvasTex(c), emissiveMap: canvasTex(e) };
}

// 霓虹招牌：文字发光贴图
/**
 * 霓虹招牌：文字发光贴图。
 * @param {string} text 招牌文字
 * @param {string} [color] 霓虹颜色，默认 '#ff3fb4'
 * @param {{vertical?: boolean, bg?: string, w?: number, h?: number}} [opts] 竖排 / 底色 / 尺寸
 * @returns {THREE.CanvasTexture}
 */
export function neonSign(text, color = '#ff3fb4', { vertical = false, bg = '#120814', w = 512, h = 128 } = {}) {
  if (vertical) [w, h] = [128, 512];
  const [c, x] = makeCanvas(w, h);
  x.fillStyle = bg; x.fillRect(0, 0, w, h);
  x.strokeStyle = color; x.lineWidth = 6; x.shadowColor = color; x.shadowBlur = 18;
  x.strokeRect(8, 8, w - 16, h - 16);
  x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = `900 ${vertical ? 84 : Math.min(90, (w * 1.6) / text.length)}px "PingFang SC", "Heiti SC", sans-serif`;
  x.shadowBlur = 24;
  if (vertical) {
    const chars = [...text];
    const step = (h - 40) / chars.length;
    chars.forEach((ch, i) => { x.fillStyle = color; x.fillText(ch, w / 2, 20 + step * (i + 0.5)); x.fillStyle = '#fff'; x.fillText(ch, w / 2, 20 + step * (i + 0.5)); });
  } else {
    x.fillStyle = color; x.fillText(text, w / 2, h / 2 + 4);
    x.globalAlpha = 0.85; x.fillStyle = '#fff'; x.fillText(text, w / 2, h / 2 + 4); x.globalAlpha = 1;
  }
  const t = canvasTex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// 普通路牌
/**
 * 普通路牌：几行字的贴图。
 * @param {string[]} lines 每行文字
 * @param {{w?: number, h?: number, bg?: string, fg?: string}} [opts] 尺寸 / 底色 / 字色
 * @returns {THREE.CanvasTexture}
 */
export function plainSign(lines, { w = 512, h = 256, bg = '#1f5f3a', fg = '#fff' } = {}) {
  const [c, x] = makeCanvas(w, h);
  x.fillStyle = bg; x.fillRect(0, 0, w, h);
  x.strokeStyle = fg; x.lineWidth = 8; x.strokeRect(10, 10, w - 20, h - 20);
  x.fillStyle = fg; x.textBaseline = 'middle';
  x.font = `800 ${Math.floor((h - 40) / lines.length * 0.62)}px "PingFang SC", sans-serif`;
  lines.forEach((l, i) => x.fillText(l, 30, 20 + ((h - 40) / lines.length) * (i + 0.5)));
  const t = canvasTex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
