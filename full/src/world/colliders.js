// 碰撞与几何小工具：分桶盒体碰撞、批量四边形地面、实例化网格、变换矩阵构造。
// 全部从 world/island.js 原样搬出，逻辑一字未改。
import * as THREE from 'three';

/**
 * 分桶的轴对齐盒体碰撞集合。盒子按 20 米见方的网格分桶，查询只扫所在格。
 */
export class Colliders {
  constructor() { this.boxes = []; this.grid = new Map(); this.cell = 20; }

  /**
   * 加一个盒体，并登记到它覆盖的每一个网格。
   * @param {number} x0 x 下界
   * @param {number} x1 x 上界
   * @param {number} z0 z 下界
   * @param {number} z1 z 上界
   * @param {number} [top=50] 盒体顶面高度，高于它的物体不受阻挡
   * @returns {{ x0: number, x1: number, z0: number, z1: number, top: number }} 新加的盒体
   */
  add(x0, x1, z0, z1, top = 50) {
    const b = { x0, x1, z0, z1, top };
    this.boxes.push(b);
    const c = this.cell;
    for (let i = Math.floor(x0 / c); i <= Math.floor(x1 / c); i++)
      for (let j = Math.floor(z0 / c); j <= Math.floor(z1 / c); j++) {
        const k = i + ',' + j;
        if (!this.grid.has(k)) this.grid.set(k, []);
        this.grid.get(k).push(b);
      }
    return b;
  }

  /**
   * 取某个点所在网格里的盒体。
   * @param {number} x x 坐标
   * @param {number} z z 坐标
   * @returns {Array<{ x0: number, x1: number, z0: number, z1: number, top: number }>} 该格内的盒体
   */
  near(x, z) { return this.grid.get(Math.floor(x / this.cell) + ',' + Math.floor(z / this.cell)) || []; }

  /**
   * 把半径 r 的圆推出盒子。返回推出的法线或 null
   * @param {THREE.Vector3} p 会被就地修改的位置
   * @param {number} r 半径
   * @param {number} [y=0] 物体高度，高于盒体顶面时跳过该盒
   * @returns {THREE.Vector2|null} 推出的法线，没碰到返回 null
   */
  resolve(p, r, y = 0) {
    let hit = null;
    for (const b of this.near(p.x, p.z)) {
      if (y > b.top) continue;
      const cx = Math.max(b.x0, Math.min(p.x, b.x1)), cz = Math.max(b.z0, Math.min(p.z, b.z1));
      const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2); p.x = cx + (dx / d) * r; p.z = cz + (dz / d) * r;
          hit = new THREE.Vector2(dx / d, dz / d);
        } else {
          const ox = Math.min(p.x - b.x0, b.x1 - p.x), oz = Math.min(p.z - b.z0, b.z1 - p.z);
          if (ox < oz) { const s = p.x - b.x0 < b.x1 - p.x ? -1 : 1; p.x = s < 0 ? b.x0 - r : b.x1 + r; hit = new THREE.Vector2(s, 0); }
          else { const s = p.z - b.z0 < b.z1 - p.z ? -1 : 1; p.z = s < 0 ? b.z0 - r : b.z1 + r; hit = new THREE.Vector2(0, s); }
        }
      }
    }
    return hit;
  }
}

/**
 * 把一批 [x0, z0, x1, z1] 矩形拼成一张水平四边形网格，UV 按世界坐标铺。
 * @param {Array<[number, number, number, number]>} rects 矩形列表
 * @param {number} y 平面高度
 * @param {number} uvScale UV 缩放（世界单位 / 贴图重复）
 * @returns {THREE.BufferGeometry} 合并后的几何体
 */
export function quadGeo(rects, y, uvScale) {
  const pos = [], uv = [], idx = [];
  for (const [x0, z0, x1, z1] of rects) {
    const i = pos.length / 3;
    pos.push(x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1);
    uv.push(x0 / uvScale, -z0 / uvScale, x1 / uvScale, -z0 / uvScale, x1 / uvScale, -z1 / uvScale, x0 / uvScale, -z1 / uvScale);
    idx.push(i, i + 2, i + 1, i, i + 3, i + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/**
 * 用一组矩阵建一个实例化网格。
 * @param {THREE.BufferGeometry} geo 共享几何体
 * @param {THREE.Material} mat 共享材质
 * @param {THREE.Matrix4[]} mats 每个实例的变换矩阵
 * @param {{ cast?: boolean, receive?: boolean }} [opts] 是否投影 / 接收阴影
 * @returns {THREE.InstancedMesh} 实例化网格
 */
export function instanced(geo, mat, mats, { cast = true, receive = true } = {}) {
  const m = new THREE.InstancedMesh(geo, mat, mats.length);
  mats.forEach((mt, i) => m.setMatrixAt(i, mt));
  m.castShadow = cast; m.receiveShadow = receive;
  m.instanceMatrix.needsUpdate = true;
  return m;
}

/**
 * 构造一个「平移 + 绕 Y 旋转 + 非等比缩放」的变换矩阵。
 * @param {number} x x 坐标
 * @param {number} y y 坐标
 * @param {number} z z 坐标
 * @param {number} [ry=0] 绕 Y 轴旋转（弧度）
 * @param {number} [s=1] 水平缩放
 * @param {number} [sy=s] 垂直缩放，默认跟随 s
 * @returns {THREE.Matrix4} 变换矩阵
 */
export const M4 = (x, y, z, ry = 0, s = 1, sy = s) => new THREE.Matrix4().compose(
  new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(s, sy, s));
