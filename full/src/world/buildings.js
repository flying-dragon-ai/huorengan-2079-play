// 建筑层：立面材质、单栋楼、霓虹招牌、沿街排楼、街区布局、地标塔、自动售货墙、
// 中央广场及其四周建筑、全息占位方块、直播大屏。
import * as THREE from 'three';
import { pbr, pbrMaterial, facade, neonSign, plainSign } from '../gfx/textures.js';
import { makeCanvas, canvasTex } from '../core/util.js';
import { ROAD_W } from '../core/config.js';
import { quadGeo } from './colliders.js';
import { buildPlazaDetails, buildNorthRoofs, buildDistantHills } from './districts/plaza.js';

/**
 * 按风格取（并缓存）立面材质。同风格同变体共用一份，夜里由 env.windows 统一点亮。
 * @param {import('./island.js').Island} island 岛实例
 * @param {'glass'|'concrete'|'shikumen'|'tokyo'|'pastel'} style 立面风格
 * @param {number} v 变体序号（0–2）
 * @returns {THREE.MeshStandardMaterial} 立面材质
 */
export function facadeMat(island, style, v) {
  island._fm ??= {};
  const k = style + v;
  if (!island._fm[k]) {
    const f = facade(style, v * 7 + style.length);
    const glass = style === 'glass';
    const m = new THREE.MeshStandardMaterial({
      map: f.map, emissiveMap: f.emissiveMap, emissive: 0xffffff, emissiveIntensity: 0.05,
      roughness: glass ? 0.18 : style === 'tokyo' ? 0.5 : 0.8, metalness: glass ? 0.45 : 0.0, envMapIntensity: glass ? 0.6 : 1,
    });
    if (style === 'shikumen') m.normalMap = pbr('brick').normalMap;
    island.env.windows.push(m);
    island._fm[k] = m;
  }
  return island._fm[k];
}

/**
 * 建一栋楼：按尺寸重排 UV 让窗格不拉伸，登记碰撞盒，再挂屋顶设备 / 石库门门头 / 坡屋顶。
 * @param {import('./island.js').Island} island 岛实例
 * @param {number} x 中心 x
 * @param {number} z 中心 z
 * @param {number} w 宽（x 方向）
 * @param {number} d 深（z 方向）
 * @param {number} h 高
 * @param {'glass'|'concrete'|'shikumen'|'tokyo'|'pastel'} style 立面风格
 * @param {{ face?: [number, number]|null }} [opts] face：石库门门头朝向的 [x, z] 单位向量
 * @returns {THREE.Mesh} 楼体网格
 */
export function building(island, x, z, w, d, h, style, { face = null } = {}) {
  const g = new THREE.BoxGeometry(w, h, d);
  // [每格宽, 每格高, 贴图里的列数, 行数]
  const cell = { glass: [3, 3.6, 8, 8], concrete: [3.5, 3.4, 4, 4], shikumen: [4, 3.6, 3, 3], tokyo: [3, 2.8, 4, 6], pastel: [3.4, 3.2, 4, 4] }[style];
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k;
    if (f === 2 || f === 3) { uv.setXY(i, 0.01, 0.01); continue; }
    const nx = Math.max(1, Math.round(dims[f][0] / cell[0])), ny = Math.max(1, Math.round(dims[f][1] / cell[1]));
    uv.setXY(i, uv.getX(i) * nx / cell[2], uv.getY(i) * ny / cell[3]);
  }
  const mat = island.facadeMat(style, Math.floor(island.r() * 3));
  const m = new THREE.Mesh(g, mat);
  m.position.set(x, h / 2, z); m.castShadow = true; m.receiveShadow = true;
  island.add(m);
  island.col.add(x - w / 2, x + w / 2, z - d / 2, z + d / 2, h);
  // 屋顶设备
  if (h > 10 && style !== 'shikumen') {
    const n = 1 + Math.floor(island.r() * 3);
    for (let i = 0; i < n; i++) {
      const bw = 1.5 + island.r() * 3;
      const b = new THREE.Mesh(new THREE.BoxGeometry(bw, 1 + island.r() * 2, bw), island.roofMat ??= new THREE.MeshStandardMaterial({ color: 0x8a8d90, roughness: 0.6, metalness: 0.3 }));
      b.position.set(x + (island.r() - 0.5) * (w - bw), h + 0.6, z + (island.r() - 0.5) * (d - bw));
      b.castShadow = true; island.add(b);
    }
    if (island.r() < 0.3) {
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 8), island.roofMat);
      ant.position.set(x, h + 4, z); island.add(ant);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.4), island.neonMat(new THREE.Color(1, 0.1, 0.1)));
      tip.position.set(x, h + 8, z); island.add(tip);
    }
  }
  if (style === 'shikumen') {
    // 石库门：黑漆木门加门头
    const door = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.2, 0.3), island.doorMat ??= new THREE.MeshStandardMaterial({ color: 0x1a0f0a, roughness: 0.5 }));
    const top = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1, 0.5), island.stoneMat ??= new THREE.MeshStandardMaterial({ color: 0xb8a990, roughness: 0.9 }));
    if (face) {
      door.position.set(x + face[0] * (w / 2 + 0.1), 1.6, z + face[1] * (d / 2 + 0.1)); door.rotation.y = Math.atan2(face[0], face[1]);
      top.position.copy(door.position).setY(3.6); top.rotation.y = door.rotation.y;
      island.add(door); island.add(top);
    }
    // 坡屋顶
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, Math.max(w, d) * 0.62, 2.6, 4, 1), island.tileRoof ??= new THREE.MeshStandardMaterial({ color: 0x2b2a2c, roughness: 0.75 }));
    roof.rotation.y = Math.PI / 4; roof.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d));
    roof.position.set(x, h + 1.3, z); roof.castShadow = true; island.add(roof);
  }
  return m;
}

/**
 * 建一份自发光霓虹材质，并登记到 env.neon 让夜景统一调亮度。
 * @param {import('./island.js').Island} island 岛实例
 * @param {THREE.Color} color 基色（可超过 1 做 HDR 溢出）
 * @returns {THREE.MeshBasicMaterial} 霓虹材质
 */
export function neonMat(island, color) {
  const m = new THREE.MeshBasicMaterial({ color: color.clone(), fog: true });
  island.env.neon.push({ mat: m, base: color.clone() });
  return m;
}

/**
 * 挂一块贴图招牌（双面），并登记到 env.neon。
 * @param {import('./island.js').Island} island 岛实例
 * @param {THREE.Texture} tex 招牌贴图
 * @param {number} w 宽
 * @param {number} h 高
 * @param {number} x 位置 x
 * @param {number} y 位置 y
 * @param {number} z 位置 z
 * @param {number} ry 绕 Y 旋转（弧度）
 * @param {number} [glow=1] 自发光强度
 * @returns {THREE.Mesh} 招牌网格
 */
export function sign(island, tex, w, h, x, y, z, ry, glow = 1) {
  const m = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(glow, glow, glow), side: THREE.DoubleSide });
  island.env.neon.push({ mat: m, base: new THREE.Color(glow, glow, glow) });
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  p.position.set(x, y, z); p.rotation.y = ry; island.add(p);
  return p;
}

/**
 * 沿一条街两侧排楼：长边沿 x 方向。
 * @param {import('./island.js').Island} island 岛实例
 * @param {number} x0 起点 x
 * @param {number} x1 终点 x
 * @param {number} zFront 临街面 z
 * @param {number} depth 进深
 * @param {number} dir 楼体往哪一侧长（+1 / -1）
 * @param {'glass'|'concrete'|'shikumen'|'tokyo'|'pastel'} style 立面风格
 * @param {[number, number]} hRange 高度区间
 * @param {[number, number]} wRange 面宽区间
 * @param {{ skip?: (x: number) => boolean }} [opts] skip：返回 true 的位置留空
 * @returns {Array<{ b: THREE.Mesh, x: number, w: number, h: number, z: number, zFront: number }>} 排出来的楼
 */
export function row(island, x0, x1, zFront, depth, dir, style, hRange, wRange, opts = {}) {
  let x = x0;
  const out = [];
  while (x < x1 - 4) {
    const w = Math.min(x1 - x, wRange[0] + island.r() * (wRange[1] - wRange[0]));
    if (opts.skip && opts.skip(x + w / 2)) { x += w; continue; }
    const h = hRange[0] + island.r() * (hRange[1] - hRange[0]);
    const z = zFront + dir * depth / 2;
    out.push({ b: island.building(x + w / 2, z, w - 0.6, depth, h, style, { face: [0, -dir] }), x: x + w / 2, w, h, z, zFront });
    x += w;
  }
  return out;
}

/**
 * 建全部街区：魔都弄堂、市中心玻璃塔、东京便利店街、中央广场、南边公园。
 * 西 / 东中段与四角由 districts/ 下的独立组件接管。
 * @param {import('./island.js').Island} island 岛实例
 * @returns {void}
 */
export function buildDistricts(island) {
  const M = ROAD_W / 2 + 3.5; // 路边到楼的距离
  // ===== 魔都弄堂（西北两条） =====
  const sh1 = island.row(-150 + M, -50 - M, -100 - M, 14, -1, 'shikumen', [7, 10], [8, 12], { skip: (x) => Math.abs(x + 100) < 16 });
  const sh2 = island.row(-150 + M, -50 - M, -100 + M, 14, 1, 'shikumen', [7, 10], [8, 12]);
  island.row(-150 + M, -50 - M, -50 - M, 12, -1, 'pastel', [9, 16], [10, 14]);
  island.row(-150 + M, -50 - M, -150 + M, 12, 1, 'shikumen', [8, 11], [9, 13], { skip: (x) => Math.abs(x + 100) < 16 });
  // 十家咖啡店、梧桐、电车这些在 districts/shanghai.js 里
  island.shRows = [...sh1, ...sh2];
  island.cafe = new THREE.Vector3(-100, 0, -100);
  island.pearlTower(-100, -125);

  // ===== 市中心玻璃塔（天际线） =====
  // 广场北边保留通透的中轴，低层商街在前，两侧与后排才升高。
  const front = island.row(-50 + M, 50 - M, -50 - M, 15, -1, 'pastel', [7, 11], [10, 15]);
  buildNorthRoofs(island, front);
  island.row(-50 + M, 50 - M, -100 + M, 14, 1, 'concrete', [9, 16], [11, 16]);
  island.row(-50 + M, 50 - M, -100 - M, 16, -1, 'glass', [13, 26], [13, 18]);
  island.row(-50 + M, 50 - M, -150 + M, 16, 1, 'glass', [20, 42], [10, 17]);
  buildDistantHills(island);

  // ===== 东京便利店一条街（东北） =====
  const tk = [
    ...island.row(50 + M, 150 - M, -100 - M, 12, -1, 'tokyo', [14, 34], [6, 10]),
    ...island.row(50 + M, 150 - M, -100 + M, 12, 1, 'tokyo', [14, 34], [6, 10]),
  ];
  island.row(50 + M, 150 - M, -150 + M, 12, 1, 'tokyo', [18, 40], [8, 12]);
  island.row(50 + M, 150 - M, -50 - M, 12, -1, 'tokyo', [12, 26], [8, 12]);
  const words = ['便利店', '什么都卖', '亲戚¥199', '后悔药售罄', '加班买一送一', '夜宵', '卡拉OK', '胶囊旅馆', '电饭煲专卖', '二十四小时', '回家的票', '免费续杯'];
  const cols = ['#ff3fb4', '#3ff0ff', '#ffe03f', '#a46bff', '#ff5a3f', '#3fff9a'];
  tk.forEach((s, i) => {
    const t = neonSign(words[i % words.length], cols[i % cols.length], { vertical: true });
    const out = s.z < s.zFront ? 1 : -1;
    const sx = s.x + (island.r() - 0.5) * (s.w - 3);
    island.sign(t, 1.6, 6.4, sx, 6 + island.r() * Math.max(0, s.h - 14), s.zFront + out * 0.9, out > 0 ? 0 : Math.PI, 2.0)
      .rotation.y += Math.PI / 2 * out;
  });
  // 湿漉漉的反光地面
  const wet = new THREE.Mesh(quadGeo([[50 + 7, -100 - 7, 150 - 7, -100 + 7]], 0.04, 4), new THREE.MeshStandardMaterial({ color: 0x0c0d12, roughness: 0.08, metalness: 0.6, transparent: true, opacity: 0.75 }));
  island.add(wet);
  island.vendingWall(62, 138, -100 + M - 0.2);

  // ===== 中央广场 =====
  island.plaza();

  // ===== 西、东中段：巴黎与金字塔工地由独立组件接管 =====
  // 第3批四区取代通用楼，避免旧楼挡进新街区内部

  // ===== 南边：AI 生成中 + 公园 =====
  // 西南角已由老家县城接管，移除 AI 生成中占位围挡
  // 东南角 (100,100) 已经是大苹果街区（districts/bigapple.js）
  island.park(0, 100);
}

/**
 * 西方明珠塔：三条斜腿 + 92 米塔身 + 三颗粉球 + 霓虹环 + 塔名牌。
 * @param {import('./island.js').Island} island 岛实例
 * @param {number} x 塔基 x
 * @param {number} z 塔基 z
 * @returns {void}
 */
export function pearlTower(island, x, z) {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0xd9d4e6, metalness: 0.7, roughness: 0.25 });
  const pink = new THREE.MeshStandardMaterial({ color: 0xff5fa8, metalness: 0.6, roughness: 0.2, emissive: 0xff2f8a, emissiveIntensity: 0.25 });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.2, 30, 16), steel);
    leg.position.set(Math.cos(a) * 6, 14, Math.sin(a) * 6); leg.rotation.z = Math.cos(a) * 0.18; leg.rotation.x = -Math.sin(a) * 0.18;
    g.add(leg);
  }
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 92, 20), steel); shaft.position.y = 46; g.add(shaft);
  const s1 = new THREE.Mesh(new THREE.SphereGeometry(9, 48, 32), pink); s1.position.y = 30; g.add(s1);
  const s2 = new THREE.Mesh(new THREE.SphereGeometry(5.5, 48, 32), pink); s2.position.y = 70; g.add(s2);
  const s3 = new THREE.Mesh(new THREE.SphereGeometry(2.4, 32, 24), pink); s3.position.y = 86; g.add(s3);
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.8, 24, 12), steel); spire.position.y = 100; g.add(spire);
  for (const y of [30, 70]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(y === 30 ? 9.1 : 5.6, 0.25, 8, 64), island.neonMat(new THREE.Color(0.4, 0.9, 1.2)));
    band.rotation.x = Math.PI / 2; band.position.y = y; g.add(band);
  }
  g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  g.position.set(x, 0, z); island.add(g);
  island.col.add(x - 8, x + 8, z - 8, z + 8, 200);
  const t = plainSign(['西方明珠塔', 'WEST PEARL'], { bg: '#30184a' });
  island.sign(t, 6, 3, x, 3, z + 9.5, 0, 1.2);
}

/**
 * 自动售货墙：一整排「什么都卖」售货机，正面贴图自发光。
 * @param {import('./island.js').Island} island 岛实例
 * @param {number} x0 起点 x
 * @param {number} x1 终点 x
 * @param {number} z 墙面 z
 * @returns {void}
 */
export function vendingWall(island, x0, x1, z) {
  const [c, x] = makeCanvas(256, 512);
  const g = x.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, '#e8f6ff'); g.addColorStop(1, '#9fd0ff');
  x.fillStyle = g; x.fillRect(0, 0, 256, 512);
  x.fillStyle = '#0a2440'; x.fillRect(0, 0, 256, 70);
  x.fillStyle = '#fff'; x.font = '900 40px "PingFang SC"'; x.textAlign = 'center'; x.fillText('什么都卖', 128, 48);
  const items = ['汽水', '电饭煲', '亲戚', '对象', '假期', '勇气', '后悔药', '睡眠', '头发', '周末', 'Wi-Fi', '体面'];
  for (let i = 0; i < 12; i++) {
    const cx = 20 + (i % 3) * 78, cy = 90 + Math.floor(i / 3) * 90;
    x.fillStyle = ['#ff6b6b', '#ffd93d', '#6bcB77', '#4d96ff'][i % 4]; x.fillRect(cx, cy, 60, 58);
    x.fillStyle = '#111'; x.font = '700 18px "PingFang SC"'; x.fillText(items[i], cx + 30, cy + 80);
  }
  x.fillStyle = '#222'; x.fillRect(40, 450, 176, 40);
  const tex = canvasTex(c); tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  const front = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.3, 1.3, 1.3) });
  island.env.neon.push({ mat: front, base: new THREE.Color(1.1, 1.1, 1.1) });
  const side = new THREE.MeshStandardMaterial({ color: 0xe8e8ea, roughness: 0.3, metalness: 0.3 });
  const mats = [side, side, side, side, front, side];
  for (let xx = x0; xx < x1; xx += 1.3) {
    if (Math.abs(xx - 100) < 4) continue;
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.1, 0.9), mats);
    m.position.set(xx, 1.05, z + 0.45); m.castShadow = true;
    island.add(m);
  }
  island.col.add(x0, x1, z, z + 0.9, 2.1);
}

/**
 * 中央广场：大理石地面、发光地球仪基座、直径 32 米的喷泉池、环形步道、路牌。
 * @param {import('./island.js').Island} island 岛实例
 * @returns {void}
 */
export function plaza(island) {
  const marble = new THREE.Mesh(quadGeo([[-43, -43, 43, 43]], 0.012, 1), pbrMaterial('marble', 1 / 8));
  marble.material.map.repeat.set(1 / 8, 1 / 8); marble.material.normalMap.repeat.set(1 / 8, 1 / 8); marble.material.roughnessMap.repeat.set(1 / 8, 1 / 8);
  marble.receiveShadow = true; island.add(marble);
  // A01 中央喷泉中间：发光地球仪加两圈金环（照地球村参考图）
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 5, 4, 32), new THREE.MeshStandardMaterial({ color: 0xe8dfcf, roughness: 0.45 }));
  ped.position.y = 2; ped.castShadow = ped.receiveShadow = true; island.add(ped);
  const goldM = new THREE.MeshStandardMaterial({ color: 0xffc35a, metalness: 1, roughness: 0.22, emissive: 0x6a3a00, emissiveIntensity: 0.4 });
  const crown = new THREE.Mesh(new THREE.TorusGeometry(4.3, 0.35, 10, 48), goldM); crown.rotation.x = Math.PI / 2; crown.position.y = 4; island.add(crown);
  island.col.add(-5, 5, -5, 5, 5.5);
  island.globe = island.makeGlobe(goldM); island.globe.position.y = 11; island.add(island.globe);
  island.globeLight = new THREE.PointLight(0x6fd8ff, 0, 60, 1.4); island.globeLight.position.set(0, 10, 0); island.add(island.globeLight);
  island.sign(plainSign(['地球村 · 中央广场', 'EARTH VILLAGE'], { bg: '#10284a', fg: '#ffd88a' }), 5, 2.5, 0, 2.2, 4.75, 0, 1);
  // A01 中央喷泉：直径 32 米，奶蛙像站在中间，一圈水柱
  const rim = new THREE.Mesh(new THREE.TorusGeometry(16, 0.7, 12, 96), ped.material);
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.45; island.add(rim);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(16, 64), new THREE.MeshStandardMaterial({ color: 0x1b5868, roughness: 0.1, metalness: 0.4, emissive: 0x0a3a50, emissiveIntensity: 0.6 }));
  pool.rotation.x = -Math.PI / 2; pool.position.y = 0.35; island.add(pool);
  island.animateSpray = buildPlazaDetails(island);
  // 环形步道
  const ring = new THREE.Mesh(new THREE.RingGeometry(20, 25, 96), new THREE.MeshStandardMaterial({ color: 0xd8c6a4, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -1 }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; ring.receiveShadow = true; island.add(ring);
  island.plazaBuildings();
  // 路牌
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6), new THREE.MeshStandardMaterial({ color: 0x333, metalness: 0.8, roughness: 0.3 }));
  post.position.set(20, 3, 38); post.castShadow = true; island.add(post);
  const boards = [['巴黎 200米 →', '#1f5f3a'], ['← 铁岭 50米', '#1f3f7a'], ['↑ 2079 你来的地方', '#6a1f3a'], ['东京便利店 ↗', '#3a3a3a']];
  boards.forEach(([t, bg], i) => {
    const s = island.sign(plainSign([t], { w: 512, h: 96, bg }), 4.2, 0.8, 20, 5.4 - i * 0.95, 38, (i % 2 ? -1 : 1) * 0.35 + Math.PI, 1);
    s.material.color.setScalar(0.9);
  });
  island.col.add(19.8, 20.2, 37.8, 38.2, 6);

}

/**
 * 中央广场四周的建筑，照《地球村 · 中央广场》构造图摆（北是 -z）。
 * @param {import('./island.js').Island} island 岛实例
 * @returns {void}
 */
export function plazaBuildings(island) {
  const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, ...o });
  const box = (x0, x1, z0, z1, y0, h, mat) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, h, z1 - z0), mat);
    m.position.set((x0 + x1) / 2, y0 + h / 2, (z0 + z1) / 2); m.castShadow = m.receiveShadow = true; island.add(m); return m;
  };
  const wall = M(0xe9e1d2), glass = M(0x7aa8c8, { metalness: 0.6, roughness: 0.15, emissive: 0x1a3a5a, emissiveIntensity: 0.4 });
  const label = (t, x, y, z, ry, w = 8, c = '#ff5fa8') => island.sign(neonSign(t, c, { w: 512, h: 128 }), w, w / 4, x, y, z, ry, 1.6);

  // B01 世界商场（西北）：两层圆角楼，上层玻璃
  const b01 = new THREE.Mesh(new THREE.CylinderGeometry(9, 9.5, 10, 8), island.winMat('pastel', 8, 2, 0xead8f2));
  b01.position.set(-34, 5, -34); b01.castShadow = b01.receiveShadow = true; island.add(b01);
  const b01g = new THREE.Mesh(new THREE.CylinderGeometry(8, 8.6, 7, 8), glass);
  b01g.position.set(-34, 13.5, -34); island.add(b01g);
  for (const y of [10, 17]) { const nb = new THREE.Mesh(new THREE.TorusGeometry(y === 10 ? 9.3 : 8.5, 0.2, 6, 8), island.neonMat(new THREE.Color(0.6, 2.2, 2.8))); nb.rotation.x = Math.PI / 2; nb.rotation.z = Math.PI / 8; nb.position.set(-34, y, -34); island.add(nb); }
  const dome = new THREE.Mesh(new THREE.SphereGeometry(6, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(0xc8d4e0, { metalness: 0.7, roughness: 0.25 }));
  dome.position.set(-34, 17, -34); island.add(dome);
  label('世界商场', -27.5, 8.5, -27.5, Math.PI / 4, 9, '#7ef6ff');
  island.col.add(-43, -25, -43, -25, 20);

  // B02 直播大屏楼（西侧）：一整面墙都是“2079 直播间”
  box(-42, -31, -22, -8, 0, 14, M(0x4a4f5a));
  const [sc, sx] = makeCanvas(512, 320);
  island.screen = { c: sc, x: sx, tex: canvasTex(sc), t: 0, n: 0 };
  island.screen.tex.wrapS = island.screen.tex.wrapT = THREE.ClampToEdgeWrapping;
  const smat = new THREE.MeshBasicMaterial({ map: island.screen.tex, color: new THREE.Color(1.3, 1.3, 1.3) });
  island.env.neon.push({ mat: smat, base: new THREE.Color(1.2, 1.2, 1.2) });
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(13, 8.2), smat);
  scr.position.set(-30.9, 8.5, -15); scr.rotation.y = Math.PI / 2; island.add(scr);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.3, 8.9, 13.7), island.neonMat(new THREE.Color(2.4, 0.6, 2.0))); frame.position.set(-31.15, 8.5, -15); island.add(frame);
  island.col.add(-42, -31, -22, -8, 14);

  // B03 任务中心（西南侧）
  box(-42, -30, 8, 22, 0, 8, island.winMat('concrete', 4, 2, 0xdcd0b8));
  box(-42.5, -29.5, 7.5, 22.5, 8, 0.8, M(0x8a4a2a));
  label('任务中心', -29.8, 6, 15, Math.PI / 2, 8, '#ffd84a');
  island.col.add(-42, -30, 8, 22, 9);

  // C02 AI 生成中（西南角）：全息方块加围挡
  island.holoMini(-34, 34, 16);

  // B04 咖啡塔楼（东北）：一层层叠起来的圆塔，48 米
  const pink = M(0xf3d6e4), tiers = [[9, 9], [7.5, 8], [6, 8], [4.5, 7], [3, 6]];
  let y = 0;
  for (const [r, h] of tiers) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r, h, 24), island.winMat('pastel', Math.max(3, Math.round(r * 1.2)), 2, 0xf6d6e6));
    t.position.set(34, y + h / 2, -34); t.castShadow = true; island.add(t);
    const band = new THREE.Mesh(new THREE.TorusGeometry(r * 0.95, 0.18, 6, 48), island.neonMat(new THREE.Color(2.2, 0.6, 1.4)));
    band.rotation.x = Math.PI / 2; band.position.set(34, y + h, -34); island.add(band);
    y += h;
  }
  const spire = new THREE.Mesh(new THREE.ConeGeometry(2.4, 10, 16), M(0xff7ab8, { metalness: 0.5, roughness: 0.3 }));
  spire.position.set(34, y + 5, -34); island.add(spire);
  label('咖啡街 · 一杯八十', 27.5, 7, -27.5, -Math.PI / 4, 10, '#ff8ad8');
  island.col.add(25, 43, -43, -25, 50);

  // C01 AI 生成中（北侧偏东，塔楼旁边）
  island.holoMini(14, -36, 10);

  // B05 载具租赁（东侧）：顶棚下停一排电驴、三轮、购物车（都是摆设）
  box(40.5, 42, 8, 22, 0, 5, M(0x647982));
  for (const z of [8, 22]) {
    box(32, 32.45, z, z + .45, 0, 5, wall);
    island.col.add(32, 32.45, z, z + .45, 5);
  }
  box(30, 43, 7, 23, 5, 0.5, M(0xffc83a));
  label('载具租赁', 30.6, 3.6, 15, -Math.PI / 2, 8, '#7ef6ff');
  island.col.add(40.5, 42, 8, 22, 6);

  // B06 集市（东南角）：彩色摊位，撞了会飞
  island.marketSpots = [];
  for (let i = 0; i < 6; i++) island.marketSpots.push([28 + (i % 3) * 5.5, 28 + Math.floor(i / 3) * 6]);
  label('集市广场', 34, 9, 25, 0, 9, '#ffd84a');
  island.plazaDecor();
}

/**
 * 有窗户的墙面材质，按楼的大小重复窗格，夜里会亮。
 * @param {import('./island.js').Island} island 岛实例
 * @param {'glass'|'concrete'|'shikumen'|'tokyo'|'pastel'} style 立面风格
 * @param {number} rx 横向窗格重复数
 * @param {number} ry 纵向窗格重复数
 * @param {number} [tint] 颜色覆盖
 * @returns {THREE.MeshStandardMaterial} 克隆出来的材质
 */
export function winMat(island, style, rx, ry, tint) {
  const base = island.facadeMat(style, 1), m = base.clone();
  for (const k of ['map', 'emissiveMap']) { m[k] = base[k].clone(); m[k].repeat.set(rx, ry); m[k].needsUpdate = true; }
  if (tint) m.color.set(tint);
  island.env.windows.push(m);
  return m;
}

/**
 * 小号“AI 生成中”：一块全息方块加黄黑围挡。
 * @param {import('./island.js').Island} island 岛实例
 * @param {number} cx 中心 x
 * @param {number} cz 中心 z
 * @param {number} s 边长
 * @returns {void}
 */
export function holoMini(island, cx, cz, s) {
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.9, 1.4), transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide });
  const lineMat = new THREE.LineBasicMaterial({ color: new THREE.Color(0.3, 1.5, 2.2), transparent: true, opacity: 0.8 });
  island.holo ??= [];
  const h = s * 1.4, m = new THREE.Mesh(new THREE.BoxGeometry(s * 0.7, h, s * 0.7), mat);
  m.position.set(cx, h / 2, cz); island.add(m);
  const l = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(s * 0.7, h, s * 0.7)), lineMat);
  l.position.copy(m.position); island.add(l);
  island.holo.push({ m, l, h, phase: cx * 0.1 });
  const [c, x] = makeCanvas(512, 64);
  for (let i = 0; i < 512; i += 32) { x.fillStyle = (i / 32) % 2 ? '#111' : '#ffd400'; x.fillRect(i, 0, 32, 64); }
  x.fillStyle = 'rgba(0,0,0,0.75)'; x.fillRect(40, 10, 432, 44);
  x.fillStyle = '#7ef6ff'; x.font = '900 30px "PingFang SC"'; x.textAlign = 'center'; x.fillText('AI 生成中 · 预计 2080 年完工', 256, 42);
  const t = canvasTex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  const fm = new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide });
  for (const [px, pz, ry] of [[0, -s / 2, 0], [0, s / 2, 0], [-s / 2, 0, Math.PI / 2], [s / 2, 0, Math.PI / 2]]) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(s, 1.6), fm); f.position.set(cx + px, 0.8, cz + pz); f.rotation.y = ry; island.add(f);
  }
  island.col.add(cx - s / 2, cx + s / 2, cz - s / 2, cz + s / 2, 2);
}

/**
 * 大屏：2079 直播间，弹幕一直在滚。每帧重画 canvas 并标脏贴图。
 * @param {import('./island.js').Island} island 岛实例
 * @param {number} t 累计时间（秒）
 * @returns {void}
 */
export function drawScreen(island, t) {
  const S = island.screen; if (!S) return;
  const x = S.x, W = 512, H = 320;
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#2a0f4a'); g.addColorStop(1, '#0a2a5a');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = '#ff3f6a'; x.fillRect(16, 14, 84, 30); x.fillStyle = '#fff'; x.font = '800 20px "PingFang SC"'; x.fillText('● LIVE', 24, 36);
  x.font = '900 34px "PingFang SC"'; x.fillText('2079 直播间：看古人上班', 112, 42);
  S.n = (S.n || 2079000) + Math.floor(Math.random() * 999);
  x.font = '700 20px "PingFang SC"'; x.fillStyle = '#ffd84a'; x.fillText(`在线 ${S.n.toLocaleString()} 人 · 礼物：电饭煲 ×${Math.floor(t * 3) % 999}`, 24, 76);
  // 奶蛙大脸
  x.fillStyle = '#f7f3ea'; x.beginPath(); x.ellipse(110, 200, 70, 62, 0, 0, 7); x.fill();
  x.fillStyle = '#222'; x.beginPath(); x.arc(85, 185, 9, 0, 7); x.arc(135, 185, 9, 0, 7); x.fill();
  x.strokeStyle = '#222'; x.lineWidth = 6; x.beginPath(); x.arc(110, 205, 22 + Math.sin(t * 6) * 6, 0.2, Math.PI - 0.2); x.stroke();
  const lines = ['哈哈哈哈', '古人好惨', '一杯八十？？', '我的刀盾', '七大姑来了', '活人感+1', '主播别摸鱼', '咕咕嘎嘎'];
  x.font = '800 24px "PingFang SC"';
  for (let i = 0; i < 6; i++) {
    const px = W - ((t * (90 + i * 23) + i * 170) % (W + 240)) + 120;
    x.fillStyle = ['#fff', '#7ef6ff', '#ff8ad8'][i % 3];
    x.fillText(lines[(i + Math.floor(t / 4)) % lines.length], px, 120 + i * 32);
  }
  S.tex.needsUpdate = true;
}

/**
 * 大号“AI 生成中”：九块全息楼体加四面黄黑围挡。
 * @param {import('./island.js').Island} island 岛实例
 * @param {number} cx 中心 x
 * @param {number} cz 中心 z
 * @returns {void}
 */
export function holoBlock(island, cx, cz) {
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.9, 1.4), transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide });
  const lineMat = new THREE.LineBasicMaterial({ color: new THREE.Color(0.3, 1.5, 2.2), transparent: true, opacity: 0.8 });
  island.holo ??= [];
  for (let i = 0; i < 9; i++) {
    const w = 10 + island.r() * 12, d = 10 + island.r() * 12, h = 15 + island.r() * 55;
    const x = cx + (i % 3 - 1) * 26, z = cz + (Math.floor(i / 3) - 1) * 26;
    const g = new THREE.BoxGeometry(w, h, d, 1, Math.ceil(h / 6), 1);
    const m = new THREE.Mesh(g, mat); m.position.set(x, h / 2, z); island.add(m);
    const l = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)), lineMat);
    l.position.copy(m.position); island.add(l);
    island.holo.push({ m, l, h, phase: island.r() * 6 });
  }
  // 围挡
  const [c, x] = makeCanvas(1024, 128);
  x.fillStyle = '#0d2a3a'; x.fillRect(0, 0, 1024, 128);
  for (let i = 0; i < 1024; i += 64) { x.fillStyle = '#ffd400'; x.beginPath(); x.moveTo(i, 128); x.lineTo(i + 32, 128); x.lineTo(i + 64, 100); x.lineTo(i + 32, 100); x.fill(); }
  x.fillStyle = '#7ef6ff'; x.font = '900 52px "PingFang SC"'; x.textAlign = 'center'; x.fillText('AI 生成中 · 预计 2080 年完工 · 37%', 512, 64);
  const t = canvasTex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  const fm = new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(1.2, 1.2, 1.2), side: THREE.DoubleSide });
  island.env.neon.push({ mat: fm, base: new THREE.Color(1.1, 1.1, 1.1) });
  const s = 40;
  for (const [px, pz, ry] of [[0, -s, 0], [0, s, 0], [-s, 0, Math.PI / 2], [s, 0, Math.PI / 2]]) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(80, 3), fm); f.position.set(cx + px, 1.5, cz + pz); f.rotation.y = ry; island.add(f);
  }
  island.col.add(cx - s, cx + s, cz - s - 0.3, cz - s + 0.3, 3); island.col.add(cx - s, cx + s, cz + s - 0.3, cz + s + 0.3, 3);
  island.col.add(cx - s - 0.3, cx - s + 0.3, cz - s, cz + s, 3); island.col.add(cx + s - 0.3, cx + s + 0.3, cz - s, cz + s, 3);
}
