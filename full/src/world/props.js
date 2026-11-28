// 道具与街景层：发光地球仪、广场装饰、公园、树与棕榈、街景（路灯/摊位/锥桶/跳台）、
// 可撞飞道具的登记与物理、每帧的场景动画。
import * as THREE from 'three';
import { pbrMaterial, plainSign } from '../gfx/textures.js';
import { makeCanvas, canvasTex } from '../core/util.js';
import { XR, ZR, ROAD_W, BEACH_Z } from '../core/config.js';
import { quadGeo, M4, instanced } from './colliders.js';
import { groundH } from './terrain.js';
import { globeMaps } from './districts/plaza.js';
import { getModel } from '../actors/models.js';
import { batchRigid } from '../gfx/batch.js';

/**
 * 发光地球仪：大陆用噪声画，经纬线发光；外面两圈金环慢慢转。
 * @param {import('./island.js').Island} island 岛实例
 * @param {THREE.Material} goldM 金环材质
 * @returns {THREE.Group} 地球仪组
 */
export function makeGlobe(island, goldM) {
  const g = new THREE.Group();
  const earth = new THREE.Mesh(new THREE.SphereGeometry(5.5, 48, 32), new THREE.MeshStandardMaterial({
    ...globeMaps(), emissive: 0xffffff, emissiveIntensity: 1.05, roughness: 0.35, metalness: 0.1 }));
  earth.castShadow = true; g.add(earth);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(6.1, 32, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.9, 1.6), transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false }));
  g.add(halo);
  island.globeRings = [];
  for (const [r, tilt] of [[7.6, 0.45], [8.6, -0.8]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.18, 8, 96), goldM);
    const piv = new THREE.Group(); piv.rotation.set(Math.PI / 2 + tilt, 0, tilt * 0.6); piv.add(ring); g.add(piv);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8), island.neonMat(new THREE.Color(3, 2.2, 0.8)));
    dot.position.x = r; ring.add(dot); island.globeRings.push(ring);
  }
  island.globeEarth = earth;
  return g;
}

/**
 * 公园：草地、随机撒的树、中间一个大跳台。
 * @param {import('./island.js').Island} island 岛实例
 * @param {number} cx 中心 x
 * @param {number} cz 中心 z
 * @returns {void}
 */
export function park(island, cx, cz) {
  const grass = new THREE.Mesh(quadGeo([[cx - 40, cz - 40, cx + 40, cz + 40]], 0.015, 1), pbrMaterial('grass', 1 / 4));
  grass.material.map.repeat.set(1 / 4, 1 / 4); grass.receiveShadow = true; island.add(grass);
  const pts = [];
  for (let i = 0; i < 40; i++) pts.push([cx + (island.r() - 0.5) * 74, cz + (island.r() - 0.5) * 74]);
  island.trees(pts.filter(([x, z]) => Math.hypot(x - cx, z - cz) > 10));
  // 公园中间一个大跳台
  island.ramp(cx, cz + 10, Math.PI, 12, 7, 3);
}

/**
 * 批量种树：树干与树冠各一个实例化网格，每棵登记一个碰撞盒。
 * @param {import('./island.js').Island} island 岛实例
 * @param {Array<[number, number]>} pts 每棵树的位置 [x, z]
 * @returns {void}
 */
export function trees(island, pts) {
  const trunk = new THREE.CylinderGeometry(0.25, 0.4, 5, 8); trunk.translate(0, 2.5, 0);
  const leaf = new THREE.IcosahedronGeometry(2.4, 1);
  const tm = [], lm = [];
  for (const [x, z] of pts) {
    const s = 0.8 + island.r() * 0.6;
    tm.push(M4(x, 0, z, island.r() * 6, s));
    for (let k = 0; k < 3; k++) lm.push(M4(x + (island.r() - 0.5) * 2.4 * s, (5 + island.r() * 1.8) * s, z + (island.r() - 0.5) * 2.4 * s, island.r() * 6, s * (0.8 + island.r() * 0.5)));
    island.col.add(x - 0.4, x + 0.4, z - 0.4, z + 0.4, 5);
  }
  island.add(instanced(trunk, new THREE.MeshStandardMaterial({ color: 0x6f5a48, roughness: 0.9 }), tm));
  island.add(instanced(leaf, new THREE.MeshStandardMaterial({ color: 0x5f8f3a, roughness: 0.8, flatShading: true }), lm));
}

/**
 * 批量种棕榈：树干按段堆叠并带倾斜，树冠八片叶子。
 * @param {import('./island.js').Island} island 岛实例
 * @param {Array<[number, number]>} pts 每棵棕榈的位置 [x, z]
 * @returns {void}
 */
export function palms(island, pts) {
  const seg = new THREE.CylinderGeometry(0.22, 0.3, 1.2, 8); seg.translate(0, 0.6, 0);
  const frond = new THREE.ConeGeometry(0.7, 5, 4, 1, true); frond.translate(0, 2.5, 0); frond.rotateZ(-Math.PI / 2 + 0.35); frond.scale(1, 0.25, 1);
  const sm = [], fm = [];
  for (const [x, z] of pts) {
    const lean = (island.r() - 0.5) * 0.5, ry = island.r() * 6, n = 7 + Math.floor(island.r() * 3);
    let px = x, py = groundH(x, z), pz = z;
    for (let i = 0; i < n; i++) {
      const m = new THREE.Matrix4().compose(new THREE.Vector3(px, py, pz), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, lean * i / n)), new THREE.Vector3(1 - i * 0.04, 1, 1 - i * 0.04));
      sm.push(m);
      px += Math.sin(lean * i / n) * -1.2 * Math.cos(ry); pz += Math.sin(lean * i / n) * 1.2 * Math.sin(ry); py += 1.15;
    }
    for (let k = 0; k < 8; k++) fm.push(new THREE.Matrix4().compose(new THREE.Vector3(px, py, pz), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (k / 8) * Math.PI * 2 + ry, 0)), new THREE.Vector3(1, 1, 1)));
    island.col.add(x - 0.4, x + 0.4, z - 0.4, z + 0.4, 6);
  }
  island.add(instanced(seg, new THREE.MeshStandardMaterial({ color: 0x8a6b4a, roughness: 0.9 }), sm));
  island.add(instanced(frond, new THREE.MeshStandardMaterial({ color: 0x3f8a3a, roughness: 0.7, side: THREE.DoubleSide, flatShading: true }), fm));
}

/**
 * 广场的装饰：拱门、罗盘地面、花坛、树、路灯、彩灯串、旗子、遮阳伞、停着的电驴。
 * @param {import('./island.js').Island} island 岛实例
 * @returns {void}
 */
export function plazaDecor(island) {
  const stone = new THREE.MeshStandardMaterial({ color: 0xefe6d6, roughness: 0.5 });
  // M05 南入口拱门“地球村”
  for (const sx of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(2.6, 10, 2.6), stone); p.position.set(sx * 8.6, 5, 41); p.castShadow = true; island.add(p);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.8, 3.2), stone); cap.position.set(sx * 8.6, 10.2, 41); island.add(cap);
    island.col.add(sx * 8.6 - 1.3, sx * 8.6 + 1.3, 39.7, 42.3, 10);
    // 蓝色旗子
    const [bc, bx] = makeCanvas(128, 256);
    bx.fillStyle = '#1d3a8a'; bx.fillRect(0, 0, 128, 256); bx.strokeStyle = '#ffd88a'; bx.lineWidth = 6; bx.strokeRect(8, 8, 112, 240);
    bx.beginPath(); bx.arc(64, 110, 34, 0, 7); bx.stroke(); bx.beginPath(); bx.ellipse(64, 110, 14, 34, 0, 0, 7); bx.stroke();
    bx.beginPath(); bx.moveTo(30, 110); bx.lineTo(98, 110); bx.stroke();
    bx.fillStyle = '#ffd88a'; bx.font = '900 26px "PingFang SC"'; bx.textAlign = 'center'; bx.fillText('地球村', 64, 200);
    const bt = canvasTex(bc); bt.wrapS = bt.wrapT = THREE.ClampToEdgeWrapping;
    const ban = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 4.4), new THREE.MeshStandardMaterial({ map: bt, side: THREE.DoubleSide, roughness: 0.8 }));
    ban.position.set(sx * 8.6, 6.4, 39.6); island.add(ban);
  }
  const arch = new THREE.Mesh(new THREE.TorusGeometry(8.6, 1.1, 12, 48, Math.PI), stone);
  arch.position.set(0, 10, 41); arch.castShadow = true; island.add(arch);
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 8, 6), island.neonMat(new THREE.Color(2.6, 1.8, 0.8)), 40);
  for (let i = 0; i < 40; i++) {
    const a = (i / 39) * Math.PI;
    bulbs.setMatrixAt(i, new THREE.Matrix4().makeTranslation(Math.cos(a) * 8.6, 10 + Math.sin(a) * 8.6, 39.8));
  }
  island.add(bulbs);
  island.sign(plainSign(['地 球 村', 'E A R T H   V I L L A G E'], { w: 768, h: 240, bg: '#203b50', fg: '#ffe3a9' }), 5.8, 1.9, 0, 17.7, 42.3, 0, 0.88);
  // 罗盘地面
  const [cc, cx] = makeCanvas(512, 512);
  cx.fillStyle = '#d8c6a4'; cx.fillRect(0, 0, 512, 512);
  cx.strokeStyle = '#8a6a3a'; cx.lineWidth = 10; cx.beginPath(); cx.arc(256, 256, 230, 0, 7); cx.stroke(); cx.lineWidth = 4; cx.beginPath(); cx.arc(256, 256, 200, 0, 7); cx.stroke();
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2, L = k % 2 ? 140 : 220;
    cx.fillStyle = k % 2 ? '#b89a6a' : '#6a4a2a'; cx.beginPath();
    cx.moveTo(256 + Math.cos(a) * L, 256 + Math.sin(a) * L); cx.lineTo(256 + Math.cos(a + 0.22) * 40, 256 + Math.sin(a + 0.22) * 40);
    cx.lineTo(256, 256); cx.lineTo(256 + Math.cos(a - 0.22) * 40, 256 + Math.sin(a - 0.22) * 40); cx.fill();
  }
  const comp = new THREE.Mesh(new THREE.CircleGeometry(5.5, 48), new THREE.MeshStandardMaterial({ map: canvasTex(cc), roughness: 0.4, metalness: 0.2, polygonOffset: true, polygonOffsetFactor: -2 }));
  comp.rotation.x = -Math.PI / 2; comp.position.set(0, 0.04, 33); island.add(comp);
  // 花坛：一圈八个，种满粉紫色的花
  const flowerCols = [0xff6fb0, 0xc77dff, 0xffd84a, 0xff9aa8, 0x9a7dff];
  const fl = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.3, 0), new THREE.MeshStandardMaterial({ roughness: 0.6, emissive: 0x220a1a }), 8 * 46);
  let fi = 0;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8, bx = Math.cos(a) * 30, bz = Math.sin(a) * 30;
    const bed = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.8, 0.7, 24), stone); bed.position.set(bx, 0.35, bz); bed.receiveShadow = true; island.add(bed);
    const soil = new THREE.Mesh(new THREE.CircleGeometry(2.45, 24), new THREE.MeshStandardMaterial({ color: 0x3f6a2a, roughness: 0.9 }));
    soil.rotation.x = -Math.PI / 2; soil.position.set(bx, 0.71, bz); island.add(soil);
    for (let i = 0; i < 46; i++) {
      const rr = Math.sqrt(island.r()) * 2.2, aa = island.r() * 7;
      fl.setMatrixAt(fi, new THREE.Matrix4().compose(new THREE.Vector3(bx + Math.cos(aa) * rr, 0.85 + island.r() * 0.35, bz + Math.sin(aa) * rr), new THREE.Quaternion(), new THREE.Vector3().setScalar(0.7 + island.r() * 0.6)));
      fl.setColorAt(fi++, new THREE.Color(flowerCols[Math.floor(island.r() * 5)]));
    }
  }
  fl.castShadow = true; island.add(fl);
  island.palms([[-14, -40], [14, -40], [-14, 37], [14, 37], [-21, 19], [21, 19]]);
  island.trees([[40, -14], [-20, -30], [20, 30]]);
  // 路灯一圈，路灯之间挂彩灯串
  const poleM = new THREE.MeshStandardMaterial({ color: 0x2a2c30, metalness: 0.8, roughness: 0.35 });
  const lamps = [];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8, x = Math.cos(a) * 26, z = Math.sin(a) * 26;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 6, 8), poleM); pole.position.set(x, 3, z); island.add(pole);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 8), island.neonMat(new THREE.Color(2.4, 1.7, 0.9))); head.position.set(x, 6.2, z); island.add(head);
    lamps.push(new THREE.Vector3(x, 6, z));
  }
  const bulbCols = [[2.8, 0.6, 0.8], [2.6, 2.0, 0.5], [0.6, 2.2, 2.8], [1.6, 0.8, 2.8]];
  const bl = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffffff }), 8 * 14);
  const flags = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.5, 0.6), new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.8 }), 8 * 14);
  let bi = 0;
  for (let k = 0; k < 8; k++) {
    const A = lamps[k], B = lamps[(k + 1) % 8];
    for (let i = 0; i < 14; i++) {
      const t = (i + 0.5) / 14, p = A.clone().lerp(B, t); p.y -= Math.sin(t * Math.PI) * 1.4;
      bl.setMatrixAt(bi, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z));
      bl.setColorAt(bi, new THREE.Color(...bulbCols[i % 4]));
      const yaw = Math.atan2(B.x - A.x, B.z - A.z) + Math.PI / 2;
      flags.setMatrixAt(bi, new THREE.Matrix4().compose(p.clone().setY(p.y - 0.35), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1)));
      flags.setColorAt(bi++, new THREE.Color([0xff4d6d, 0xffd84a, 0x4dabf7, 0x51cf66, 0xc77dff][i % 5]));
    }
  }
  island.bulbMat = bl.material; island.add(bl); island.add(flags);
  // 集市：条纹遮阳伞
  const [uc, ux] = makeCanvas(256, 64);
  for (let i = 0; i < 8; i++) { ux.fillStyle = i % 2 ? '#ffffff' : '#ff4d6d'; ux.fillRect(i * 32, 0, 32, 64); }
  const ut = canvasTex(uc); ut.wrapS = THREE.RepeatWrapping;
  const umat = new THREE.MeshStandardMaterial({ map: ut, roughness: 0.7, side: THREE.DoubleSide });
  for (const [x, z] of [[27, 39], [33, 39], [39, 39], [39, 33]]) {
    const u = new THREE.Mesh(new THREE.ConeGeometry(2.2, 0.9, 16, 1, true), umat); u.position.set(x, 2.7, z); u.castShadow = true; island.add(u);
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.7), poleM); p.position.set(x, 1.35, z); island.add(p);
  }
  // 载具租赁：顶棚下停三台小电驴
  for (let i = 0; i < 3; i++) {
    const b = getModel('ebike'); b.position.set(36.5, 0, 10.5 + i * 4.5); b.rotation.y = -Math.PI / 2; island.add(b);
  }
  // 任务中心头顶：转着的金色感叹号
  const ex = new THREE.Group();
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 3, 0.9), island.neonMat(new THREE.Color(3, 2.2, 0.4))); bar.position.y = 1.2; ex.add(bar);
  const dotE = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), bar.material); dotE.position.y = -1.1; ex.add(dotE);
  ex.position.set(-36, 13.5, 15); island.add(ex); island.questIcon = ex;
}

/**
 * 街景：路灯、行道树、摊位、路障、垃圾桶、跳台。
 * @param {import('./island.js').Island} island 岛实例
 * @returns {void}
 */
export function buildStreetLife(island) {
  // 路灯
  const pole = new THREE.CylinderGeometry(0.08, 0.12, 6, 8); pole.translate(0, 3, 0);
  const head = new THREE.BoxGeometry(0.5, 0.15, 1.2); head.translate(0, 6, 0.4);
  const pm = [], hm = [];
  const off = ROAD_W / 2 + 1;
  for (const x of XR) for (let z = -140; z < 150; z += 22) if (!ZR.some((zz) => Math.abs(z - zz) < 10)) {
    pm.push(M4(x + off, 0, z, -Math.PI / 2)); hm.push(M4(x + off, 0, z, -Math.PI / 2));
  }
  for (const z of ZR) for (let x = -140; x < 150; x += 22) if (!XR.some((xx) => Math.abs(x - xx) < 10)) {
    pm.push(M4(x, 0, z + off, Math.PI)); hm.push(M4(x, 0, z + off, Math.PI));
  }
  island.add(instanced(pole, new THREE.MeshStandardMaterial({ color: 0x2a2c30, metalness: 0.8, roughness: 0.35 }), pm));
  island.add(instanced(head, island.neonMat(new THREE.Color(1.0, 0.75, 0.45)), hm, { cast: false }));
  // 梧桐
  const pts = [];
  for (let x = -144; x < -56; x += 11) { pts.push([x, -50 - 9.2]); pts.push([x, -50 + 9.2]); }
  for (let z = -140; z < 150; z += 14) if (!ZR.some((zz) => Math.abs(z - zz) < 12)) pts.push([-150 - 9.2, z]);
  island.trees(pts);

  // 摊位、路障、垃圾桶：沿着外卖路线放
  const r = island.r;
  const stall = (x, z, ry) => {
    const g = new THREE.Group();
    const awn = ['#ff4d4d', '#2fa4ff', '#ffd400', '#3fd47a'][Math.floor(r() * 4)];
    const t = new THREE.Mesh(new THREE.BoxGeometry(2, 0.9, 1), new THREE.MeshStandardMaterial({ color: 0x9a7048, roughness: 0.8 })); t.position.y = 0.45; g.add(t);
    const a = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.08, 1.4), new THREE.MeshStandardMaterial({ color: awn, roughness: 0.6 })); a.position.y = 2.1; a.rotation.x = 0.2; g.add(a);
    for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.1), t.material); p.position.set(sx * 1.05, 1.05, -0.45); g.add(p); }
    const fruit = ['#ff3b30', '#ffcc00', '#34c759', '#ff9500'];
    for (let i = 0; i < 10; i++) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshStandardMaterial({ color: fruit[i % 4], roughness: 0.3 }));
      f.position.set(-0.8 + (i % 5) * 0.4, 1.0, -0.2 + Math.floor(i / 5) * 0.35); g.add(f);
    }
    return island.addProp(g, x, z, ry, 1.2, 1.5);
  };
  const cone = (x, z) => {
    const g = new THREE.Group();
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 16), new THREE.MeshStandardMaterial({ color: 0xff5a1f, roughness: 0.5 }));
    c.position.y = 0.4; g.add(c);
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.12, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x666666 }));
    s.position.y = 0.45; g.add(s);
    return island.addProp(g, x, z, 0, 0.4, 0.3);
  };
  const crate = (x, z) => {
    const g = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), new THREE.MeshStandardMaterial({ color: 0xb08850, roughness: 0.85 }));
    g.position.y = 0.45;
    const w = new THREE.Group(); w.add(g);
    return island.addProp(w, x, z, r() * 3, 0.6, 0.6);
  };
  // B06 集市广场的摊位
  for (const [x, z] of island.marketSpots || []) stall(x, z, Math.PI);
  // 魔都和东京的大街两边
  for (let x = -140; x < 140; x += 9 + r() * 6) {
    if (Math.abs(x + 50) < 10 || Math.abs(x - 50) < 10 || Math.abs(x) < 12) continue;
    const side = r() < 0.5 ? -1 : 1;
    if (r() < 0.6) stall(x, -100 + side * (ROAD_W / 2 - 1.2), side > 0 ? Math.PI : 0);
    else crate(x, -100 + side * (ROAD_W / 2 - 1));
  }
  // 路中间的锥桶（专门给人撞）
  for (let x = -130; x < 140; x += 14) if (Math.abs(x) > 14) cone(x + r() * 4, -100 + (r() - 0.5) * 6);
  for (let z = -80; z < 200; z += 16) {
    if (Math.abs(z - 80) < 10) continue;
    cone(150 + (r() - 0.5) * 8, z);
    if (r() < 0.5) stall(150 + (r() < 0.5 ? -1 : 1) * (ROAD_W / 2 - 1.2), z + 6, Math.PI / 2);
  }
  for (let z = -90; z < 40; z += 12) crate(-150 + (r() - 0.5) * 8, z);
  // 跳台
  island.ramp(0, -100, Math.PI / 2, 10, 6, 2.4);
  island.ramp(150, 80, 0, 11, 7, 3.0);
  island.ramp(118, BEACH_Z, -Math.PI / 2, 10, 6, 2.2);
}

/**
 * 登记一个可撞飞的道具：贴地摆放、开阴影、进 props 列表。
 * @param {import('./island.js').Island} island 岛实例
 * @param {THREE.Object3D} obj 道具对象
 * @param {number} x 位置 x
 * @param {number} z 位置 z
 * @param {number} ry 绕 Y 旋转（弧度）
 * @param {number} radius 碰撞半径
 * @param {number} mass 质量，影响被撞飞的力度
 * @returns {{ obj: THREE.Object3D, radius: number, mass: number, vel: THREE.Vector3, spin: THREE.Vector3, flying: boolean, home: THREE.Vector3 }} 道具记录
 */
export function addProp(island, obj, x, z, ry, radius, mass) {
  obj.position.set(x, island.heightAt(x, z), z); obj.rotation.y = ry;
  obj.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  // 刚体零件合并：撞飞只动 obj 本身，零件相对变换不变，合成一块能省掉一堆 draw call
  batchRigid(obj);
  island.add(obj);
  const p = { obj, radius, mass, vel: new THREE.Vector3(), spin: new THREE.Vector3(), flying: false, home: new THREE.Vector3(x, 0, z) };
  island.props.push(p);
  return p;
}

/**
 * 撞飞：返回本次新撞飞的个数
 * @param {import('./island.js').Island} island 岛实例
 * @param {THREE.Vector3} pos 撞击点
 * @param {number} radius 撞击半径
 * @param {THREE.Vector3} vel 撞击速度
 * @param {number} [power=1] 力度倍率
 * @returns {number} 本次新撞飞的道具个数
 */
export function hitProps(island, pos, radius, vel, power = 1) {
  let n = 0;
  const sp = Math.hypot(vel.x, vel.z);
  for (const p of island.props) {
    const dx = p.obj.position.x - pos.x, dz = p.obj.position.z - pos.z;
    const d = Math.hypot(dx, dz);
    if (d > radius + p.radius || Math.abs(p.obj.position.y - pos.y) > 3) continue;
    if (p.flying && p.vel.lengthSq() > 4) continue;
    const k = (Math.max(sp, 6) * 0.9 * power) / Math.sqrt(p.mass);
    p.vel.set(dx / (d + 1e-3) * k * 0.6 + vel.x * 0.7, 5 + k * 0.45, dz / (d + 1e-3) * k * 0.6 + vel.z * 0.7);
    p.spin.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 14);
    p.flying = true; n++;
  }
  return n;
}

/**
 * 爆炸冲击：半径内所有道具按距离衰减被掀飞。
 * @param {import('./island.js').Island} island 岛实例
 * @param {THREE.Vector3} pos 爆心
 * @param {number} radius 影响半径
 * @param {number} power 冲击力度
 * @returns {number} 被掀飞的道具个数
 */
export function blast(island, pos, radius, power) {
  let n = 0;
  for (const p of island.props) {
    const dx = p.obj.position.x - pos.x, dz = p.obj.position.z - pos.z, d = Math.hypot(dx, dz);
    if (d > radius) continue;
    const k = power * (1 - d / radius) + 6;
    p.vel.set(dx / (d + 0.1) * k, 10 + k * 0.8, dz / (d + 0.1) * k);
    p.spin.set((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20);
    p.flying = true; n++;
  }
  return n;
}

/**
 * 推进所有飞行中的道具：重力、旋转、落地弹跳、盒体碰撞反弹。
 * @param {import('./island.js').Island} island 岛实例
 * @param {number} dt 帧间隔（秒）
 * @returns {void}
 */
export function updateProps(island, dt) {
  for (const p of island.props) {
    if (!p.flying) continue;
    const o = p.obj;
    p.vel.y -= 22 * dt;
    o.position.addScaledVector(p.vel, dt);
    o.rotation.x += p.spin.x * dt; o.rotation.y += p.spin.y * dt; o.rotation.z += p.spin.z * dt;
    const gh = groundH(o.position.x, o.position.z);
    if (o.position.y < gh) {
      o.position.y = gh;
      if (p.vel.y < -3) { p.vel.y *= -0.38; p.vel.x *= 0.7; p.vel.z *= 0.7; p.spin.multiplyScalar(0.6); }
      else {
        p.vel.set(0, 0, 0); p.spin.set(0, 0, 0); p.flying = false;
      }
    }
    const hit = island.col.resolve(o.position, p.radius, o.position.y);
    if (hit) { p.vel.x *= -0.4; p.vel.z *= -0.4; }
  }
}

/**
 * 每帧的场景动画：街区组件、地球仪、任务图标、喷泉、大屏、全息方块。
 * @param {import('./island.js').Island} island 岛实例
 * @param {number} dt 帧间隔（秒）
 * @param {number} t 累计时间（秒）
 * @returns {void}
 */
export function updateScenery(island, dt, t) {
  for (const d of island.districts) d.animate?.(dt, t);
  if (island.globe) {
    island.globeEarth.rotation.y += dt * 0.25;
    island.globeRings.forEach((r, i) => { r.rotation.z += dt * (i ? -0.5 : 0.35); });
    island.globe.position.y = 11 + Math.sin(t * 0.8) * 0.3;
    island.globeLight.intensity = 14 + island.env.night * 43;
  }
  if (island.questIcon) { island.questIcon.rotation.y += dt * 2; island.questIcon.position.y = 13.5 + Math.sin(t * 2.5) * 0.4; }
  island.animateSpray(t);
  if (island.screen && (island.screen.t -= dt) <= 0) { island.screen.t = 0.12; island.drawScreen(t); }
  if (island.holo) for (const h of island.holo) {
    const s = 0.85 + 0.15 * Math.sin(t * 1.5 + h.phase);
    h.l.material.opacity = 0.4 + 0.5 * Math.abs(Math.sin(t * 2 + h.phase));
    h.m.scale.y = s; h.m.position.y = (h.h * s) / 2;
    h.l.scale.y = s; h.l.position.y = h.m.position.y;
  }
}
