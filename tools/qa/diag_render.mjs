// 诊断：直接量 pipe.render() 的 CPU 耗时（毫秒级），绕开 rAF 间隔被 16.7ms 量化的遮挡。
// 用法：node tools/qa/diag_render.mjs [url]
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { open } from './cdp.mjs';

const viewport = { width: 844, height: 390, deviceScaleFactor: 3, mobile: true,
  screenWidth: 844, screenHeight: 390, screenOrientation: { type: 'landscapePrimary', angle: 90 } };
const page = process.argv[2] || 'index.html?view=gate&hour=17';

async function freePort() {
  const probe = createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const { port } = probe.address();
  await new Promise((resolve, reject) => probe.close(err => err ? reject(err) : resolve()));
  return port;
}

const probeJs = `(async () => {
  const THREE = await import('three');
  const { mergeGeometries } = await import('three/addons/utils/BufferGeometryUtils.js');
  const g = window.__game, pipe = g.pipe, r = pipe.renderer, scene = pipe.scene;
  const q = (v, p) => { const s = [...v].sort((a, b) => a - b); return +s[Math.min(s.length - 1, Math.ceil(s.length * p) - 1)].toFixed(2); };
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const frames = (n) => new Promise((res) => { let k = 0; const tick = () => (++k >= n ? res() : requestAnimationFrame(tick)); requestAnimationFrame(tick); });

  let rec = null;
  const orig = pipe.render;
  pipe.render = function (dt, t) {
    const a = performance.now();
    orig.call(pipe, dt, t);
    if (rec) { rec.cpu.push(performance.now() - a); rec.frame.push(a); }
  };
  const measure = async (n = 120) => {
    await wait(700);
    rec = { cpu: [], frame: [] };
    await frames(n);
    const { cpu, frame } = rec; rec = null;
    const gaps = frame.slice(1).map((v, i) => v - frame[i]);
    return { cpu_p50: q(cpu, .5), cpu_p95: q(cpu, .95), gap_p50: q(gaps, .5), gap_p95: q(gaps, .95) };
  };

  const out = { drawCalls: null };
  const origAutoReset = r.info.autoReset;
  r.info.autoReset = false; r.info.reset();
  await frames(3);
  out.drawCalls = r.info.render.calls; out.triangles = r.info.render.triangles;
  r.info.autoReset = origAutoReset;

  out.baseline = await measure();

  const shadow = r.shadowMap.enabled;
  r.shadowMap.enabled = false; r.shadowMap.needsUpdate = true;
  out.noShadow = await measure();
  r.shadowMap.enabled = shadow; r.shadowMap.needsUpdate = true;

  pipe.bloom.enabled = false;
  out.noBloom = await measure();
  pipe.bloom.enabled = true;

  const pr = r.getPixelRatio();
  r.setPixelRatio(pr * 0.5); pipe.composer.setPixelRatio(pr * 0.5); pipe.composer.setSize(innerWidth, innerHeight);
  out.halfRes = await measure();
  r.setPixelRatio(pr); pipe.composer.setPixelRatio(pr); pipe.composer.setSize(innerWidth, innerHeight);

  const savedComposerRender = pipe.composer.render;
  pipe.composer.render = () => r.render(pipe.scene, pipe.camera);
  out.directNoComposer = await measure();
  pipe.composer.render = savedComposerRender;

  // 静态合并
  const hiddenAncestor = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return true; return false; };
  const sig = (geo) => Object.keys(geo.attributes).sort().map((k) => k + geo.attributes[k].itemSize).join(',') + '|' + (geo.index ? 'i' : 'n');
  const groups = new Map();
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || Array.isArray(o.material)) return;
    if (!o.geometry || !o.material || o.material.transparent || hiddenAncestor(o)) return;
    if (o.material.alphaTest > 0) return;
    const key = [o.material.uuid, sig(o.geometry), o.castShadow ? 1 : 0, o.receiveShadow ? 1 : 0, o.renderOrder].join('#');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(o);
  });
  let merged = 0, removed = 0;
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const geos = list.map((m) => { const geo = m.geometry.clone(); geo.applyMatrix4(m.matrixWorld);
      for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k); return geo; });
    const one = mergeGeometries(geos, false);
    if (!one) continue;
    const src = list[0];
    const mesh = new THREE.Mesh(one, src.material);
    mesh.castShadow = src.castShadow; mesh.receiveShadow = src.receiveShadow; mesh.renderOrder = src.renderOrder;
    scene.add(mesh);
    for (const m of list) { m.parent.remove(m); removed++; }
    merged++;
  }
  out.mergedInfo = { merged, removed };
  out.afterMerge = await measure();
  return out;
})()`;

const port = await freePort(), origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['scripts/serve.mjs', '--port', String(port)], { env: { ...process.env, SERVE_HOST: '127.0.0.1' }, stdio: 'ignore' });
const profile = await mkdtemp(join(tmpdir(), 'hrg-diag-'));
let browser;
try {
  let ready = false;
  for (let i = 0; i < 100 && server.exitCode === null; ++i) {
    try { ready = (await fetch(`${origin}/index.html`, { method: 'HEAD' })).ok; } catch { /* 启动中 */ }
    if (ready) break;
    await delay(100);
  }
  if (!ready) throw Error('server failed to start');
  browser = await open(`${origin}/${page}`, { port: await freePort(), w: viewport.width, h: viewport.height, profile });
  for (const [name, params] of [['Emulation.setDeviceMetricsOverride', viewport], ['Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }]]) {
    const r = await browser.call(name, params);
    if (r.error) throw Error(`${name}: ${r.error.message}`);
  }
  const ok = await browser.until(`document.getElementById('loading')?.classList.contains('off') && window.__game?.photo === true`, 120000);
  if (!ok) throw Error('not ready: ' + browser.logs.slice(-3).join('; '));
  const res = await browser.js(probeJs);
  console.log(JSON.stringify(res, null, 1));
  console.log('errors:', browser.errors().slice(0, 5).join(' | ') || 'none');
} finally {
  browser?.close();
  server.kill();
  await rm(profile, { recursive: true, force: true, maxRetries: 6, retryDelay: 250 });
}
