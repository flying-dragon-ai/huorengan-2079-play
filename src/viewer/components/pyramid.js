// 金字塔工地组件：金字塔 + 塔吊 + 脚手架 + 骆驼
import * as THREE from 'three';
import { V3, mat, box, cyl, sphere, plane, torus, signTex, brickTex, instance } from '../kit.js';

/**
 * 金字塔工地：分层收分金字塔、塔吊、脚手架、快递柜与骆驼。
 * @returns {{ group: THREE.Group, update?: (dt: number, t: number) => void }} group 可直接 add 到场景，update 驱动塔吊吊索摆动
 */
export function buildPyramid() {
  const g = new THREE.Group(); g.name = '金字塔工地';
  const sandT = brickTex({ base: '#cfa965', mortar: '#a8894f' }); sandT.repeat.set(12, 12);
  const sand = plane(70, 60, new THREE.MeshStandardMaterial({ map: sandT, roughness: 0.9 }), 0, 0.02, 0);
  sand.rotation.x = -Math.PI / 2; sand.receiveShadow = true; g.add(sand);

  // 金字塔（分层收分）
  const stone = mat(0xcfa965, { roughness: 0.92 });
  const pyramid = new THREE.Group(); pyramid.name = '金字塔';
  for (let k = 0; k < 8; k++) {
    const w = 34 - k * 4.1;
    pyramid.add(box(w, 2.6, w, stone, 0, k * 2.6, 0));
  }
  const cap = new THREE.Mesh(new THREE.ConeGeometry(3, 4.4, 4), mat(0xffd57c, { metalness: 0.35 }));
  cap.rotation.y = Math.PI / 4; cap.position.y = 22.6; pyramid.add(cap);
  pyramid.position.set(-6, 0, -6); g.add(pyramid);

  // 塔吊
  const yellow = mat(0xe9ad23, { metalness: 0.4 }), dark = mat(0x3a332a);
  const crane = new THREE.Group(); crane.name = '塔吊';
  crane.add(box(2, 26, 2, yellow, 0, 0, 0));
  crane.add(box(30, 1.1, 1.2, yellow, 8, 26, 0));
  crane.add(box(6, 2.6, 2.6, dark, -5, 24, 0));
  const cable = cyl(0.03, 0.03, 9, dark, 18, 17, 0);
  crane.add(cable);
  crane.position.set(-24, 0, 16); g.add(crane);

  // 脚手架
  const metal = mat(0x6a7476, { metalness: 0.6 });
  for (const x of [-20, -14]) for (const z of [-8, -2]) g.add(cyl(0.1, 0.1, 10, metal, x, 0, z));
  for (let y = 3; y < 10; y += 3) g.add(box(7, 0.15, 7, mat(0x806044), -17, y, -5));

  // 快递柜
  g.add(box(5, 3.6, 1.1, mat(0xe58e24), 20, 0, -22));
  for (let i = 0; i < 5; i++) g.add(box(0.75, 0.6, 0.05, mat(0xffcf62), 18.2 + i * 0.94, 2.2, -21.4));
  const locker = plane(5, 1.4, new THREE.MeshBasicMaterial({ map: signTex(['金字塔驿站', '法老件 · 三千年不取也不退'], { bg: '#123a44', fg: '#ffe183' }), side: THREE.DoubleSide }), 20, 3.2, -21.35);
  g.add(locker);

  // 骆驼（代码建模）
  const camel = new THREE.Group(); camel.name = '骆驼';
  const fur = mat(0xc5995e, { roughness: 0.8 });
  const body = sphere(1.1, fur, 0, 1.6, 0); body.scale.set(0.85, 0.85, 1.5); camel.add(body);
  camel.add(sphere(0.55, fur, 0, 2.5, -0.2));
  const neck = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 1.4, 4, 8), fur);
  neck.position.set(0, 2.4, 1.1); neck.rotation.x = -0.4; camel.add(neck);
  camel.add(box(0.55, 0.5, 0.9, fur, 0, 3.2, 1.5));
  for (const sx of [-0.5, 0.5]) for (const sz of [-0.8, 0.8]) camel.add(cyl(0.12, 0.15, 1.4, fur, sx, 0, sz));
  const hat = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xffd42a));
  hat.position.set(0, 3.75, 1.5); camel.add(hat);
  camel.position.set(16, 0, 14); g.add(camel);

  const sign = plane(10, 2.8, new THREE.MeshBasicMaterial({ map: signTex(['金字塔工地', '千年工程 · 当日达 · 骆驼专用车位'], { bg: '#664521', fg: '#ffe4a0' }), side: THREE.DoubleSide }), 0, 6, 24);
  g.add(sign);

  return { group: g, update(dt, t) { cable.position.x = 18 + Math.sin(t * 0.4) * 4; } };
}
