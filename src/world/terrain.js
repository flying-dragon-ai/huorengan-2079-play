// 地形层：海岸线、地面高度场、地形网格、跳台。路网与海岸线的基准值统一从 core/config.js 取。
import * as THREE from 'three';
import { pbrMaterial } from '../gfx/textures.js';
import { smooth, makeCanvas, canvasTex } from '../core/util.js';
import { quadGeo } from './colliders.js';

export { XR, ZR, ROAD_W, BEACH_Z } from '../core/config.js';

/**
 * 极坐标方向 a 上的海岸线半径（米）。三个正弦叠加，做出不规则的海湾。
 * @param {number} a 方位角（弧度）
 * @returns {number} 该方向上海岸线的半径
 */
export function shoreEdge(a) { return 320 + 14 * Math.sin(a * 3 + 0.5) + 8 * Math.sin(a * 7 + 1.3); }

/**
 * 世界坐标处的地面高度。城区（|x|,|z| ≤ 168）恒为 0，往外是起伏的丘陵，
 * 靠近海岸线时下潜成沙滩。
 * @param {number} x x 坐标
 * @param {number} z z 坐标
 * @returns {number} 地面高度（米）
 */
export function groundH(x, z) {
  const td = Math.max(Math.abs(x), Math.abs(z)) - 168;
  if (td <= 0) return 0;
  const r = Math.hypot(x, z), a = Math.atan2(z, x), edge = shoreEdge(a);
  let hill = (Math.sin(x * 0.043) * Math.cos(z * 0.037) + Math.sin(x * 0.011 + z * 0.019) + 1.4) * 1.3;
  hill *= smooth(0, 30, td) * (1 - smooth(150, 200, z));
  return hill - smooth(edge - 70, edge + 20, r) * 7;
}

/**
 * 建地形：1200×1200 的顶点着色地形网格，外加城区的人行道砖地面。
 * @param {import('./island.js').Island} island 岛实例
 * @returns {void}
 */
export function buildTerrain(island) {
  const g = new THREE.PlaneGeometry(1200, 1200, 240, 240);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, col = [];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const h = groundH(x, z);
    p.setY(i, h - 0.02);
    const grassy = (1 - smooth(140, 190, z)) * smooth(-1, 1.5, h) * (1 - smooth(260, 300, Math.hypot(x, z)));
    const wet = smooth(-0.2, -1.2, h);
    const c = new THREE.Color(1, 1, 1).lerp(new THREE.Color(0.42, 0.62, 0.3), grassy).multiplyScalar(1 - wet * 0.45);
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = pbrMaterial('sand', 160, { vertexColors: true });
  const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true;
  island.add(mesh);
  // 城区地面：人行道砖
  const base = new THREE.Mesh(quadGeo([[-170, -170, 170, 170]], 0.005, 6), pbrMaterial('tiles', 1, {}));
  base.receiveShadow = true; island.add(base);
}

/**
 * 跳台：沿 ry 方向升高。几何体是一个三角柱，黄黑警示条纹贴图。
 * @param {import('./island.js').Island} island 岛实例
 * @param {number} x 中心 x
 * @param {number} z 中心 z
 * @param {number} ry 上坡方向（弧度）
 * @param {number} [L=10] 坡长
 * @param {number} [W=6] 坡宽
 * @param {number} [H=2.2] 坡高
 * @returns {void}
 */
export function ramp(island, x, z, ry, L = 10, W = 6, H = 2.2) {
  const shape = new THREE.Shape(); shape.moveTo(-L / 2, 0); shape.lineTo(L / 2, 0); shape.lineTo(L / 2, H); shape.lineTo(-L / 2, 0);
  const g = new THREE.ExtrudeGeometry(shape, { depth: W, bevelEnabled: false });
  g.translate(0, 0, -W / 2); g.rotateY(-Math.PI / 2);
  const [c, cx] = makeCanvas(128, 128);
  for (let i = 0; i < 8; i++) { cx.fillStyle = i % 2 ? '#111' : '#ffcc00'; cx.fillRect(i * 16, 0, 16, 128); }
  const t = canvasTex(c); t.repeat.set(2, 2);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }));
  m.position.set(x, 0.03, z); m.rotation.y = ry; m.castShadow = m.receiveShadow = true;
  island.add(m);
  island.ramps.push({ x, z, ry, L, W, H });
}

/**
 * 某个世界坐标落在跳台上的高度。多个跳台重叠时取最高的那个。
 * @param {import('./island.js').Island} island 岛实例
 * @param {number} x x 坐标
 * @param {number} z z 坐标
 * @returns {number} 跳台表面高度，不在任何跳台上返回 0
 */
export function rampHeight(island, x, z) {
  let best = 0;
  for (const r of island.ramps) {
    const dx = x - r.x, dz = z - r.z;
    const f = dx * Math.sin(r.ry) + dz * Math.cos(r.ry);   // 沿上坡方向
    const s = dx * Math.cos(r.ry) - dz * Math.sin(r.ry);
    if (Math.abs(s) < r.W / 2 && Math.abs(f) < r.L / 2) best = Math.max(best, ((f + r.L / 2) / r.L) * r.H);
  }
  return best;
}

/**
 * 可站立高度：地面高度与跳台高度取大者。
 * @param {import('./island.js').Island} island 岛实例
 * @param {number} x x 坐标
 * @param {number} z z 坐标
 * @returns {number} 该点的高度（米）
 */
export function heightAt(island, x, z) { return Math.max(groundH(x, z), island.rampHeight(x, z)); }
