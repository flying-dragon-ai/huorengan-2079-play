// 老家县城组件：县一中 + 菜市场 + 公交站 + 思乡亭
import * as THREE from 'three';
import { V3, mat, box, cyl, sphere, plane, torus, signTex, brickTex, instance } from '../kit.js';

/**
 * 老家县城：县一中、菜市场、公交站与思乡亭。
 * @returns {{ group: THREE.Group, update?: (dt: number, t: number) => void }} group 可直接 add 到场景（本组件无动画，update 缺省）
 */
export function buildHometown() {
  const g = new THREE.Group(); g.name = '老家县城';
  const floorT = brickTex({ base: '#b0a894', mortar: '#8a8272' }); floorT.repeat.set(12, 12);
  const floor = plane(70, 60, new THREE.MeshStandardMaterial({ map: floorT, roughness: 0.85 }), 0, 0.02, 0);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; g.add(floor);

  // 县一中
  const wall = mat(0xf0d7ac), red = mat(0xa52f26);
  const school = new THREE.Group(); school.name = '县一中';
  school.add(box(18, 11, 12, wall, 0, 0, 0));
  school.add(box(18.4, 0.5, 12.4, red, 0, 11, 0));
  const winM = mat(0x40677c, { emissive: 0x233947, emissiveIntensity: 0.4 });
  const wins = [];
  for (let yy = 2.5; yy < 10; yy += 2.6) for (let xx = -7; xx <= 7; xx += 3.4) wins.push({ x: xx, y: yy, z: 6.06, sx: 1.4, sy: 1.5, sz: 0.08 });
  school.add(instance(new THREE.BoxGeometry(1, 1, 1), winM, wins));
  school.position.set(-14, 0, -14); g.add(school);

  // 校门
  for (const x of [-22, -6]) g.add(box(1, 6, 1, red, x, 0, -2));
  g.add(box(17, 1, 1.2, red, -14, 6, -2));
  const gate = plane(12, 2, new THREE.MeshBasicMaterial({ map: signTex(['县第一中学', '今日早读：落霞与孤鹜齐飞'], { bg: '#a52f26', fg: '#fff2bf' }), side: THREE.DoubleSide }), -14, 4.4, -2.65);
  g.add(gate);

  // 菜市场
  const market = new THREE.Group(); market.name = '菜市场';
  market.add(box(24, 0.25, 12, mat(0x3b7561), 0, 4.4, 0));
  for (const x of [-11, 11]) for (const z of [-5, 5]) market.add(cyl(0.12, 0.12, 4.4, mat(0x68726d), x, 0, z));
  for (let i = 0; i < 4; i++) {
    market.add(box(4.4, 1.1, 2, mat(0xa87340), -9 + i * 6, 0, -3));
    const fruits = [];
    for (let k = 0; k < 8; k++) fruits.push({ x: -9 + i * 6 + (k % 4 - 1.5) * 0.7, y: 1.35, z: -3 + Math.floor(k / 4) * 0.7, s: 0.24 });
    market.add(instance(new THREE.SphereGeometry(1, 8, 6), mat([0xe83e32, 0x6cb342, 0xf4c442, 0xff8a50][i]), fruits));
  }
  market.position.set(18, 0, 10); g.add(market);
  const mkt = plane(9, 1.6, new THREE.MeshBasicMaterial({ map: signTex(['菜市场 · 辣椒专区', '辣椒是蔬菜 / 水果 / 硬通货'], { bg: '#c83228', fg: '#fff0a0' }), side: THREE.DoubleSide }), 18, 3.4, 3.6);
  g.add(mkt);

  // 公交站
  g.add(box(8, 0.2, 2.6, mat(0x4d7b84), -24, 3.4, 16));
  for (const x of [-27, -21]) g.add(cyl(0.08, 0.08, 3.4, mat(0x515c64), x, 0, 16));
  const busStop = plane(4.6, 1.4, new THREE.MeshBasicMaterial({ map: signTex(['县城 1 路 · 环线', '刚走一辆 · 下辆待定'], { bg: '#164858', fg: '#d4fbff' }), side: THREE.DoubleSide }), -24, 2.4, 14.6);
  g.add(busStop);

  // 思乡亭（小山上）
  for (let i = 0; i < 3; i++) g.add(cyl(6 - i * 1.5, 7 - i * 1.4, 1.8, mat(0x6f8950), 24, i * 1.8, -20));
  for (const x of [22, 26]) for (const z of [-22, -18]) g.add(cyl(0.15, 0.15, 3.4, red, x, 5.4, z));
  const roof = new THREE.Mesh(new THREE.ConeGeometry(5, 2.4, 4), mat(0x39433c));
  roof.rotation.y = Math.PI / 4; roof.position.set(24, 9.6, -20); g.add(roof);

  const sign = plane(10, 2.6, new THREE.MeshBasicMaterial({ map: signTex(['老家县城', '拌粉瓦罐汤 · 班主任在后座'], { bg: '#5e241b', fg: '#ffe8a5' }), side: THREE.DoubleSide }), 0, 5, 24);
  g.add(sign);

  return { group: g };
}
