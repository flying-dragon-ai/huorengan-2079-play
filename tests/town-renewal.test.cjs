const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const base = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(base, 'src/town-renewal.js'), 'utf8');
const dependencies = Promise.all([
  import(pathToFileURL(path.join(base, 'huorengan-2079-play-main/full/vendor/three/three.module.js')).href),
  import('data:text/javascript;base64,' + Buffer.from(source).toString('base64')),
]);
let canvases = 0;
function createCanvas() {
  canvases++;
  const ctx = new Proxy({ createLinearGradient: () => ({ addColorStop() {} }) }, {
    get: (o, k) => k in o ? o[k] : () => {}, set: (o, k, v) => { o[k] = v; return true; },
  });
  return { width: 0, height: 0, getContext: () => ctx };
}
async function fixture() {
  const [THREE, { buildTownRenewal }] = await dependencies;
  const root = new THREE.Group(), island = {
    root, add: o => root.add(o), r() { throw new Error('Do not consume gameplay RNG'); },
    col: { boxes: [{ x0: -155, x1: -145, z0: -124, z1: -110.5, top: 10 }] },
    props: [{ home: { x: -149, y: 0, z: -108 }, mass: 2 }],
    ramps: [{ x: 0, z: -100, L: 10, W: 6, H: 2.4 }],
    districts: [{ quest: { at: { x: -132, y: 0, z: -96 }, time: 75, goal: 6 } }],
    _fm: { shikumen0: new THREE.MeshStandardMaterial(), tokyo0: new THREE.MeshStandardMaterial() },
    shRows: [],
  };
  for (const north of [true, false]) for (let i = 0; i < 7; i++) {
    const s = { x: -148 + i * 16, w: 15, h: 9 + i % 3, z: north ? -117.5 : -82.5, zFront: north ? -110.5 : -89.5 };
    island.shRows.push(s);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(s.w - .6, s.h, 14), island._fm.shikumen0);
    wall.position.set(s.x, s.h / 2, s.z); root.add(wall);
    const awning = new THREE.Mesh(new THREE.BoxGeometry(6, .12, 1.6), new THREE.MeshStandardMaterial());
    awning.position.set(s.x, 3.26, s.zFront + (north ? .8 : -.8)); root.add(awning);
  }
  const tokyo = new THREE.Mesh(new THREE.BoxGeometry(10, 21, 12), island._fm.tokyo0);
  tokyo.position.set(80, 10.5, -116.5); root.add(tokyo);
  const broad = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(2.2, 1), new THREE.MeshStandardMaterial(), 8);
  const generic = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(2.4, 1), new THREE.MeshStandardMaterial({ color: 0x5f8f3a }), 8);
  const m = new THREE.Matrix4();
  for (let i = 0; i < 8; i++) {
    m.makeTranslation(-145 + i * 13, 7, -108.9); broad.setMatrixAt(i, m); broad.setColorAt(i, new THREE.Color().setHSL(.2, .55, .4));
    generic.setMatrixAt(i, m);
  }
  root.add(broad, generic);
  const palm = new THREE.InstancedMesh(new THREE.ConeGeometry(.7, 5, 4, 1, true), new THREE.MeshStandardMaterial({ color: 0x3f8a3a }), 8);
  for (let i = 0; i < 8; i++) palm.setMatrixAt(i, m); root.add(palm);
  const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(2.4, 1), new THREE.MeshStandardMaterial({ color: 0x5f8f3a })); root.add(rock);
  const oldAwning = root.children[1];
  return { THREE, island, broad, generic, palm, rock, oldAwning, build: () => buildTownRenewal(island, THREE, { createCanvas }) };
}
function physics(i) { return JSON.stringify([i.col, i.props, i.ramps, i.districts]); }

test('substantially replaces storefront architecture, not just pavement decorations', async () => {
  const f = await fixture(), before = physics(f.island), layer = f.build(), s = layer.userData.stats;
  assert.equal(physics(f.island), before);
  assert.equal(s.storefronts, 15); assert.equal(s.stripedAwnings, 15);
  assert.ok(s.balconies >= 8); assert.ok(s.windowBoxes >= 12); assert.equal(s.lightGarlands, 3);
  assert.equal(s.hiddenLegacyAwnings, 14); assert.equal(f.oldAwning.visible, false);
  assert.ok(layer.getObjectByName('town:painted-fascias'));
  assert.ok(layer.getObjectByName('town:striped-canvas').geometry.attributes.color);
  assert.ok(layer.getObjectByName('town:box:glass'));
  assert.equal(layer.userData.decorativeOnly, true);
});

test('renewed trees retain their exact matrices while getting smooth green crowns and feathered palms', async () => {
  const f = await fixture(), matrices = [f.broad, f.generic, f.palm].map(m => [...m.instanceMatrix.array]);
  const rockGeometry = f.rock.geometry, group = f.build();
  assert.equal(group.userData.stats.renewedTreeBatches, 2); assert.equal(group.userData.stats.renewedPalmBatches, 1);
  assert.equal(f.broad.geometry.type, 'SphereGeometry'); assert.equal(f.generic.geometry.type, 'SphereGeometry');
  assert.equal(f.broad.material.flatShading, false); assert.equal(f.broad.material.roughness, .92);
  assert.equal(f.rock.geometry, rockGeometry, 'must not replace lookalike rocks');
  assert.equal(f.palm.geometry.type, 'BufferGeometry'); assert.ok(f.palm.geometry.attributes.position.count > 250);
  [f.broad, f.generic, f.palm].forEach((mesh, i) => assert.deepEqual([...mesh.instanceMatrix.array], matrices[i]));
});

test('facade atlas preserves night windows and is allocated only once', async () => {
  const f = await fixture(), first = f.build(), before = canvases;
  assert.equal(f.build(), first); assert.equal(canvases, before);
  for (const mat of Object.values(f.island._fm)) {
    assert.ok(mat.map?.isCanvasTexture); assert.ok(mat.emissiveMap?.isCanvasTexture);
    assert.equal(mat.roughness, .88); assert.equal(mat.metalness, 0);
    assert.equal(mat.map.colorSpace, f.THREE.SRGBColorSpace);
  }
});

test('geometry, UVs, normals, matrices and bounds are finite and kept in a batched budget', async () => {
  const f = await fixture(), layer = f.build(), s = layer.userData.stats;
  assert.ok(s.batches <= 24, String(s.batches)); assert.ok(s.triangles < 130000, String(s.triangles));
  for (const mesh of [...layer.children, f.broad, f.generic, f.palm]) {
    for (const [name, attr] of Object.entries(mesh.geometry.attributes)) {
      assert.ok([...attr.array].every(Number.isFinite), mesh.name + ':' + name);
      // Three's built-in spheres deliberately offset pole UVs slightly outside [0,1].
      if (name === 'uv' && /painted-fascias|striped-canvas/.test(mesh.name)) for (const value of attr.array) assert.ok(value >= -1e-6 && value <= 1 + 1e-6);
    }
    if (mesh.isInstancedMesh) assert.ok([...mesh.instanceMatrix.array].every(Number.isFinite));
    const bounds = mesh.isInstancedMesh ? (mesh.computeBoundingSphere(), mesh.boundingSphere) : mesh.geometry.boundingSphere;
    assert.ok(bounds && Number.isFinite(bounds.radius) && bounds.radius > 0, mesh.name);
  }
});

test('projecting canopies stay on the shop side, above riders and off the road', async () => {
  const f = await fixture(), layer = f.build();
  for (const shop of layer.userData.storefronts) {
    assert.ok(shop.minCanopyHeight > 2.7);
    const edge = shop.zFront + shop.dir * shop.projection;
    assert.ok(Math.abs(edge + 100) > 8.5, 'awning must not reach the road');
  }
  const thread = layer.getObjectByName('town:cylinder:metal'), m = new f.THREE.Matrix4(), p = new f.THREE.Vector3();
  for (let i = 0; i < thread.count; i++) {
    thread.getMatrixAt(i, m); p.setFromMatrixPosition(m);
    if (p.z > -108.7 && p.z < -91.3) assert.ok(p.y > 5.7, 'strings across the road must clear riders');
  }
});
