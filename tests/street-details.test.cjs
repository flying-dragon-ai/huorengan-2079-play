const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { updateHtml, renderBlock, HOOK, CALL } = require('../tools/build-street-details.cjs');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/street-details.js'), 'utf8');
const dependencies = Promise.all([
  import(pathToFileURL(path.join(root, 'huorengan-2079-play-main/full/vendor/three/three.module.js')).href),
  import('data:text/javascript;base64,' + Buffer.from(source).toString('base64')),
]);
const routes = [
  [[-100, -104.5], [145, -104.5], [145, 205], [95, 205], [94, 231]],
  [[-100, -100], [50, -100], [50, 150], [50, 205], [95, 205], [94, 231]],
];
let canvasCount = 0;
function createCanvas() {
  canvasCount++;
  const context = new Proxy({}, { get: (obj, key) => key in obj ? obj[key] : () => {}, set: (obj, key, value) => { obj[key] = value; return true; } });
  return { width: 0, height: 0, getContext: () => context };
}
async function fixture(extra = {}) {
  const [THREE, { buildStreetDetails }] = await dependencies;
  const root = new THREE.Group();
  root.add(new THREE.Group());
  const island = {
    root, add: object => root.add(object),
    cafe: new THREE.Vector3(-100, 0, -100), auntSpot: new THREE.Vector3(94, 0, 231),
    districts: [{ quest: { at: new THREE.Vector3(-132, 0, -96), time: 75 } }],
    col: { boxes: [{ x0: 61, x1: 139, z0: -125, z1: -110, top: 20 }] },
    props: [{ home: new THREE.Vector3(-70, 0, -92), radius: 1.2 }],
    ramps: [{ x: 150, z: 80, ry: 0, L: 11, W: 7, H: 3 }],
    heightAt: () => 0,
    r() { throw new Error('Street dressing must not consume gameplay RNG'); },
    ...extra,
  };
  const options = { createCanvas, protectedRoutes: routes };
  return { THREE, island, options, build: () => buildStreetDetails(island, THREE, options) };
}
function physics(island) {
  return JSON.stringify({ col: island.col, props: island.props, ramps: island.ramps, districts: island.districts });
}
function distance(x, z, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], len = dx * dx + dz * dz;
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (len || 1)));
  return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
}

test('adds one decorative layer without changing existing objects or gameplay state', async () => {
  const f = await fixture(), before = physics(f.island), oldChild = f.island.root.children[0];
  const group = f.build();
  assert.equal(physics(f.island), before);
  assert.equal(f.island.root.children.length, 2);
  assert.equal(f.island.root.children[0], oldChild);
  assert.equal(group.userData.decorativeOnly, true);
  assert.ok(group.userData.stats.curbBlocks > 1000);
  for (const key of ['drains', 'manholes', 'arrows', 'tactilePads', 'planters', 'benches', 'signs']) assert.ok(group.userData.stats[key] > 0, key);
  assert.ok(group.children.every(mesh => mesh.isMesh && !mesh.castShadow));
});

test('initialization is idempotent and does not allocate a second texture atlas', async () => {
  const f = await fixture(), first = f.build(), count = canvasCount;
  assert.equal(f.build(), first);
  assert.equal(canvasCount, count);
  assert.equal(f.island.root.children.length, 2);
});

test('all transforms, bounds, normals and UVs are finite and surface winding faces upward', async () => {
  const f = await fixture(), group = f.build();
  for (const mesh of group.children) {
    if (mesh.isInstancedMesh) assert.ok([...mesh.instanceMatrix.array].every(Number.isFinite));
    for (const attr of Object.values(mesh.geometry.attributes)) assert.ok([...attr.array].every(Number.isFinite), mesh.name);
    const sphere = mesh.isInstancedMesh ? mesh.boundingSphere : mesh.geometry.boundingSphere;
    assert.ok(Number.isFinite(sphere.radius) && sphere.radius > 0);
  }
  const graphics = group.getObjectByName('street:graphics');
  assert.ok(graphics.geometry.attributes.normal.getY(0) > .99);
  for (const n of graphics.geometry.attributes.uv.array) assert.ok(n >= 0 && n <= 1);
});

test('tactile waiting pads stay on pavement rather than covering existing zebra crossings', async () => {
  const f = await fixture(), group = f.build(), geo = group.getObjectByName('street:graphics').geometry;
  const p = geo.attributes.position, uv = geo.attributes.uv;
  let pads = 0;
  for (let i = 0; i < p.count; i += 4) {
    const tile = Math.floor(uv.getX(i) * 4) + 4 * Math.floor((1 - uv.getY(i)) * 4);
    if (tile !== 2) continue;
    const x = (p.getX(i) + p.getX(i + 2)) / 2, z = (p.getZ(i) + p.getZ(i + 2)) / 2;
    for (const rx of [-150, -50, 50, 150]) assert.ok(Math.abs(x - rx) > 7 + .55);
    for (const rz of [-150, -100, -50, 50, 150]) assert.ok(Math.abs(z - rz) > 7 + .8);
    pads++;
  }
  assert.equal(pads, group.userData.stats.tactilePads);
});

test('road arrows use one right-hand driving convention on both road axes', async () => {
  const f = await fixture(), geo = f.build().getObjectByName('street:graphics').geometry;
  const p = geo.attributes.position, uv = geo.attributes.uv;
  let arrows = 0;
  for (let i = 0; i < p.count; i += 4) {
    const tile = Math.floor(uv.getX(i) * 4) + 4 * Math.floor((1 - uv.getY(i)) * 4);
    if (tile !== 3) continue;
    const x = (p.getX(i) + p.getX(i + 2)) / 2, z = (p.getZ(i) + p.getZ(i + 2)) / 2;
    const dx = (p.getX(i) + p.getX(i + 3) - p.getX(i + 1) - p.getX(i + 2)) / 2;
    const dz = (p.getZ(i) + p.getZ(i + 3) - p.getZ(i + 1) - p.getZ(i + 2)) / 2;
    const rx = [-150, -50, 50, 150].find(v => Math.abs(Math.abs(x - v) - 3.2) < .001);
    if (rx !== undefined) { assert.ok(Math.abs(dx) < .001); assert.equal(Math.sign(dz), -Math.sign(x - rx)); }
    else {
      const rz = [-150, -100, -50, 50, 150, 210].find(v => Math.abs(Math.abs(z - v) - 3.2) < .001);
      assert.notEqual(rz, undefined); assert.ok(Math.abs(dz) < .001); assert.equal(Math.sign(dx), Math.sign(z - rz));
    }
    arrows++;
  }
  assert.ok(arrows > 60);
});

test('uses a small shared batch/triangle budget and only two local textures', async () => {
  const f = await fixture(), group = f.build(), stats = group.userData.stats;
  assert.ok(stats.batches <= 14, JSON.stringify(stats));
  assert.ok(stats.triangles < 40000, JSON.stringify(stats));
  const maps = new Set(group.children.map(m => m.material.map).filter(Boolean));
  assert.equal(maps.size, 2);
  assert.ok([...maps].every(map => map.isCanvasTexture));
  console.log('STREET_BUDGET', JSON.stringify(stats));
});

test('keeps tall decorations out of entire coffee routes, task circles, ramps and buildings', async () => {
  const f = await fixture(), group = f.build();
  for (const b of group.userData.decorations) {
    const radius = Math.hypot(b.hx, b.hz);
    for (const route of routes) for (let i = 1; i < route.length; i++) assert.ok(distance(b.x, b.z, route[i - 1], route[i]) >= 3 + radius);
    for (const p of [f.island.cafe, f.island.auntSpot, f.island.districts[0].quest.at]) assert.ok(Math.hypot(b.x - p.x, b.z - p.z) >= 9 + radius);
    for (const c of f.island.col.boxes) assert.ok(b.x + b.hx <= c.x0 - .35 || b.x - b.hx >= c.x1 + .35 || b.z + b.hz <= c.z0 - .35 || b.z - b.hz >= c.z1 + .35);
  }
  // The shortcut leaves the inner asphalt road at z=164 and crosses the seafront at z=203.
  const curbs = group.getObjectByName('street:box:curb'), m = new f.THREE.Matrix4(), p = new f.THREE.Vector3();
  for (let i = 0; i < curbs.count; i++) {
    curbs.getMatrixAt(i, m); p.setFromMatrixPosition(m);
    assert.ok(Math.hypot(p.x - 50, p.z - 203) > 3, 'shortcut seafront exit must stay visually open');
    assert.ok(Math.hypot(p.x - 50, p.z - 164) > 3, 'inner-road end must not be capped');
  }
});

test('curb cuts protect complete coffee routes including the final hand-in, and pedestrian gates', async () => {
  const f = await fixture(), curbs = f.build().getObjectByName('street:box:curb');
  const m = new f.THREE.Matrix4(), p = new f.THREE.Vector3(), radius = Math.hypot(1.17, .16);
  const paths = [...routes, [[0, 34], [0, 59]], [[-60, 201], [-60, 233]]];
  const spots = [f.island.cafe, f.island.auntSpot, f.island.districts[0].quest.at,
    { x: 100, z: 95.5 }, { x: 0, z: 38 }, { x: 68, z: -103 }, { x: -60, z: 231 }];
  for (let i = 0; i < curbs.count; i++) {
    curbs.getMatrixAt(i, m); p.setFromMatrixPosition(m);
    for (const route of paths) for (let j = 1; j < route.length; j++) assert.ok(distance(p.x, p.z, route[j - 1], route[j]) >= .8 + radius - .0001, 'curb intersects a protected passage');
    for (const spot of spots) assert.ok(Math.hypot(p.x - spot.x, p.z - spot.z) >= 9 + radius - .0001);
  }
});

test('fully occupied sidewalks reject furniture rather than overlap buildings', async () => {
  const f = await fixture({ col: { boxes: [{ x0: -300, x1: 300, z0: -300, z1: 300, top: 80 }] } });
  const stats = f.build().userData.stats;
  assert.equal(stats.planters + stats.benches + stats.signs, 0);
  assert.ok(stats.curbBlocks > 0);
});

test('offline builder is idempotent and preserves every byte outside its two owned edits', () => {
  const original = '<!doctype html>\n<script type="module">\n// Existing rival riders, nitro, saves and audio stay untouched.\n' + HOOK + '\n  const preexisting = "中文\\n🚲";\n}\n</script>\n';
  const output = updateHtml(original, source);
  assert.equal(updateHtml(output, source), output);
  assert.equal(output.replace(renderBlock(source), '').replace(HOOK + CALL, HOOK), original);
  const edited = source.replace('curbBlocks: 0', 'curbBlocks: 0 /* source revision */');
  const refreshed = updateHtml(output, edited);
  assert.equal(updateHtml(refreshed, edited), refreshed);
  assert.ok(refreshed.includes('/* source revision */'));
  assert.equal(refreshed.replace(renderBlock(edited), '').replace(HOOK + CALL, HOOK), original);
  assert.throws(() => updateHtml(original + HOOK, source), /exactly one/);
});

test('the current offline HTML is synchronized with the readable street builder', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.equal(updateHtml(html, source), html);
});
