// 诊断：把静态不透明网格按材质合并，看 per-object CPU 开销占多少帧时间。
// 用法：node tools/qa/diag_merge.mjs [url]
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
  const pct = (v, q) => [...v].sort((a, b) => a - b)[Math.ceil(v.length * q) - 1];
  const sample = (n) => new Promise((res, rej) => {
    let last; const dt = []; const to = setTimeout(() => rej(Error('sample timeout')), 60000);
    const tick = (t) => { if (last !== undefined) dt.push(t - last); last = t;
      if (dt.length < n) requestAnimationFrame(tick); else { clearTimeout(to); res(dt); } };
    requestAnimationFrame(tick);
  });
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const measure = async () => {
    await wait(1200);
    const runs = [];
    for (let i = 0; i < 3; i++) runs.push(await sample(120));
    return +pct(runs.map((d) => pct(d, 0.95)), 0.5).toFixed(2);
  };

  const before = { p95: await measure(), objects: 0 };
  scene.traverse(() => before.objects++);

  // 祖先不可见的也排除
  const hiddenAncestor = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return true; return false; };
  const sig = (geo) => Object.keys(geo.attributes).sort().map((k) => k + geo.attributes[k].itemSize).join(',') + '|' + (geo.index ? 'i' : 'n');
  const groups = new Map();
  const picked = [];
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || Array.isArray(o.material)) return;
    if (!o.geometry || !o.material || o.material.transparent || hiddenAncestor(o)) return;
    if (o.material.alphaTest > 0) return;
    if (o.geometry.morphAttributes && Object.keys(o.geometry.morphAttributes).length) return;
    const key = [o.material.uuid, sig(o.geometry), o.castShadow ? 1 : 0, o.receiveShadow ? 1 : 0, o.renderOrder].join('#');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(o);
    picked.push(o);
  });

  let merged = 0, removed = 0, tris = 0;
  const failures = [];
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const geos = [];
    for (const m of list) {
      const geo = m.geometry.clone();
      geo.applyMatrix4(m.matrixWorld);
      for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
      geos.push(geo);
    }
    const one = mergeGeometries(geos, false);
    if (!one) { failures.push(list.length); continue; }
    const src = list[0];
    const mesh = new THREE.Mesh(one, src.material);
    mesh.castShadow = src.castShadow; mesh.receiveShadow = src.receiveShadow; mesh.renderOrder = src.renderOrder;
    mesh.name = 'batched:' + (src.material.name || src.material.uuid).slice(0, 8);
    scene.add(mesh);
    for (const m of list) { m.parent.remove(m); removed++; }
    merged++;
    tris += one.index ? one.index.count / 3 : one.attributes.position.count / 3;
  }
  const after = { p95: await measure(), objects: 0 };
  scene.traverse(() => after.objects++);
  return { before, after, picked: picked.length, groups: groups.size, merged, removed, tris, failures: failures.slice(0, 5),
    calls: r.info.render.calls };
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
