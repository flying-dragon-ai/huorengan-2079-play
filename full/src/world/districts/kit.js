// 街区通用小零件：盒子、招牌、气泡、触发器、任务光圈、能撞飞的纸板人
// 每个街区文件（shanghai.js / tokyo.js / bigapple.js / beach.js …）都用这些拼场景和笑点。
import * as THREE from 'three';
import { makeCanvas, canvasTex } from '../../core/util.js';
import { neonSign, plainSign } from '../../gfx/textures.js';

export const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const matCache = new Map();
// 同一种颜色和参数只建一个材质
export function mat(color, o = {}) {
  const k = color + JSON.stringify(o);
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o }));
  return matCache.get(k);
}
export function glow(island, color) { return island.neonMat(new THREE.Color(...color)); }

// 底面在 y 的盒子；col=true 时加碰撞
export function box(island, w, h, d, x, y, z, m, { ry = 0, col = false, cast = true, parent = null } = {}) {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  o.position.set(x, y + h / 2, z); o.rotation.y = ry; o.castShadow = cast; o.receiveShadow = true;
  (parent || island.root).add(o);
  if (col) island.col.add(x - w / 2, x + w / 2, z - d / 2, z + d / 2, y + h);
  return o;
}
export function cyl(island, rt, rb, h, x, y, z, m, { seg = 16, col = false, parent = null } = {}) {
  const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  o.position.set(x, y + h / 2, z); o.castShadow = true; o.receiveShadow = true;
  (parent || island.root).add(o);
  if (col) { const r = Math.max(rt, rb); island.col.add(x - r, x + r, z - r, z + r, y + h); }
  return o;
}

// 平面招牌（白天也看得清）
export function board(island, lines, w, h, x, y, z, ry, { bg = '#1f5f3a', fg = '#fff', glowK = 1 } = {}) {
  return island.sign(plainSign(lines, { bg, fg, w: 512, h: Math.round(512 * h / w) }), w, h, x, y, z, ry, glowK);
}
// 霓虹招牌
export function neon(island, text, color, w, h, x, y, z, ry, { vertical = false, bg = '#120814', k = 1.6 } = {}) {
  return island.sign(neonSign(text, color, { vertical, bg, w: vertical ? 128 : 512, h: vertical ? 512 : 128 }), w, h, x, y, z, ry, k);
}
// 自己画的贴图：fn(ctx, w, h)
export function drawTex(w, h, fn, { repeat = 1 } = {}) {
  const [c, x] = makeCanvas(w, h); fn(x, w, h);
  const t = canvasTex(c, { repeat }); if (repeat === 1) t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.canvas = c; t.ctx = x;
  return t;
}
// 平铺在地上的一块（贴图地面）
export function groundQuad(island, x0, z0, x1, z1, y, material) {
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0); g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, material); m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); m.receiveShadow = true;
  island.add(m); return m;
}

// 任务光圈：地上一圈 + 一根短光柱 + 头顶的字
export function questRing(scene, color, label) {
  const g = new THREE.Group(), c = new THREE.Color(color);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.16, 8, 64), new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(3) }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.25; g.add(ring);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 18, 24, 1, true), new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(0.5), transparent: true, opacity: 0.022, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.y = 9; g.add(beam);
  const t = drawTex(512, 128, (x) => {
    x.fillStyle = 'rgba(0,0,0,0.6)'; x.beginPath(); x.roundRect(6, 10, 500, 108, 40); x.fill();
    x.fillStyle = color; x.font = '900 54px "PingFang SC"'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(label, 256, 66);
  });
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  tag.scale.set(8, 2, 1); tag.position.y = 6.5; tag.renderOrder = 9; g.add(tag);
  scene.add(g);
  return { g, ring, tag, spin(dt, t) { ring.rotation.z += dt; ring.scale.setScalar(1 + Math.sin(t * 4) * 0.06); tag.position.y = 6.5 + Math.sin(t * 2) * 0.25; } };
}


// 屏幕外也能听懂的大字幕 + 3D 气泡都交给 ctx（game），这里只放冷却触发器
export class Gags {
  constructor() { this.list = []; }
  // x,z,r：触发圈；cool：冷却秒数；once：只触发一次；when(ctx)：额外条件；fire(ctx)
  add(g) { this.list.push({ cool: 25, last: -999, once: false, r: 6, ...g, done: false }); return this; }
  update(ctx, p) {
    for (const g of this.list) {
      if (g.done || ctx.time - g.last < g.cool) continue;
      if (Math.hypot(p.pos.x - g.x, p.pos.z - g.z) > g.r) continue;
      if (g.when && !g.when(ctx)) continue;
      g.last = ctx.time; if (g.once) g.done = true;
      g.fire(ctx);
      ctx.districts.gagFired(g.id || '?');
    }
  }
}

export const inRect = (p, [x0, x1, z0, z1]) => p.x >= x0 && p.x <= x1 && p.z >= z0 && p.z <= z1;
export const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
