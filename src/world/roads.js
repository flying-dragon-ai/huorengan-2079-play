// 路网层：南北向 / 东西向马路、车道标线、斑马线，以及「这个点是不是在路上」的查询。
import * as THREE from 'three';
import { pbrMaterial } from '../gfx/textures.js';
import { XR, ZR, ROAD_W, BEACH_Z } from '../core/config.js';
import { quadGeo } from './colliders.js';

/**
 * 建路网：XR / ZR 两组马路、海滩前的横向大道、车道标线、每个路口四向斑马线。
 * @param {import('./island.js').Island} island 岛实例
 * @returns {void}
 */
export function buildRoads(island) {
  const w = ROAD_W / 2, rects = [], marks = [];
  for (const x of XR) {
    const z1 = (x === -150 || x === 150) ? BEACH_Z : 157;
    rects.push([x - w, -157, x + w, z1 + w]);
    for (let z = -150; z < z1; z += 8) if (!ZR.some((zz) => Math.abs(z - zz) < 9)) marks.push([x - 0.15, z, x + 0.15, z + 4]);
  }
  for (const z of ZR) {
    rects.push([-157, z - w, 157, z + w]);
    for (let x = -150; x < 150; x += 8) if (!XR.some((xx) => Math.abs(x - xx) < 9)) marks.push([x, z - 0.15, x + 4, z + 0.15]);
  }
  rects.push([-157, BEACH_Z - w, 157, BEACH_Z + w]);
  for (let x = -150; x < 150; x += 8) marks.push([x, BEACH_Z - 0.15, x + 4, BEACH_Z + 0.15]);
  const roadMat = pbrMaterial('asphalt', 1 / 6, {});
  const road = new THREE.Mesh(quadGeo(rects, 0.03, 1), roadMat);
  roadMat.map.repeat.set(1 / 6, 1 / 6); roadMat.normalMap.repeat.set(1 / 6, 1 / 6); roadMat.roughnessMap.repeat.set(1 / 6, 1 / 6);
  road.receiveShadow = true; island.add(road);
  const markMat = new THREE.MeshStandardMaterial({ color: 0xf0e6c8, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 });
  const mk = new THREE.Mesh(quadGeo(marks, 0.035, 1), markMat); mk.receiveShadow = true; island.add(mk);
  // 斑马线
  const zebra = [];
  for (const x of XR) for (const z of ZR) for (let k = -5; k <= 5; k += 2) {
    zebra.push([x + k - 0.5, z - w - 3.5, x + k + 0.5, z - w - 0.5]);
    zebra.push([x + k - 0.5, z + w + 0.5, x + k + 0.5, z + w + 3.5]);
  }
  island.add(new THREE.Mesh(quadGeo(zebra, 0.034, 1), markMat));
}

/**
 * 判断一个点是否落在马路上（含海滩前那条横向大道）。
 * @param {import('./island.js').Island} island 岛实例
 * @param {number} x x 坐标
 * @param {number} z z 坐标
 * @param {number} [pad=0] 额外外扩的宽度
 * @returns {boolean} 在路上返回 true
 */
export function inRoad(island, x, z, pad = 0) {
  const w = ROAD_W / 2 + pad;
  return XR.some((rx) => Math.abs(x - rx) < w) || ZR.some((rz) => Math.abs(z - rz) < w) || Math.abs(z - BEACH_Z) < w;
}
