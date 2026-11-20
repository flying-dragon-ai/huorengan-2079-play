// 中央广场组件：喷泉地球仪、环形步道、周边建筑
import * as THREE from 'three';
import { V3, mat, basic, emissive, box, cyl, sphere, plane, torus, signTex, brickTex, facadeTex, instance } from '../kit.js';

/**
 * 中央广场：喷泉地球仪、环形步道、周边实例化商铺与招牌。
 * @returns {{ group: THREE.Group, update?: (dt: number, t: number) => void }} group 可直接 add 到场景，update 驱动地球仪/金环旋转与喷泉粒子
 */
export function buildPlaza() {
  const g = new THREE.Group(); g.name = '中央广场';
  const marble = new THREE.MeshStandardMaterial({ map: brickTex({ base: '#cfc2ac', mortar: '#a99b86' }), roughness: 0.5 });
  marble.map.repeat.set(8, 8);
  const floor = plane(84, 84, marble, 0, 0.02, 0); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; g.add(floor);

  // 喷泉池
  const stone = mat(0xd8cbb6, { roughness: 0.5 });
  const rim = torus(15, 0.7, stone, 0, 0.4, 0); g.add(rim);
  const water = new THREE.Mesh(new THREE.CircleGeometry(15, 48),
    new THREE.MeshStandardMaterial({ color: 0x1b5868, roughness: 0.08, metalness: 0.4, emissive: 0x0a3a50, emissiveIntensity: 0.4 }));
  water.rotation.x = -Math.PI / 2; water.position.y = 0.35; g.add(water);

  // 地球仪 + 金环
  const earthTex = makeEarthTex();
  const globe = sphere(5, new THREE.MeshStandardMaterial({ map: earthTex, emissive: 0xffffff, emissiveMap: earthTex, emissiveIntensity: 0.8, roughness: 0.35 }), 0, 10, 0, 32);
  globe.name = '地球仪'; g.add(globe);
  const gold = mat(0xffc35a, { metalness: 0.9, roughness: 0.25, emissive: 0x6a3a00, emissiveIntensity: 0.3 });
  const ring1 = torus(6.4, 0.12, gold, 0, 10, 0, false); ring1.rotation.x = 0.4; g.add(ring1);
  const ring2 = torus(6.8, 0.12, gold, 0, 10, 0, false); ring2.rotation.z = 0.9; g.add(ring2);
  const ped = cyl(3.4, 4, 4, stone, 0, 0.4, 0); g.add(ped);

  // 环形步道
  const walk = new THREE.Mesh(new THREE.RingGeometry(19, 24, 64),
    new THREE.MeshStandardMaterial({ color: 0xc9b696, roughness: 0.7, side: THREE.DoubleSide }));
  walk.rotation.x = -Math.PI / 2; walk.position.y = 0.05; g.add(walk);

  // 喷泉粒子
  const N = 300, pos = new Float32Array(N * 3), seed = [];
  for (let i = 0; i < N; i++) seed.push([Math.random() * Math.PI * 2, Math.random() * 14, Math.random() * 3]);
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const spray = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0x9fe6ff, size: 0.18, transparent: true, opacity: 0.75, depthWrite: false }));
  spray.name = '喷泉水柱'; g.add(spray);

  // 周边建筑（实例化）
  const shops = [];
  const shopGeo = new THREE.BoxGeometry(1, 1, 1);
  const shopMats = [facadeTex('glass', 3), facadeTex('glass', 8)].map(t => new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.25, roughness: 0.3 }));
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    if (Math.abs(Math.sin(a)) < 0.3) continue; // 留出入口
    const r = 36, h = 8 + (i % 4) * 5;
    shops.push({ x: Math.cos(a) * r, y: h / 2, z: Math.sin(a) * r, sx: 8, sy: h, sz: 8 });
  }
  g.add(instance(shopGeo, shopMats[0], shops.filter((_, i) => i % 2 === 0)));
  g.add(instance(shopGeo, shopMats[1], shops.filter((_, i) => i % 2 === 1)));

  // 招牌
  const sign = plane(9, 2.4, new THREE.MeshBasicMaterial({ map: signTex(['地球村 · 中央广场', 'EARTH VILLAGE'], { bg: '#10284a', fg: '#ffd88a' }), side: THREE.DoubleSide }), 0, 3.4, 4.2);
  g.add(sign);

  return {
    group: g,
    update(dt, t) {
      globe.rotation.y += dt * 0.1;
      ring1.rotation.z += dt * 0.2; ring2.rotation.y += dt * 0.15;
      const p = spray.geometry.attributes.position;
      for (let i = 0; i < N; i++) {
        const [a, r0, ph] = seed[i];
        const k = (t * 0.7 + ph) % 1;
        const r = 3 + k * 11;
        p.setXYZ(i, Math.cos(a) * r, 0.5 + Math.sin(k * Math.PI) * 4 - k * 0.4, Math.sin(a) * r);
      }
      p.needsUpdate = true;
    },
  };
}

function makeEarthTex() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const x = c.getContext('2d');
  const grad = x.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#1a4a8a'); grad.addColorStop(1, '#0a2a5a');
  x.fillStyle = grad; x.fillRect(0, 0, 512, 256);
  // 经纬线
  x.strokeStyle = 'rgba(120,200,255,0.25)'; x.lineWidth = 1;
  for (let i = 0; i < 12; i++) { x.beginPath(); x.moveTo(i * 42, 0); x.lineTo(i * 42, 256); x.stroke(); }
  for (let i = 0; i < 8; i++) { x.beginPath(); x.moveTo(0, i * 32); x.lineTo(512, i * 32); x.stroke(); }
  // 大陆色块（抽象）
  x.fillStyle = '#3aa060';
  const blobs = [[120, 90, 70, 45], [200, 150, 55, 40], [330, 80, 80, 50], [380, 160, 50, 35], [70, 170, 45, 30]];
  for (const [cx, cy, rx, ry] of blobs) {
    x.beginPath();
    for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.2) {
      const k = 1 + 0.25 * Math.sin(a * 5 + cx);
      const px = cx + Math.cos(a) * rx * k, py = cy + Math.sin(a) * ry * k;
      a === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
    }
    x.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
