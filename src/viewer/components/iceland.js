// 冰岛温泉组件：极光 + 冰屋 + 温泉 + 企鹅
import * as THREE from 'three';
import { V3, mat, basic, box, cyl, sphere, plane, torus, signTex, instance } from '../kit.js';

/**
 * 冰岛温泉：极光带、冰屋、温泉池、蒸汽粒子与企鹅队列。
 * @returns {{ group: THREE.Group, update?: (dt: number, t: number) => void }} group 可直接 add 到场景，update 驱动极光波形、蒸汽上升与企鹅摆动
 */
export function buildIceland() {
  const g = new THREE.Group(); g.name = '冰岛温泉';
  const snow = plane(80, 60, new THREE.MeshStandardMaterial({ color: 0x6f8ea0, roughness: 0.95 }), 0, 0.02, 0);
  snow.rotation.x = -Math.PI / 2; snow.receiveShadow = true; g.add(snow);

  // 冰屋
  const ice = mat(0xc5f0f5, { roughness: 0.5, flatShading: true });
  for (const [x, z, s] of [[-18, -12, 1.2], [6, -18, 0.9], [-26, 10, 0.8]]) {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(4 * s, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), ice);
    dome.position.set(x, 0, z); dome.castShadow = true; g.add(dome);
    g.add(box(2.4 * s, 2.4 * s, 2.4 * s, ice, x, 0, z + 3.4 * s));
    g.add(plane(1.5 * s, 1.9 * s, mat(0x17394b), x, 1.0 * s, z + 4.62 * s));
  }

  // 温泉池
  const water = new THREE.Mesh(new THREE.CircleGeometry(7, 48),
    new THREE.MeshStandardMaterial({ color: 0x56dce8, emissive: 0x248da5, emissiveIntensity: 0.5, roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.9 }));
  water.rotation.x = -Math.PI / 2; water.position.set(14, 0.2, 6); g.add(water);
  g.add(torus(7.4, 0.5, mat(0x66838a, { roughness: 0.9, flatShading: true }), 14, 0.2, 6));

  // 蒸汽粒子
  const N = 60, pos = new Float32Array(N * 3), seed = [];
  for (let i = 0; i < N; i++) seed.push([Math.random() * Math.PI * 2, Math.sqrt(Math.random()) * 6, Math.random() * 6]);
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mist = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xe5ffff, size: 0.8, transparent: true, opacity: 0.2, depthWrite: false }));
  mist.position.set(14, 0, 6); g.add(mist);

  // 企鹅（代码建模）
  const penguins = new THREE.Group(); penguins.name = '企鹅队列';
  for (let i = 0; i < 6; i++) {
    const p = new THREE.Group();
    const black = mat(0x172532, { roughness: 0.7 }), white = mat(0xf2f7f4), orange = mat(0xffa23c);
    p.add(sphere(0.55, black, 0, 0.85, 0));
    const belly = sphere(0.4, white, 0, 0.8, 0.35); belly.scale.set(0.85, 1.2, 0.4); p.add(belly);
    p.add(sphere(0.4, black, 0, 1.55, 0));
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.4, 6), orange);
    beak.rotation.x = Math.PI / 2; beak.position.set(0, 1.52, 0.55); p.add(beak);
    for (const s of [-1, 1]) {
      p.add(sphere(0.05, white, s * 0.15, 1.68, 0.3));
      const foot = sphere(0.18, orange, s * 0.24, 0.1, 0.15); foot.scale.set(1, 0.3, 1.5); p.add(foot);
    }
    p.position.set(-28 + (i % 2) * 0.2, 0, -4 + i * 2.4);
    p.rotation.y = Math.PI;
    penguins.add(p);
  }
  g.add(penguins);

  // 极光（动态带状网格）
  const auroras = [];
  for (let k = 0; k < 3; k++) {
    const n = 48, pos = new Float32Array((n + 1) * 2 * 3), col = new Float32Array(pos.length), idx = [];
    for (let i = 0; i <= n; i++) {
      const c = new THREE.Color().setHSL(0.4 + k * 0.1 + i / n * 0.08, 0.9, 0.6);
      for (let j = 0; j < 2; j++) { const q = (i * 2 + j) * 3; col[q] = c.r; col[q + 1] = c.g; col[q + 2] = c.b; }
      if (i < n) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.3, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    mesh.frustumCulled = false; g.add(mesh); auroras.push({ mesh, n, k });
  }

  const sign = plane(11, 3, new THREE.MeshBasicMaterial({ map: signTex(['冰岛温泉', '极光免费 · 企鹅迟到扣200条鱼'], { bg: '#143b4b', fg: '#aef8ff' }), side: THREE.DoubleSide }), 0, 4, 22);
  g.add(sign);

  return {
    group: g,
    update(dt, t) {
      for (const a of auroras) {
        const p = a.mesh.geometry.attributes.position;
        for (let i = 0; i <= a.n; i++) {
          const u = i / a.n, x = -40 + u * 80;
          const wave = Math.sin(u * 10 + t * 0.4 + a.k * 1.7);
          const z = -26 + a.k * 6 + Math.sin(u * 7 + t * 0.2 + a.k) * 4;
          const y = 20 + a.k * 4 + Math.sin(u * 8 + t * 0.35) * 2;
          p.setXYZ(i * 2, x, y + wave * 2.2, z);
          p.setXYZ(i * 2 + 1, x, y + 7 + wave * 4, z + 1.5);
        }
        p.needsUpdate = true;
        a.mesh.material.opacity = 0.26 + Math.sin(t * 0.5 + a.k) * 0.06;
      }
      const p = mist.geometry.attributes.position;
      seed.forEach((s, i) => {
        const yy = (t * 0.5 + s[2]) % 6;
        p.setXYZ(i, Math.cos(s[0]) * s[1], 0.4 + yy, Math.sin(s[0]) * s[1]);
      });
      p.needsUpdate = true;
      penguins.children.forEach((p, i) => { p.rotation.z = Math.sin(t * 2.4 + i) * 0.06; });
    },
  };
}
