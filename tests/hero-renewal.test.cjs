'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');

const project = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(project, 'src', 'hero-renewal.js'), 'utf8');
const modules = Promise.all([
  import(pathToFileURL(path.join(project, 'huorengan-2079-play-main/full/vendor/three/three.module.js')).href),
  import('data:text/javascript;base64,' + Buffer.from(source + '\n//# sourceURL=hero-renewal.js').toString('base64')),
]);
const ctorNames = ['Group', 'Mesh', 'Object3D', 'BufferGeometry', 'Float32BufferAttribute',
  'SphereGeometry', 'CylinderGeometry', 'MeshStandardMaterial'];

async function fixture(t, options) {
  const [THREE, api] = await modules;
  const model = api.createHeroModel(THREE, options);
  t.after(() => model.userData.dispose());
  const meshes = []; model.traverse(o => { if (o.isMesh) meshes.push(o); });
  const get = key => model.getObjectByName(model.userData.joints[key]);
  return { THREE, api, model, meshes, get };
}
function near(a, b, epsilon = 1e-6) { assert.ok(Math.abs(a - b) <= epsilon, `${a} != ${b} (±${epsilon})`); }
function fingerprint(meshes) {
  const h = crypto.createHash('sha256');
  for (const m of meshes) {
    for (const a of [...Object.values(m.geometry.attributes), m.geometry.index]) {
      h.update(Buffer.from(a.array.buffer, a.array.byteOffset, a.array.byteLength));
    }
  }
  return h.digest('hex');
}
function allFinite(model) {
  model.updateMatrixWorld(true);
  model.traverse(o => {
    for (const n of [...o.position.toArray(), ...o.quaternion.toArray(), ...o.scale.toArray(), ...o.matrixWorld.elements]) assert.ok(Number.isFinite(n), o.name + ' transform must be finite');
  });
}

test('self-contained injected namespace; exact four-material rigid batching budget', async t => {
  const [THREE, api] = await modules;
  const injected = Object.freeze(Object.fromEntries(ctorNames.map(k => [k, THREE[k]])));
  const model = api.createHeroModel(injected);
  t.after(() => model.userData.dispose());
  let count = 0, triangles = 0; const materials = new Set();
  model.traverse(o => {
    if (!o.isMesh) return;
    count++; triangles += o.geometry.index.count / 3; materials.add(o.material);
    assert.equal(o.geometry.groups.length, 0, 'one material per merged mesh');
    assert.equal(o.userData.heroRigidBatch, true);
    assert.ok(!Array.isArray(o.material));
    assert.equal(o.material.vertexColors, true);
    assert.equal(o.material.transparent, false);
    for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'alphaMap', 'emissiveMap']) assert.equal(o.material[k], null);
  });
  assert.equal(count, 24); assert.ok(count < 30);
  assert.ok(triangles > 18000 && triangles < 35000, `triangle budget: ${triangles}`);
  assert.equal(materials.size, 4);
  assert.equal(model.userData.stats.triangles, triangles);
  assert.equal(model.userData.stats.drawCalls, count);
  assert.equal(model.userData.stats.textures, 0);
  assert.deepEqual(model.animations, [], 'empty clips are safe for the existing Player state machine');
  assert.doesNotThrow(() => new THREE.AnimationMixer(model).update(1 / 60));
});

test('all indexed vertex data, normals and bounds are finite and usable', async t => {
  const { model, meshes } = await fixture(t);
  for (const mesh of meshes) {
    const g = mesh.geometry;
    for (const [key, a] of Object.entries(g.attributes)) {
      assert.equal(a.count, g.attributes.position.count, mesh.name + ' ' + key + ' length');
      for (const n of a.array) assert.ok(Number.isFinite(n), mesh.name + ' ' + key + ' finite');
    }
    for (const n of g.index.array) assert.ok(n >= 0 && n < g.attributes.position.count);
    const normal = g.attributes.normal;
    for (let i = 0; i < normal.count; i++) near(Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i)), 1, 2e-5);
    for (const n of [...g.boundingBox.min.toArray(), ...g.boundingBox.max.toArray(), g.boundingSphere.radius]) assert.ok(Number.isFinite(n));
    assert.ok(g.boundingSphere.radius > 0);
  }
  allFinite(model);
});

test('neutral stance has grounded soles, authored height, +Z gaze and rear asymmetrical bag', async t => {
  const { THREE, model, get } = await fixture(t);
  const bounds = new THREE.Box3().setFromObject(model, true);
  near(bounds.min.y, 0); near(bounds.max.y, 1.68);
  assert.ok(bounds.max.x - bounds.min.x > .88 && bounds.max.x - bounds.min.x < 1.22);
  assert.equal(model.userData.facing, '+Z');
  assert.ok(get('eyeL').position.z > .29 && get('eyeR').position.z > .29);
  assert.ok(get('eyeL').position.x < 0 && get('eyeR').position.x > 0);
  assert.ok(get('satchel').position.z < -.30 && get('satchel').position.x > .20);
  const parts = model.userData.stats.semanticParts;
  for (const key of ['sculptedFrogHead', 'tailoredJacket', 'rearShoulderYoke', 'frontCrossbodyStrap', 'rearCrossbodyStrap', 'cookerMetalShell', 'cookerEnamelLid', 'rearHinge', 'satchelShell', 'rearRiceBadge']) assert.equal(parts[key], 1, key);
  assert.equal(parts.threeFingerWebbedHand, 2); assert.equal(parts.threeToeWebbedFoot, 2);
  assert.equal(parts.eyeCatchlight, 4); assert.equal(parts.rearSteamMark, 3);
  model.userData.animate('idle', 0, 0, 0);
  const after = new THREE.Box3().setFromObject(model, true);
  near(after.min.y, 0); near(after.max.y, 1.68);
});

test('height normalizes internally; Player may own external scale/position/rotation', async t => {
  const { THREE, model } = await fixture(t, { height: 1.91 });
  near(new THREE.Box3().setFromObject(model, true).max.y, 1.91);
  near(new THREE.Box3().setFromObject(model, true).min.y, 0);
  assert.deepEqual(model.scale.toArray(), [1, 1, 1]);
  model.position.set(7, 3, -8); model.rotation.set(.2, 1.3, -.1); model.scale.set(.85, .9, .95);
  const external = [model.position.toArray(), model.quaternion.toArray(), model.scale.toArray()];
  for (const mode of ['idle', 'foot', 'walk', 'run', 'bike', 'ride', 'jump', 'dive', 'splat', 'laugh']) {
    model.userData.animate(mode, .83, 6.2, .016);
    assert.deepEqual([model.position.toArray(), model.quaternion.toArray(), model.scale.toArray()], external);
    allFinite(model);
  }
});

test('walking alternates real articulated legs/arms; bike reaches forward and tucks knees', async t => {
  const { THREE, model, get } = await fixture(t);
  const animate = model.userData.animate;
  animate('idle', 0, 0, 0); model.updateMatrixWorld(true);
  const standingHands = ['handL', 'handR'].map(k => get(k).getWorldPosition(new THREE.Vector3()));
  animate('foot', Math.PI / 2, 6, 0);
  assert.ok(get('hipL').rotation.x < -.5 && get('hipR').rotation.x > .5);
  assert.ok(get('shoulderL').rotation.x > .3 && get('shoulderR').rotation.x < -.5);
  assert.ok(get('kneeL').rotation.x > .7 && Math.abs(get('kneeR').rotation.x) < .01);
  const left = get('hipL').rotation.x;
  animate('foot', Math.PI * 1.5, 6, 0);
  near(get('hipR').rotation.x, left);
  animate('bike', .5, 13, 0); model.updateMatrixWorld(true);
  for (const side of ['L', 'R']) {
    assert.ok(get('shoulder' + side).rotation.x < -1.1);
    assert.ok(get('knee' + side).rotation.x > 1.1);
    assert.ok(get('hip' + side).rotation.x < -.7);
    const hand = get('hand' + side).getWorldPosition(new THREE.Vector3());
    assert.ok(hand.z > standingHands[side === 'L' ? 0 : 1].z + .17, 'handlebar-reaching hands');
  }
  animate('dive', .5, 9, 0);
  assert.ok(Math.abs(get('shoulderL').rotation.z) > 1);
  assert.ok(Math.abs(get('shoulderR').rotation.z) > 1);
  assert.ok(get('kneeL').rotation.x > .6);
  allFinite(model);
});

test('blink is a sculpted eyelid rotation, bounded and deterministic', async t => {
  const { THREE, model, get } = await fixture(t);
  const eyeScale = get('eyeL').scale.toArray();
  const frontHit = point => {
    model.updateMatrixWorld(true);
    const eye = get('eyeL');
    const origin = eye.localToWorld(new THREE.Vector3(point[0], point[1], .6));
    const direction = new THREE.Vector3(0, 0, -1).transformDirection(eye.matrixWorld);
    return new THREE.Raycaster(origin, direction).intersectObject(model, true)[0]?.object;
  };
  assert.equal(frontHit([.007, -.004])?.parent, get('eyeL'), 'open eyelid does not bury the pupil');
  for (let i = 0; i < 45; i++) model.userData.animate('idle', 0, 0, .1);
  model.userData.animate('idle', 0, 0, .03);
  assert.ok(get('lidL').rotation.x > 1.50, 'closed lid sweeps over the eyeball');
  assert.ok(get('lidR').rotation.x > 1.50);
  for (const point of [[.007, -.004], [-.025, .030], [.019, -.033]]) {
    assert.equal(frontHit(point)?.parent, get('lidL'), 'closed skin shell occludes the pupil AND both raised glints');
  }
  assert.deepEqual(get('eyeL').scale.toArray(), eyeScale, 'blink does not flatten eyeballs');
  for (let i = 0; i < 8; i++) model.userData.animate('idle', 0, 0, .05);
  near(get('lidL').rotation.x, .018);
  allFinite(model);
});

test('animation never rebuilds geometry/materials, leaks root transforms or produces NaN', async t => {
  const { model, meshes } = await fixture(t);
  const before = fingerprint(meshes), geometries = meshes.map(m => m.geometry), mats = meshes.map(m => m.material);
  const modes = ['foot', 'bike', 'jump', 'dive', 'splat', 'laugh', 'idle'];
  for (let i = 0; i < 500; i++) model.userData.animate(modes[i % modes.length], i * .19, i % 21, 1 / 60);
  for (const args of [[null, NaN, NaN, NaN], ['bike', Infinity, Infinity, Infinity], ['dive', -Infinity, -Infinity, -1], ['unknown', 1e200, -1e200, 100]]) {
    assert.equal(model.userData.animate(...args), model); allFinite(model);
  }
  assert.equal(fingerprint(meshes), before);
  assert.deepEqual(meshes.map(m => m.geometry), geometries);
  assert.deepEqual(meshes.map(m => m.material), mats);
  assert.equal(meshes.length, 24);
});

test('identical phase/dt sequences produce identical geometry and internal animation', async t => {
  const first = await fixture(t), second = await fixture(t);
  assert.equal(fingerprint(first.meshes), fingerprint(second.meshes));
  for (let i = 0; i < 51; i++) {
    const args = [i < 20 ? 'foot' : 'bike', i * .2, 7, 1 / 60];
    first.model.userData.animate(...args); second.model.userData.animate(...args);
  }
  for (const key of Object.keys(first.model.userData.joints)) {
    assert.deepEqual(first.get(key).position.toArray(), second.get(key).position.toArray());
    assert.deepEqual(first.get(key).quaternion.toArray(), second.get(key).quaternion.toArray());
  }
});

test('each instance owns its materials and geometry; disposal is idempotent', async t => {
  const first = await fixture(t), second = await fixture(t);
  let geometryDisposals = 0, materialDisposals = 0;
  const materialSet = new Set(first.meshes.map(m => m.material));
  first.meshes.forEach(m => m.geometry.addEventListener('dispose', () => geometryDisposals++));
  materialSet.forEach(m => m.addEventListener('dispose', () => materialDisposals++));
  assert.notEqual(first.meshes[0].geometry, second.meshes[0].geometry);
  assert.notEqual(first.meshes[0].material, second.meshes[0].material);
  first.model.userData.dispose(); first.model.userData.dispose();
  assert.equal(geometryDisposals, 24); assert.equal(materialDisposals, 4);
  const q = first.get('hipL').quaternion.toArray();
  first.model.userData.animate('bike', 3, 4, 0);
  assert.deepEqual(first.get('hipL').quaternion.toArray(), q, 'disposed animation is a no-op');
  assert.doesNotThrow(() => second.model.userData.animate('bike', 1, 5, .1));
});

test('invalid constructors fail clearly; invalid heights safely fall back', async t => {
  const [THREE, api] = await modules;
  assert.throws(() => api.createHeroModel(null), /THREE.Group/);
  assert.throws(() => api.createHeroModel({ Group: THREE.Group }), /THREE.Mesh/);
  const { model } = await fixture(t, { height: -1 });
  near(new THREE.Box3().setFromObject(model, true).max.y, 1.68);
});

test('inline export stripping works without imports, DOM, assets, or a global THREE', async t => {
  const [THREE] = await modules;
  assert.doesNotMatch(source, /\b(?:import\s*\(|fetch\s*\(|document\.|window\.|GLTFLoader|TextureLoader|Math\.random\s*\()/);
  const make = new Function(source.replace(/^export\s+/gm, '') + '\nreturn {createHeroModel, installHeroRenewal};');
  const api = make();
  const model = api.createHeroModel(Object.fromEntries(ctorNames.map(k => [k, THREE[k]])));
  t.after(() => model.userData.dispose());
  assert.equal(model.userData.stats.drawCalls, 24);
});

test('passive installer preserves Player/mixer/physics identity, height and originals', async t => {
  const [THREE, api] = await modules;
  const scene = new THREE.Group(), host = new THREE.Group(); scene.add(host);
  scene.position.set(4, 2, -9); scene.rotation.y = .8;
  host.position.set(2, 3, 4); host.rotation.y = -.3; host.scale.setScalar(.85);
  const oldMaterial = new THREE.MeshStandardMaterial(), oldGeometry = new THREE.BoxGeometry(.7, 1.5, .4);
  t.after(() => { oldGeometry.dispose(); oldMaterial.dispose(); });
  const original = new THREE.Mesh(oldGeometry, oldMaterial); original.position.y = .75;
  const wasHidden = new THREE.Group(); wasHidden.visible = false;
  const hiddenTall = new THREE.Mesh(oldGeometry, oldMaterial); hiddenTall.scale.y = 10; wasHidden.add(hiddenTall);
  host.add(original, wasHidden);
  const mixer = new THREE.AnimationMixer(host), animations = []; host.animations = animations;
  const player = { model: host, mixer, pos: new THREE.Vector3(1, 2, 3), bike: new THREE.Group(), root: new THREE.Group(), scale: 1 };
  const game = { player, traffic: [new THREE.Group()], physics: { untouched: true }, orders: [{ id: 3 }] };
  const frozen = { ...player }, transforms = [host.position.toArray(), host.quaternion.toArray(), host.scale.toArray()];
  let oldDisposed = 0;
  oldGeometry.addEventListener('dispose', () => oldDisposed++); oldMaterial.addEventListener('dispose', () => oldDisposed++);
  const hero = api.installHeroRenewal(game, THREE);
  assert.ok(hero); t.after(() => hero.userData.uninstall());
  near(hero.userData.height, 1.5, 1e-6, 'measures host-local height, not current bicycle/world scale');
  assert.equal(player.model, host); assert.equal(player.mixer, mixer); assert.equal(mixer.getRoot(), host);
  for (const key of Object.keys(frozen)) assert.equal(player[key], frozen[key]);
  assert.equal(host.animations, animations);
  assert.deepEqual([host.position.toArray(), host.quaternion.toArray(), host.scale.toArray()], transforms);
  assert.equal(original.visible, false); assert.equal(wasHidden.visible, false);
  assert.equal(hero.parent, host); assert.equal(host.children.length, 3);
  assert.equal(api.installHeroRenewal(game, THREE, { height: 3 }), hero, 'idempotent, no duplicate model');
  assert.equal(host.children.length, 3);
  hero.userData.animate('bike', .8, 12, 0); mixer.update(.016);
  assert.equal(oldDisposed, 0);
  hero.userData.uninstall(); hero.userData.uninstall();
  assert.equal(original.visible, true); assert.equal(wasHidden.visible, false);
  assert.deepEqual(host.children, [original, wasHidden]); assert.equal(hero.parent, null);
  assert.equal(oldDisposed, 0, 'never disposes shared original GLTF resources');
  const next = api.installHeroRenewal(game, THREE, { height: 1.68 });
  assert.notEqual(next, hero); near(next.userData.height, 1.68); next.userData.uninstall();
});

test('installer rejects absent/unsafe targets without side effects; build failure keeps original visible', async t => {
  const [THREE, api] = await modules;
  for (const game of [null, {}, { player: {} }, { player: { model: {} } }]) assert.equal(api.installHeroRenewal(game, THREE), null);
  const host = new THREE.Group(), old = new THREE.Group(); host.add(old);
  assert.throws(() => api.installHeroRenewal({ player: { model: host } }, {}), /THREE.Group/);
  assert.equal(old.visible, true); assert.deepEqual(host.children, [old]);
  const { model } = await fixture(t, { castShadow: false, receiveShadow: true });
  model.traverse(o => { if (o.isMesh) { assert.equal(o.castShadow, false); assert.equal(o.receiveShadow, true); } });
});
