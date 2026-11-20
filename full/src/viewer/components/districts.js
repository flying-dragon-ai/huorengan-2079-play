// 街区组件：每个街区一个函数，返回 { group, update }，可单独修改
import * as THREE from 'three';
import { V3, mat, basic, emissive, box, cyl, sphere, plane, torus, signTex, brickTex, facadeTex, instance, rng } from '../kit.js';

function districtGround(w, d, color) {
  const t = brickTex({ base: color, mortar: '#2a2a30' });
  t.repeat.set(w / 4, d / 4);
  const g = plane(w, d, new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 }), 0, 0.03, 0);
  g.rotation.x = -Math.PI / 2; g.receiveShadow = true;
  return g;
}

function nameSign(text, w, x, y, z, bg = '#12222c', fg = '#ffe9a8') {
  return plane(w, w * 0.28, new THREE.MeshBasicMaterial({ map: signTex(text.split('|'), { bg, fg }), side: THREE.DoubleSide }), x, y, z);
}

// 东京便利店街：霓虹 + 雨 + 高架电车
/**
 * 东京便利店街：霓虹招牌、高架电车与雨线。
 * @returns {{ group: THREE.Group, update?: (dt: number, t: number) => void }} group 可直接 add 到场景，update 驱动电车位移、雨滴下落与霓虹闪烁
 */
export function buildTokyo() {
  const g = new THREE.Group(); g.name = '东京便利店街';
  g.add(districtGround(70, 60, '#1a1c24'));
  const shopM = new THREE.MeshStandardMaterial({ map: facadeTex('tokyo', 11), emissiveMap: facadeTex('tokyo', 11), emissive: 0xffffff, emissiveIntensity: 0.35 });
  const shops = [];
  for (let i = 0; i < 8; i++) shops.push({ x: -28 + i * 8, y: 8 + (i % 3) * 4, z: -24, sx: 7, sy: 16 + (i % 3) * 8, sz: 10 });
  for (let i = 0; i < 8; i++) shops.push({ x: -28 + i * 8, y: 7 + (i % 2) * 3, z: 24, sx: 7, sy: 14 + (i % 2) * 6, sz: 10 });
  g.add(instance(new THREE.BoxGeometry(1, 1, 1), shopM, shops));

  const neonCols = [0xff3fb4, 0x3ff0ff, 0xffe03f, 0xa46bff, 0xff5a3f, 0x3fff9a];
  const words = ['便利店', '什么都卖', '亲戚¥199', '后悔药售罄', '夜宵', '咖啡一杯八十'];
  const neons = [];
  for (let i = 0; i < 10; i++) {
    const c = neonCols[i % neonCols.length];
    const m = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.8 });
    const sign = box(1.4, 5.5, 0.3, m, -28 + i * 6.5, 9 + (i % 3) * 2, -18.6);
    g.add(sign); neons.push(m);
    const t = plane(3, 1.2, new THREE.MeshBasicMaterial({ map: signTex([words[i % words.length]], { bg: '#120814', fg: '#' + c.toString(16).padStart(6, '0') }), side: THREE.DoubleSide }), -28 + i * 6.5, 5.4, -18.4);
    g.add(t);
  }

  // 高架电车
  const rail = mat(0x3a4048, { metalness: 0.6 });
  g.add(box(74, 0.8, 3.4, rail, 0, 9, -12));
  for (let i = 0; i < 5; i++) g.add(box(1.2, 9, 1.2, rail, -30 + i * 15, 0, -12));
  const train = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const car = box(6, 2.4, 2.6, mat(0xdfe6ee, { metalness: 0.4, roughness: 0.3 }), i * 6.6 - 6.6, 9.8, -12);
    train.add(car);
    train.add(box(5.4, 1.0, 0.1, emissive(0x8fd8ff, 0.6), i * 6.6 - 6.6, 10.6, -13.36));
  }
  train.name = '电车'; g.add(train);

  // 雨
  const N = 800, pos = new Float32Array(N * 6);
  const seed = Array.from({ length: N }, () => [(Math.random() - 0.5) * 70, Math.random() * 30, (Math.random() - 0.5) * 60]);
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0x9fc8ff, transparent: true, opacity: 0.3, depthWrite: false }));
  rain.frustumCulled = false; g.add(rain);

  g.add(nameSign('东京便利店街|雨夜 · 樱花 · 末班车', 14, 0, 13, 26, '#1a0a1a', '#ff9fd0'));

  return {
    group: g,
    update(dt, t) {
      train.position.x = ((t * 8) % 120) - 60;
      const p = rain.geometry.attributes.position;
      for (let i = 0; i < N; i++) {
        const s = seed[i], y = 30 - ((s[1] + t * 24) % 30);
        p.setXYZ(i * 2, s[0], y, s[2]); p.setXYZ(i * 2 + 1, s[0] + 0.06, y + 0.7, s[2]);
      }
      p.needsUpdate = true;
      neons.forEach((m, i) => { m.emissiveIntensity = 1.6 + Math.sin(t * 3 + i) * 0.3; });
    },
  };
}

// 魔都弄堂：梧桐 + 石库门 + 咖啡店
/**
 * 魔都弄堂：石库门坡屋顶、梧桐、咖啡招牌与明珠塔。
 * @returns {{ group: THREE.Group, update?: (dt: number, t: number) => void }} group 可直接 add 到场景，update 驱动明珠塔球体呼吸发光
 */
export function buildShanghai() {
  const g = new THREE.Group(); g.name = '魔都弄堂';
  g.add(districtGround(70, 60, '#b9a48a'));
  const wallM = new THREE.MeshStandardMaterial({ map: facadeTex('brick', 21), roughness: 0.9 });
  const rows = [];
  for (let i = 0; i < 7; i++) rows.push({ x: -27 + i * 9, y: 4, z: -22, sx: 8, sy: 8, sz: 10 });
  for (let i = 0; i < 7; i++) rows.push({ x: -27 + i * 9, y: 4, z: 22, sx: 8, sy: 8, sz: 10 });
  g.add(instance(new THREE.BoxGeometry(1, 1, 1), wallM, rows));

  // 石库门坡屋顶
  const roofM = mat(0x2b2a2c, { roughness: 0.8 });
  for (const r of rows) {
    const roof = new THREE.Mesh(new THREE.ConeGeometry(6.2, 2.4, 4), roofM);
    roof.rotation.y = Math.PI / 4; roof.position.set(r.x, r.y * 2 + 1.2, r.z);
    roof.castShadow = true; g.add(roof);
  }

  // 咖啡招牌
  const cafes = ['咖啡·平价 ¥18', '一杯八十 ¥80', '手冲有故事 ¥128', '加油咖啡 ¥800'];
  cafes.forEach((t, i) => {
    g.add(nameSign(t, 7, -24 + i * 16, 4.5, -16.6, '#2a1a10', '#ffe9a8'));
  });

  // 梧桐（实例化）
  const trunkG = new THREE.CylinderGeometry(0.3, 0.42, 6, 8); trunkG.translate(0, 3, 0);
  const leafG = new THREE.IcosahedronGeometry(2.4, 1);
  const trunks = [], leaves = [];
  for (let i = 0; i < 6; i++) for (const sz of [-1, 1]) {
    const x = -28 + i * 11, z = sz * 12;
    trunks.push({ x, y: 0, z, s: 1 });
    for (let k = 0; k < 3; k++) leaves.push({ x: x + (Math.random() - 0.5) * 4, y: 6.4 + Math.random(), z: z + (Math.random() - 0.5) * 3, s: 0.9 + Math.random() * 0.4 });
  }
  g.add(instance(trunkG, mat(0x8f8a6c, { roughness: 0.9 }), trunks));
  g.add(instance(leafG, mat(0x8fa050, { flatShading: true }), leaves));

  // 明珠塔
  const steel = mat(0xd9d4e6, { metalness: 0.7, roughness: 0.25 });
  const pink = mat(0xff5fa8, { metalness: 0.6, roughness: 0.2, emissive: 0xff2f8a, emissiveIntensity: 0.3 });
  const tower = new THREE.Group();
  tower.add(cyl(1.2, 1.6, 60, steel, 0, 0, 0));
  tower.add(sphere(6, pink, 0, 22, 0, 24));
  tower.add(sphere(4, pink, 0, 44, 0, 24));
  tower.add(cyl(0.15, 0.6, 16, steel, 0, 60, 0));
  tower.position.set(0, 0, 0); tower.name = '明珠塔'; g.add(tower);

  g.add(nameSign('魔都弄堂|梧桐 · 石库门 · 一杯八百', 13, 0, 10.5, 26, '#30184a', '#ff9fd0'));
  return { group: g, update(dt, t) { pink.emissiveIntensity = 0.25 + Math.sin(t * 2) * 0.08; } };
}

// 热带海滩：棕榈 + 海 + 摩天轮 + 黄昏
/**
 * 热带海滩：棕榈、海面、摩天轮与黄昏沙地。
 * @returns {{ group: THREE.Group, update?: (dt: number, t: number) => void }} group 可直接 add 到场景，update 驱动摩天轮旋转
 */
export function buildBeach() {
  const g = new THREE.Group(); g.name = '热带海滩';
  const sandT = brickTex({ base: '#e0c88f', mortar: '#c9b075' }); sandT.repeat.set(14, 12);
  const sand = plane(90, 70, new THREE.MeshStandardMaterial({ map: sandT, roughness: 0.9 }), 0, 0.02, 0);
  sand.rotation.x = -Math.PI / 2; sand.receiveShadow = true; g.add(sand);

  const sea = plane(90, 30, new THREE.MeshStandardMaterial({ color: 0x1a6a8a, roughness: 0.1, metalness: 0.4, emissive: 0x0a3a50, emissiveIntensity: 0.3 }), 0, -0.3, 48);
  sea.rotation.x = -Math.PI / 2; g.add(sea);

  // 棕榈
  const trunkG = new THREE.CylinderGeometry(0.22, 0.35, 7, 8); trunkG.translate(0, 3.5, 0);
  const frondG = new THREE.ConeGeometry(3.4, 0.6, 6); frondG.translate(0, 7.2, 0);
  const trunks = [], fronds = [];
  for (let i = 0; i < 9; i++) {
    const x = -36 + i * 9, z = 6 + (i % 2) * 6;
    trunks.push({ x, y: 0, z, rz: (i % 3 - 1) * 0.06 });
    fronds.push({ x, y: 0, z, s: 1 });
  }
  g.add(instance(trunkG, mat(0x8a6a4a, { roughness: 0.9 }), trunks));
  g.add(instance(frondG, mat(0x4a8a3a, { flatShading: true }), fronds));

  // 摩天轮
  const wheel = new THREE.Group();
  const rim = torus(9, 0.25, mat(0xffe0a0, { metalness: 0.6, emissive: 0xffc35a, emissiveIntensity: 0.3 }), 0, 0, 0, false);
  wheel.add(rim);
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2;
    const cab = box(1.4, 1.4, 1.4, mat([0xff6b6b, 0x6bc4ff, 0xffd84a, 0xb58aff, 0x8dffb0][i % 5]), Math.cos(a) * 9 - 0.7, Math.sin(a) * 9 - 0.7, 0);
    wheel.add(cab);
    const spoke = cyl(0.05, 0.05, 9, mat(0xcccccc), 0, 0, 0);
    spoke.rotation.z = a + Math.PI / 2; spoke.position.set(Math.cos(a) * 4.5, Math.sin(a) * 4.5, 0);
    wheel.add(spoke);
  }
  wheel.position.set(24, 12, 20); wheel.name = '摩天轮'; g.add(wheel);
  g.add(box(1, 12, 1, mat(0x888888), 24, 0, 20));

  g.add(nameSign('热带海滩|黄金时刻 · 海是贴图', 12, -20, 5, 26, '#3a2a10', '#ffd88a'));
  return { group: g, update(dt, t) { wheel.rotation.z = t * 0.15; } };
}

// 巴黎：铁塔 + 面包店 + 绣球花
/**
 * 巴黎：埃菲尔铁塔、面包店、喷泉与绣球花。
 * @returns {{ group: THREE.Group, update?: (dt: number, t: number) => void }} group 可直接 add 到场景（本组件无动画，update 缺省）
 */
export function buildParis() {
  const g = new THREE.Group(); g.name = '巴黎';
  g.add(districtGround(60, 60, '#c9b8a8'));
  const iron = mat(0x806a58, { metalness: 0.6, roughness: 0.5 });
  const tower = new THREE.Group();
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    tower.add(beam(V3(sx * 7, 0.5, sz * 7), V3(sx * 3, 12, sz * 3), 0.6, iron));
    tower.add(beam(V3(sx * 3, 12, sz * 3), V3(sx * 1.5, 24, sz * 1.5), 0.45, iron));
    tower.add(beam(V3(sx * 1.5, 24, sz * 1.5), V3(0, 36, 0), 0.3, iron));
  }
  for (const [y, w] of [[11, 11], [23, 6.5], [35, 2]]) tower.add(box(w, 0.6, w, iron, 0, y, 0));
  tower.add(cyl(0.08, 0.3, 6, iron, 0, 36, 0));
  tower.name = '埃菲尔铁塔'; tower.position.set(-8, 0, -6); g.add(tower);

  // 面包店
  const shopM = new THREE.MeshStandardMaterial({ map: facadeTex('glass', 31), roughness: 0.6 });
  g.add(box(12, 6, 8, shopM, 16, 0, -18));
  g.add(nameSign('巴黎面包房|法棍 · 可颂 · 合法防身', 11, 16, 5, -13.9, '#71354b', '#ffbd72'));
  g.add(box(12.4, 0.2, 1.6, mat(0xffa9c5), 16, 4.4, -13.6));

  // 喷泉
  g.add(cyl(3, 3.4, 0.6, mat(0xd8c8bd), 14, 0, 14));
  g.add(cyl(2.8, 2.8, 0.1, mat(0x65c8de, { roughness: 0.2 }), 14, 0.6, 14));

  // 绣球花
  const fl = [];
  for (let i = 0; i < 40; i++) fl.push({ x: -26 + Math.random() * 6, y: 0.7, z: -20 + Math.random() * 40, s: 0.3 + Math.random() * 0.2 });
  g.add(instance(new THREE.IcosahedronGeometry(1, 1), mat(0xa997ff, { flatShading: true }), fl));

  g.add(nameSign('巴黎|铁塔 · 法棍决斗场', 11, 0, 8, 26, '#48372f', '#ffbd72'));
  return { group: g };
}

function beam(a, b, w, m) {
  const d = b.clone().sub(a);
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, d.length(), w), m);
  o.position.copy(a).add(b).multiplyScalar(0.5);
  o.quaternion.setFromUnitVectors(V3(0, 1, 0), d.normalize());
  o.castShadow = true;
  return o;
}
