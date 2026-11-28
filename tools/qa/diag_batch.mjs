// 诊断：按材质数值签名分组后静态合并，估算 draw call 与 CPU 还能降多少。
// 用法：node tools/qa/diag_batch.mjs [url]
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
  const countCalls = async () => {
    const save = r.info.autoReset; r.info.autoReset = false; r.info.reset();
    await frames(2);
    const out = { calls: r.info.render.calls / 2, triangles: r.info.render.triangles / 2 };
    r.info.autoReset = save; return out;
  };

  const out = {};
  out.before = { ...(await measure()), ...(await countCalls()) };

  const tex = (m) => m ? (m.uuid || 'none') : 'none';
  const sig = (m) => [m.type, m.color ? m.color.getHexString() : '', m.emissive ? m.emissive.getHexString() : '',
    m.emissiveIntensity ?? '', m.roughness ?? '', m.metalness ?? '', tex(m.map), tex(m.normalMap), tex(m.roughnessMap),
    tex(m.emissiveMap), tex(m.aoMap), tex(m.alphaMap), tex(m.envMap), m.transparent ? 1 : 0, m.opacity,
    m.side, m.flatShading ? 1 : 0, m.vertexColors ? 1 : 0, m.envMapIntensity ?? '', m.alphaTest,
    m.depthWrite ? 1 : 0, m.blending, m.polygonOffset ? 1 : 0].join('|');
  const gsig = (geo) => Object.keys(geo.attributes).sort().map((k) => k + geo.attributes[k].itemSize).join(',') + '|' + (geo.index ? 'i' : 'n');

  const hiddenAncestor = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return true; return false; };
  const groups = new Map();
  const matCount = new Set();
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || Array.isArray(o.material)) return;
    if (!o.geometry || !o.material || o.material.transparent || hiddenAncestor(o)) return;
    if (o.material.alphaTest > 0) return;
    if (o.geometry.morphAttributes && Object.keys(o.geometry.morphAttributes).length) return;
    matCount.add(o.material.uuid);
    const key = [sig(o.material), gsig(o.geometry), o.castShadow ? 1 : 0, o.receiveShadow ? 1 : 0, o.renderOrder].join('#');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(o);
  });
  const sigCount = new Set([...groups.keys()].map((k) => k.split('#')[0])).size;
  out.materials = { unique: matCount.size, bySignature: sigCount, groups: groups.size };

  let merged = 0, removed = 0, callsBefore = 0;
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    callsBefore += list.length;
    const geos = list.map((m) => { const geo = m.geometry.clone(); geo.applyMatrix4(m.matrixWorld);
      for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k); return geo; });
    const one = mergeGeometries(geos, false);
    if (!one) continue;
    const src = list[0];
    const mesh = new THREE.Mesh(one, src.material);
    mesh.castShadow = src.castShadow; mesh.receiveShadow = src.receiveShadow; mesh.renderOrder = src.renderOrder;
    mesh.name = 'batch:' + merged;
    scene.add(mesh);
    for (const m of list) { m.parent.remove(m); removed++; }
    merged++;
  }
  let objects = 0; scene.traverse(() => objects++);
  out.after = { merged, removed, objects, ...(await measure()), ...(await countCalls()) };

  const sh = r.shadowMap.enabled;
  r.shadowMap.enabled = false; r.shadowMap.needsUpdate = true;
  out.afterNoShadow = { ...(await measure()), ...(await countCalls()) };
  r.shadowMap.enabled = sh; r.shadowMap.needsUpdate = true;

  pipe.bloom.enabled = false;
  out.afterNoBloom = { ...(await measure()), ...(await countCalls()) };
  pipe.bloom.enabled = true;

  const pr0 = r.getPixelRatio();
  r.setPixelRatio(pr0 * 0.5); pipe.composer.setPixelRatio(pr0 * 0.5); pipe.composer.setSize(innerWidth, innerHeight);
  out.afterHalfRes = { ...(await measure()), ...(await countCalls()) };
  r.setPixelRatio(pr0); pipe.composer.setPixelRatio(pr0); pipe.composer.setSize(innerWidth, innerHeight);

  let transparent = 0, skinned = 0, instanced = 0, other = 0;
  scene.traverse((o) => {
    if (o.isMesh) { if (o.isSkinnedMesh) skinned++; else if (o.isInstancedMesh) instanced++;
      else if (o.material && !Array.isArray(o.material) && o.material.transparent) transparent++; }
  });
  out.remaining = { transparent, skinned, instanced };
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
