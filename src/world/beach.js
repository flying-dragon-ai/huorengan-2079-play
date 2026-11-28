// 海滩层：棕榈、遮阳伞、码头、救生塔、七大姑的沙滩椅。
import * as THREE from 'three';
import { standee } from '../actors/models.js';
import { BEACH_Z } from '../core/config.js';
import { shoreEdge, groundH } from './terrain.js';

/**
 * 建海滩：环岛撒棕榈、沙滩上一排遮阳伞和浴巾、伸进海里的木码头、红色救生塔、七大姑的沙滩椅。
 * @param {import('./island.js').Island} island 岛实例
 * @returns {void}
 */
export function buildBeach(island) {
  const pts = [];
  for (let i = 0; i < 70; i++) {
    const a = island.r() * Math.PI * 2, e = shoreEdge(a);
    const rr = 180 + island.r() * (e - 230);
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    if (Math.max(Math.abs(x), Math.abs(z)) < 176 || island.inRoad(x, z, 3)) continue;
    // 冰岛温泉雪原（北侧 x∈[-55,55], z<-148）绝不种热带棕榈
    if (x > -55 && x < 55 && z < -148) continue;
    pts.push([x, z]);
  }
  for (let x = -140; x <= 140; x += 18) pts.push([x + island.r() * 4, BEACH_Z + 12 + island.r() * 4]);
  island.palms(pts);
  // 遮阳伞
  const cols = [0xff5a5a, 0xffd23f, 0x3fb8ff, 0xff7ad9, 0xffffff];
  for (let i = 0; i < 22; i++) {
    const x = -130 + i * 12 + island.r() * 4, z = 232 + island.r() * 22;
    const gh = groundH(x, z); if (gh < -0.4) continue;
    const u = new THREE.Mesh(new THREE.ConeGeometry(1.8, 0.7, 12, 1, true), new THREE.MeshStandardMaterial({ color: cols[i % 5], roughness: 0.6, side: THREE.DoubleSide }));
    u.position.set(x, gh + 2.4, z); u.castShadow = true; island.add(u);
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.4), new THREE.MeshStandardMaterial({ color: 0xeeeeee }));
    p.position.set(x, gh + 1.2, z); island.add(p);
    const towel = new THREE.Mesh(new THREE.PlaneGeometry(1, 2), new THREE.MeshStandardMaterial({ color: cols[(i + 2) % 5], roughness: 0.9 }));
    towel.rotation.x = -Math.PI / 2; towel.rotation.z = island.r(); towel.position.set(x + 1.2, gh + 0.03, z + 0.5); island.add(towel);
  }
  // 码头
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.85 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(6, 0.4, 110), wood);
  deck.position.set(0, 1.0, 305); deck.castShadow = deck.receiveShadow = true; island.add(deck);
  for (let z = 252; z < 360; z += 6) for (const x of [-2.7, 2.7]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 6), wood); post.position.set(x, -1.6, z); island.add(post);
  }
  island.pierTop = 1.2;
  // 救生塔
  const tower = new THREE.Group();
  const tw = new THREE.MeshStandardMaterial({ color: 0xff4040, roughness: 0.5 });
  const cab = new THREE.Mesh(new THREE.BoxGeometry(3, 2.2, 3), tw); cab.position.y = 4.2; tower.add(cab);
  const rf = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.2, 4), new THREE.MeshStandardMaterial({ color: 0xffffff })); rf.position.y = 5.9; rf.rotation.y = Math.PI / 4; tower.add(rf);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3.2), wood); l.position.set(sx * 1.2, 1.6, sz * 1.2); tower.add(l); }
  tower.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  tower.position.set(-60, groundH(-60, 236), 236); island.add(tower);
  island.col.add(-61.5, -58.5, 234.5, 237.5, 6);
  // 七大姑的沙滩椅
  island.auntSpot = new THREE.Vector3(90, groundH(90, 236), 236);
  const aunt = standee({ name: '七大姑', color: '#ff9f6b', face: 'grin' });
  aunt.position.copy(island.auntSpot); aunt.rotation.y = Math.PI; island.add(aunt); island.aunt = aunt;
  const um = new THREE.Mesh(new THREE.ConeGeometry(2.4, 0.9, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0xff3fb4, roughness: 0.5, side: THREE.DoubleSide }));
  um.position.set(91.5, island.auntSpot.y + 3, 237); um.castShadow = true; island.add(um);
}
