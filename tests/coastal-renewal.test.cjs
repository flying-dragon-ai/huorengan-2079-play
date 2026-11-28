'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/coastal-renewal.js'), 'utf8');
const dependencies = Promise.all([
  import(pathToFileURL(path.join(root, 'huorengan-2079-play-main/full/vendor/three/three.module.js')).href),
  import('data:text/javascript;base64,' + Buffer.from(source).toString('base64')),
]);
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const edge = a => 320 + 14 * Math.sin(a * 3 + .5) + 8 * Math.sin(a * 7 + 1.3);
function groundH(x, z) {
  const td = Math.max(Math.abs(x), Math.abs(z)) - 168;
  if (td <= 0) return 0;
  const r = Math.hypot(x, z), a = Math.atan2(z, x);
  return (Math.sin(x * .043) * Math.cos(z * .037) + Math.sin(x * .011 + z * .019) + 1.4) * 1.3 *
    smooth(0, 30, td) * (1 - smooth(150, 200, z)) - smooth(edge(a) - 70, edge(a) + 20, r) * 7;
}
const H = (x, z) => groundH(x, z) - .02;
const deliveryRoutes = [
  [[-100, -104.5], [145, -104.5], [145, 205], [95, 205], [94, 231]],
  [[-100, -100], [50, -100], [50, 150], [50, 205], [95, 205], [94, 231]],
];
const required = ['Group', 'Object3D', 'Vector3', 'Color', 'BufferGeometry', 'Float32BufferAttribute',
  'BoxGeometry', 'CylinderGeometry', 'SphereGeometry', 'Mesh', 'MeshStandardMaterial', 'CanvasTexture'];
function createCanvas(width, height) {
  const ctx = new Proxy({}, { get: (o, k) => k in o ? o[k] : (() => {}), set: (o, k, v) => (o[k] = v, true) });
  return { width, height, getContext: () => ctx };
}
function distance(x, z, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
}
async function fixture(overrides = {}) {
  const [THREE, { buildCoastalRenewal }] = await dependencies;
  const sceneRoot = new THREE.Group();
  const boxes = [
    { x0: -61.5, x1: -58.5, z0: 234.5, z1: 237.5, top: 6 },
    { x0: -32.5, x1: -27.5, z0: 228.8, z1: 231.2, top: 1.2 },
    { x0: -111.5, x1: -108.5, z0: 242.5, z1: 245.5, top: 6 },
    { x0: 38.5, x1: 41.5, z0: 244.5, z1: 247.5, top: 6 },
  ];
  // Existing buildBeach palm trunks remain visible / collidable. A renewal must
  // find genuine gaps rather than pretending those legacy colliders vanished.
  for (let i = 0, x = -140; x <= 140; x += 18, i++) {
    const px = x + 1.8, pz = 222 + (i % 4) * .9;
    boxes.push({ x0: px - .4, x1: px + .4, z0: pz - .4, z1: pz + .4, top: 6 });
  }
  const props = [[-40, 236], [5, 233], [62, 236], [-88, 238], [100, 245], [-15, 238], [80, 250],
    [-31.6, 227.9], [-30, 227.9], [-28.4, 227.9]].map(([x, z]) => ({ home: new THREE.Vector3(x, groundH(x, z), z), radius: .5 }));
  const island = {
    root: sceneRoot, add(o) { this.root.add(o); return o; },
    col: { boxes, add() { throw new Error('Decorations must not add colliders'); } }, props,
    ramps: [{ x: 50, z: 203, ry: 0, L: 10, W: 6, H: 2.2 }],
    cafe: new THREE.Vector3(-100, 0, -100), auntSpot: new THREE.Vector3(94, groundH(94, 231), 231),
    districts: [{ id: 'beach', quest: { at: new THREE.Vector3(30, 0, 228) } }], pierTop: 1.2,
    r() { throw new Error('Gameplay RNG consumed'); },
    ...overrides,
  };
  const constructors = Object.fromEntries(required.map(k => [k, THREE[k]]));
  return { THREE, island, build: options => buildCoastalRenewal(island, constructors,
    { createCanvas, protectedRoutes: deliveryRoutes, ...options }) };
}
function physics(island) {
  return JSON.stringify({ col: island.col.boxes, props: island.props, ramps: island.ramps,
    auntSpot: island.auntSpot, districts: island.districts, pierTop: island.pierTop });
}
function geometryHash(group) {
  const hash = crypto.createHash('sha256');
  for (const mesh of group.children) {
    hash.update(mesh.name);
    for (const attr of Object.values(mesh.geometry.attributes)) hash.update(Buffer.from(attr.array.buffer));
    hash.update(Buffer.from(mesh.geometry.index.array.buffer));
  }
  return hash.digest('hex');
}

test('uses only supplied constructors, stays idempotent and leaves gameplay state / RNG untouched', async () => {
  const f = await fixture(), before = physics(f.island), refs = [f.island.col.boxes, f.island.props, f.island.ramps];
  const first = f.build({ replaceLegacy: true }), hash = geometryHash(first), second = f.build({ waterLevel: 900 });
  assert.equal(first, second);
  assert.equal(first.name, 'coastal-renewal-v1');
  assert.equal(f.island.root.children.filter(o => o.name === first.name).length, 1);
  assert.equal(physics(f.island), before);
  assert.deepEqual([f.island.col.boxes, f.island.props, f.island.ramps], refs);
  assert.equal(geometryHash(second), hash);
  assert.equal(first.userData.decorativeOnly, true);
  assert.doesNotMatch(source, /Math\.random|island\.r\s*\(|new\s+THREE\.\w*Light/);
});

test('geometry, transforms, colors, normals, UVs and bounding volumes are finite', async () => {
  const f = await fixture(), group = f.build();
  group.updateMatrixWorld(true);
  for (const mesh of group.children) {
    assert.equal(mesh.isMesh, true);
    assert.ok([...mesh.matrixWorld.elements].every(Number.isFinite), mesh.name);
    assert.equal(Array.isArray(mesh.material), false);
    assert.equal(mesh.geometry.groups.length, 0, 'one material per batch');
    for (const attr of Object.values(mesh.geometry.attributes)) assert.ok([...attr.array].every(Number.isFinite), mesh.name);
    const p = mesh.geometry.attributes.position, c = mesh.geometry.attributes.color;
    assert.equal(c.count, p.count); assert.equal(c.itemSize, 4);
    assert.ok([...c.array].every(v => v >= 0 && v <= 1.001), mesh.name);
    assert.ok([...mesh.geometry.attributes.uv.array].every(v => v >= 0 && v <= 1));
    assert.ok(Number.isFinite(mesh.geometry.boundingSphere.radius) && mesh.geometry.boundingSphere.radius > 0);
    for (const k of ['x', 'y', 'z']) {
      assert.ok(Number.isFinite(mesh.geometry.boundingBox.min[k])); assert.ok(Number.isFinite(mesh.geometry.boundingBox.max[k]));
    }
    assert.ok(mesh.geometry.index.count % 3 === 0);
    for (const i of mesh.geometry.index.array) assert.ok(i >= 0 && i < p.count);
  }
});

test('visible shoreline is the terrain/water intersection, not the shoreEdge reference', async () => {
  const f = await fixture(), group = f.build(), coast = group.userData.coast;
  assert.equal(coast.length, 385);
  for (const p of coast) assert.ok(Math.abs(H(p.x, p.z) - group.userData.waterLevel) < 2e-7);
  const mid = coast[Math.floor(coast.length / 2)];
  assert.ok(Math.abs(mid.x) < .001);
  assert.ok(mid.z > 250 && mid.z < 253, 'central waterline must be about z251.5, not z320');
  assert.ok(Math.abs(mid.r - edge(mid.a)) > 50);
});

test('warm sand and wet sand hug dry terrain, preserve beach breadth and face upward', async () => {
  const f = await fixture(), group = f.build();
  for (const name of ['sand', 'wet-sand']) {
    const geometry = group.getObjectByName('coastal:' + name).geometry;
    const p = geometry.attributes.position, n = geometry.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      assert.ok(Math.abs(p.getY(i) - H(p.getX(i), p.getZ(i)) - .048) < .00002, name);
      assert.ok(p.getZ(i) > 221.61, 'sand must not overpaint the road or promenade');
      assert.ok(H(p.getX(i), p.getZ(i)) > -.601, 'no land paint over the sea');
      assert.ok(n.getY(i) > .98, 'land ribbon wound upward');
    }
  }
  const bb = group.getObjectByName('coastal:sand').geometry.boundingBox;
  assert.ok(bb.max.x - bb.min.x > 280);
  assert.ok(bb.max.z - bb.min.z > 35);
  const sandColor = group.getObjectByName('coastal:sand').geometry.attributes.color;
  assert.ok(sandColor.getX(100) > sandColor.getZ(100) * 1.3, 'sand reads warm, not pure white');
});

test('lagoon gradient and broken foam have no land-side vertices or land-crossing triangles', async () => {
  const f = await fixture(), group = f.build();
  for (const [name, lift] of [['lagoon', .026], ['foam', .052]]) {
    const mesh = group.getObjectByName('coastal:' + name), geometry = mesh.geometry;
    const p = geometry.attributes.position, n = geometry.attributes.normal;
    assert.equal(mesh.material.transparent, true); assert.equal(mesh.material.depthWrite, false);
    assert.equal(mesh.material.forceSinglePass, true);
    for (let i = 0; i < p.count; i++) {
      assert.ok(Math.abs(p.getY(i) - (-.6 + lift)) < 1e-6);
      assert.ok(H(p.getX(i), p.getZ(i)) < -.601);
      assert.ok(n.getY(i) > .999);
    }
    for (let i = 0; i < geometry.index.count; i += 3) {
      let x = 0, z = 0;
      for (let j = 0; j < 3; j++) { const k = geometry.index.getX(i + j); x += p.getX(k) / 3; z += p.getZ(k) / 3; }
      assert.ok(H(x, z) < -.6001, 'a curved ribbon chord must not cut onto land');
    }
  }
  const rgba = group.getObjectByName('coastal:lagoon').geometry.attributes.color;
  const alpha = Array.from({ length: rgba.count }, (_, i) => rgba.getW(i));
  assert.equal(Math.min(...alpha), 0); assert.ok(Math.max(...alpha) > .69);
  const foamTriangles = group.getObjectByName('coastal:foam').geometry.index.count / 3;
  assert.ok(foamTriangles > 400 && foamTriangles < 1500, 'sparse narrow run-up, not a white blanket');
});

test('ground-level furniture clears entire routes, all six quest covers, props, ramps and legacy trunks', async () => {
  const f = await fixture(), group = f.build();
  const normal = group.userData.decorations.filter(d => !d.landmarkSkin);
  assert.ok(normal.length > 15);
  for (const b of normal) {
    for (const route of group.userData.protectedRoutes) for (let i = 1; i < route.points.length; i++)
      assert.ok(distance(b.x, b.z, route.points[i - 1], route.points[i]) >= route.halfWidth + b.radius - 1e-7, JSON.stringify(b));
    for (const p of group.userData.protectedSpots)
      assert.ok(Math.hypot(b.x - p.x, b.z - p.z) >= b.radius + p.radius - 1e-7, JSON.stringify(b));
    for (const c of f.island.col.boxes)
      assert.ok(Math.hypot(Math.max(c.x0 - b.x, 0, b.x - c.x1), Math.max(c.z0 - b.z, 0, b.z - c.z1)) >= b.radius + .35 - 1e-7);
    for (const p of f.island.props) assert.ok(Math.hypot(b.x - p.home.x, b.z - p.home.z) >= b.radius + p.radius + .4 - 1e-7);
    for (const r of f.island.ramps) {
      const dx = b.x - r.x, dz = b.z - r.z, fwd = dx * Math.sin(r.ry) + dz * Math.cos(r.ry), side = dx * Math.cos(r.ry) - dz * Math.sin(r.ry);
      assert.ok(Math.abs(fwd) >= r.L / 2 + b.radius + .5 || Math.abs(side) >= r.W / 2 + b.radius + .5);
    }
  }
  for (let i = 0; i < normal.length; i++) for (let j = 0; j < i; j++)
    assert.ok(Math.hypot(normal[i].x - normal[j].x, normal[i].z - normal[j].z) >= normal[i].radius + normal[j].radius + .4 - 1e-7);
  const skin = group.userData.decorations.find(d => d.landmarkSkin);
  assert.deepEqual([skin.x, skin.z, skin.approachClearWidth], [-60, 236, 6.1]);
  const pier = group.userData.floorSurfaces.find(d => d.kind === 'pier');
  assert.ok(pier.clearWidth >= 5 && pier.top - f.island.pierTop <= .041);
  assert.equal(pier.walkThrough, true);
});

test('paired resort bays, curved feather palms and structural upgrades use less than 30 batches / 80k triangles', async () => {
  const f = await fixture(), group = f.build(), stats = group.userData.stats;
  assert.ok(stats.umbrellas >= 7); assert.equal(stats.loungers, stats.umbrellas * 2); assert.equal(stats.mats, stats.umbrellas);
  assert.ok(stats.palms >= 8); assert.equal(stats.palms, stats.palmClusters * 2); assert.ok(stats.grassTufts >= 40);
  assert.ok(stats.promenadePlanks > 300); assert.ok(stats.pierPlanks > 140); assert.ok(stats.railingSections >= 30);
  assert.ok(stats.signs >= 2); assert.equal(stats.towerSkins, 1);
  const triangles = group.children.reduce((n, m) => n + m.geometry.index.count / 3, 0);
  assert.equal(triangles, stats.triangles); assert.equal(stats.batches, group.children.length);
  assert.ok(stats.batches < 30); assert.ok(stats.triangles < 80000);
  const maps = new Set(group.children.map(m => m.material.map).filter(Boolean));
  assert.equal(maps.size, 1); assert.equal(stats.textures, 1);
  assert.ok([...maps][0].isCanvasTexture);
  assert.equal(stats.liveLights, 0);
  group.traverse(o => { assert.ok(!o.isLight); assert.equal(o.castShadow, false); });
  console.log('COASTAL_BUDGET', JSON.stringify(stats));
});

test('deterministic geometry does not depend on a scene UUID or consume seeded gameplay RNG', async () => {
  const a = await fixture(), b = await fixture();
  const ga = a.build(), gb = b.build();
  assert.notEqual(ga.uuid, gb.uuid);
  assert.equal(geometryHash(ga), geometryHash(gb));
  assert.deepEqual(ga.userData.stats, gb.userData.stats);
  assert.deepEqual(ga.userData.decorations, gb.userData.decorations);
});

function oldUmbrella(THREE, island, x, z, radius = 1.8, heightDelta = 0) {
  const y = groundH(x, z), material = new THREE.MeshStandardMaterial({ color: 0xdb7868 });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(radius, .7, 12, 1, true), material);
  cone.position.set(x, y + 2.4 + heightDelta, z);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, 2.4), material);
  pole.position.set(x, y + 1.2, z);
  const towel = new THREE.Mesh(new THREE.PlaneGeometry(1, 2), material);
  towel.position.set(x + 1.2, y + .03, z + .5); towel.rotation.x = -Math.PI / 2;
  [cone, pole, towel].forEach(o => island.add(o)); return [cone, pole, towel];
}
test('legacy hiding is opt-in and requires an exact complete ordinary parasol triple', async () => {
  const a = await fixture(); const unchanged = oldUmbrella(a.THREE, a.island, -120, 234);
  a.build(); assert.ok(unchanged.every(o => o.visible));

  const f = await fixture(), { THREE, island } = f;
  const match = oldUmbrella(THREE, island, -120, 234);
  const wrongHeight = oldUmbrella(THREE, island, -104, 234, 1.8, .2);
  const auntPink = oldUmbrella(THREE, island, 91.5, 237, 2.4);
  const questCover = oldUmbrella(THREE, island, -50, 238, 2.6);
  const orphan = new THREE.Mesh(new THREE.ConeGeometry(1.8, .7, 12, 1, true), match[0].material);
  orphan.position.set(-80, groundH(-80, 234) + 2.4, 234); island.add(orphan);
  const nested = new THREE.Group(); island.add(nested);
  const nestedTriple = oldUmbrella(THREE, island, -70, 234); nestedTriple.forEach(o => nested.add(o));
  const before = physics(island), geometry = match.map(o => o.geometry), materials = match.map(o => o.material);
  const group = f.build({ replaceLegacy: true }), stats = group.userData.stats;
  assert.ok(match.every(o => !o.visible));
  assert.ok([...wrongHeight, ...auntPink, ...questCover, orphan, nested, ...nestedTriple].every(o => o.visible));
  assert.equal(stats.legacyUmbrellasHidden, 1); assert.equal(stats.legacyObjectsHidden, 3);
  assert.equal(group.userData.hiddenLegacy.length, 3);
  assert.deepEqual(match.map(o => o.geometry), geometry); assert.deepEqual(match.map(o => o.material), materials);
  assert.equal(physics(island), before);
});

test('overridden terrain, shore hint, sea level and terrain vertex offset are respected', async () => {
  const f = await fixture(); let groundCalls = 0, edgeCalls = 0;
  const custom = (x, z) => { groundCalls++; return groundH(x, z) + .4; };
  const group = f.build({ groundH: custom, shoreEdge: a => { edgeCalls++; return edge(a) + 12; }, waterLevel: -.35, terrainOffset: -.04 });
  assert.ok(groundCalls > 10000 && edgeCalls >= 385);
  for (const p of group.userData.coast) assert.ok(Math.abs(custom(p.x, p.z) - .04 + .35) < 1e-7);
  for (const [name, lift] of [['lagoon', .026], ['foam', .052]]) {
    const p = group.getObjectByName('coastal:' + name).geometry.attributes.position;
    for (let i = 0; i < p.count; i++) assert.ok(Math.abs(p.getY(i) - (-.35 + lift)) < 1e-6);
  }
});

test('fully occupied beach rejects new furniture / trees rather than overlapping buildings', async () => {
  const f = await fixture({ col: { boxes: [{ x0: -400, x1: 400, z0: -400, z1: 400, top: 80 }] } });
  const group = f.build(), stats = group.userData.stats;
  assert.equal(stats.umbrellas + stats.loungers + stats.mats + stats.palms + stats.grassTufts + stats.signs, 0);
  assert.equal(group.userData.decorations.filter(d => !d.landmarkSkin).length, 0);
  assert.ok(stats.promenadePlanks + stats.pierPlanks > 500);
  assert.equal(stats.towerSkins, 1, 'intentional skin on the existing tower, not a new collision object');
});

test('headless use needs no DOM, texture class, browser globals or external assets', async () => {
  const [THREE, { buildCoastalRenewal }] = await dependencies;
  const rootGroup = new THREE.Group(), namespace = Object.fromEntries(required.filter(k => k !== 'CanvasTexture').map(k => [k, THREE[k]]));
  const group = buildCoastalRenewal({ root: rootGroup, add: o => rootGroup.add(o) }, namespace);
  assert.equal(group.userData.stats.textures, 0);
  assert.equal(group.getObjectByName('coastal:wayfinding'), undefined);
  assert.ok(group.userData.stats.umbrellas > 0);
  assert.doesNotMatch(source, /\bimport\s|\bfetch\s*\(|\bXMLHttpRequest\b|\bTextureLoader\b|https?:\/\//);
});
