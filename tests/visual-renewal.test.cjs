const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const { updateHtml, renderBlock, stripOwned, readSources, SOURCE_FILES, START, END, ANCHOR, CALL } = require('../tools/build-visual-renewal.cjs');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/visual-renewal.js'), 'utf8');
const dependencies = Promise.all([
  import(pathToFileURL(path.join(root, 'huorengan-2079-play-main/full/vendor/three/three.module.js')).href),
  import('data:text/javascript;base64,' + Buffer.from(source).toString('base64')),
]);
async function fixture(disabled = false) {
  const [THREE, { installVisualRenewal }] = await dependencies;
  const world = new THREE.Scene(), old = new THREE.Group(), container = new THREE.Group(); container.add(old);
  const calls = { stop: 0, uncache: 0, init: 0, render: 0, builds: 0, poses: 0, animations: [] };
  const player = {
    model: old, root: container, mode: 'foot', phase: .9, speed: 0, air: false,
    pos: new THREE.Vector3(4, 0, 12), vel: new THREE.Vector3(2, 0, 1), yaw: .3, scale: 1, sq: 1,
    mixer: { stopAllAction() { calls.stop++; }, uncacheRoot(r) { assert.equal(r, old); calls.uncache++; } },
    initAnimation() { calls.init++; this.clips = this.model.animations || []; this.currentAction = 'idle'; },
    pose() { calls.poses++; this.root.position.copy(this.pos); this.root.rotation.y = this.yaw; this.model.position.set(0, .08, 0); this.model.rotation.set(.1, 0, .02); this.model.scale.setScalar(this.scale); },
  };
  const pipe = {
    renderer: { capabilities: { getMaxAnisotropy: () => 8 }, shadowMap: {}, toneMappingExposure: 1 },
    bloom: {}, scene: world,
    g: Object.fromEntries(['uLow','uReveal','uSat','uVig','uGrain','uCA','uWarm','uFlash'].map(k => [k, { value: 0 }])),
    render(dt, time) { calls.render++; return [dt, time]; },
  };
  const env = {
    scene: world, hour: 17.5, night: 0, sunDir: new THREE.Vector3(0, .33, 0),
    sun: new THREE.DirectionalLight(), hemi: new THREE.HemisphereLight(), moon: new THREE.DirectionalLight(),
    windows: [new THREE.MeshStandardMaterial()], neon: [{ mat: new THREE.MeshBasicMaterial() }],
    water: { material: { uniforms: { waterColor: { value: new THREE.Color() }, distortionScale: { value: 0 }, sunColor: { value: new THREE.Color() } } } },
    apply() { this.night = this.hour > 20 ? 1 : 0; this.sun.intensity = 3 * (1 - this.night); this.moon.intensity = this.night; this.scene.environmentIntensity = .75; this.hemi.intensity = .55; this.windows[0].emissiveIntensity = .8; this.neon[0].mat.color.set(0x22dd88); this.water.material.uniforms.sunColor.value.set(0xffdfbb); },
  };
  const game = { params: new URLSearchParams(disabled ? 'visualRenewal=0' : ''), world, player, env, pipe, island: { col: { boxes: [{ x0: 1, x1: 3 }] }, props: [], ramps: [] } };
  const builders = {
    createHeroModel() { calls.builds++; const g = new THREE.Group(); g.name = 'hero-renewal'; g.userData.animate = (...args) => calls.animations.push(args); return g; },
    buildTownRenewal() { calls.builds++; return new THREE.Group(); },
    buildCoastalRenewal(i, t, options) { calls.builds++; assert.equal(options.replaceLegacy, true); return new THREE.Group(); },
  };
  return { THREE, game, calls, old, builders, install: () => installVisualRenewal(game, THREE, builders) };
}
function state(p) { return JSON.stringify([p.pos, p.vel, p.yaw, p.scale, p.sq, p.mode, p.phase, p.speed, p.air]); }

test('replaces only the display model, retires the old mixer and initializes empty safe clips', async () => {
  const f = await fixture(), before = state(f.game.player), physics = JSON.stringify(f.game.island);
  const v = f.install(), p = f.game.player;
  assert.equal(state(p), before); assert.equal(JSON.stringify(f.game.island), physics);
  assert.equal(f.old.parent, null); assert.equal(v.hero.parent, p.root); assert.equal(p.model, v.hero);
  assert.equal(f.calls.stop, 1); assert.equal(f.calls.uncache, 1); assert.equal(f.calls.init, 1);
  assert.deepEqual(p.clips, []); assert.equal(p.action, null);
  assert.equal(f.calls.animations[0][0], 'foot');
  assert.equal(f.game.env.sun.shadow.camera.left, -58);
});

test('one-time installation and URL opt-out do not wrap or allocate twice', async () => {
  const f = await fixture(), v = f.install(), pose = f.game.player.pose, apply = f.game.env.apply, render = f.game.pipe.render;
  assert.equal(f.install(), v); assert.equal(f.calls.builds, 3);
  assert.equal(f.game.player.pose, pose); assert.equal(f.game.env.apply, apply); assert.equal(f.game.pipe.render, render);
  const disabled = await fixture(true), oldPose = disabled.game.player.pose;
  assert.equal(disabled.install(), null); assert.equal(disabled.calls.builds, 0); assert.equal(disabled.game.player.pose, oldPose);
});

test('internal joint animation follows foot, bike, jump, dive and splat without changing physical state', async () => {
  const f = await fixture(); f.install(); const p = f.game.player;
  for (const [mode, air, expected] of [['foot', false, 'foot'], ['foot', true, 'jump'], ['bike', false, 'bike'], ['dive', true, 'dive'], ['splat', false, 'splat']]) {
    p.mode = mode; p.air = air; p.speed = -12;
    const before = state(p); p.pose(1/60);
    assert.equal(state(p), before); const args = f.calls.animations.at(-1);
    assert.equal(args[0], expected); assert.equal(args[1], p.phase); assert.equal(args[2], mode === 'bike' ? 12 : Math.sqrt(5)); assert.equal(args[3], 1/60);
  }
});

test('clock / photo / PMREM changes retain stable absolute lighting, not cumulative darkening', async () => {
  const f = await fixture(); f.install(); const { env, pipe, world } = f.game;
  const values = () => JSON.stringify([env.sun.intensity, env.hemi.intensity, env.moon.intensity, world.environmentIntensity, pipe.renderer.toneMappingExposure, env.neon[0].mat.color, env.windows[0].emissiveIntensity, env.water.material.uniforms.sunColor.value]);
  const day = values(); for (let i=0;i<10;i++) { env.apply(); assert.equal(values(), day); }
  env.hour=21; env.apply(); assert.equal(env.sun.intensity, 0); assert.equal(env.moon.intensity, .85);
  assert.ok(world.environmentIntensity > .1 && world.environmentIntensity < .3);
  assert.equal(pipe.g.uReveal.value, 0); assert.equal(pipe.g.uLow.value, 0);
  env.hour=12; env.apply(); assert.equal(values(), day);
});

test('final bloom cap works in world and photo but preserves gray-mode and upgrade reveal', async () => {
  const f = await fixture(); f.install(); const { pipe, env } = f.game;
  pipe.bloom.strength = .6; assert.deepEqual(pipe.render(.02, 5), [.02, 5]); assert.equal(pipe.bloom.strength, .16);
  env.night=1; pipe.render(0,0); assert.equal(pipe.bloom.strength, .28);
  pipe.g.uLow.value=1; pipe.bloom.strength=0; pipe.render(0,0); assert.equal(pipe.bloom.strength, 0);
  pipe.g.uLow.value=0; f.game.upT=1; pipe.bloom.strength=.24; pipe.render(0,0); assert.equal(pipe.bloom.strength, .24);
  f.game.upT=0; pipe.scene={}; pipe.bloom.strength=.3; pipe.render(0,0); assert.equal(pipe.bloom.strength, .3);
});

test('offline generated block is self-contained JavaScript and rejects absent/importing sources', () => {
  const sources = readSources(), block = renderBlock(sources);
  new vm.Script(block);
  assert.ok(!/^\s*import\s/m.test(block)); assert.ok(!/^export\s/m.test(block));
  assert.equal(SOURCE_FILES.length, 4);
  assert.throws(() => renderBlock({}), /Missing/);
  assert.throws(() => renderBlock({ ...sources, 'hero-renewal.js': "import x from 'https://example.invalid/x';\nexport function createHeroModel(){}" }), /must not import/);
});

test('offline build is byte-preserving outside its block and call, idempotent and concurrency-safe by design', () => {
  const sources = readSources(), original = '<!doctype html>\n<script type="module">\n// story, rivals and saves: 中文 🚲\n' + ANCHOR + '\n  untouchedStory();\n}\n</script>\n';
  const output = updateHtml(original, sources);
  assert.equal(stripOwned(output), original); assert.equal(updateHtml(output, sources), output);
  const revised = { ...sources, 'visual-renewal.js': sources['visual-renewal.js'] + '\n// revised art only\n' };
  const second = updateHtml(output, revised);
  assert.equal(stripOwned(second), original); assert.ok(second.includes('// revised art only'));
  assert.equal(second.split(CALL).length, 2); assert.equal(updateHtml(second, revised), second);
  assert.throws(() => updateHtml(original + ANCHOR, sources), /exactly one/);
  assert.throws(() => updateHtml(original + START, sources), /damaged/);
  assert.throws(() => updateHtml(original + END, sources), /damaged/);
});

test('the authoritative offline HTML is synchronized with all readable art sources', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.equal(updateHtml(html, readSources()), html);
});
