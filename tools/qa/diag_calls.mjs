// 诊断：合并后剩下的 draw call 是谁的。静态按材质归类 + 隐藏分类后的实测差值。
// 用法：node tools/qa/diag_calls.mjs [url]
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
  const g = window.__game, pipe = g.pipe, r = pipe.renderer, scene = pipe.scene;
  const frames = (n) => new Promise((res) => { let k = 0; const tick = () => (++k >= n ? res() : requestAnimationFrame(tick)); requestAnimationFrame(tick); });
  const calls = async () => { const s = r.info.autoReset; r.info.autoReset = false; r.info.reset(); await frames(2);
    const n = r.info.render.calls / 2; r.info.autoReset = s; return n; };

  const out = { total: await calls() };

  // 静态归类：每个 mesh 产生几个 draw call
  const perMat = new Map();
  const kind = { transparent: 0, alphaTest: 0, skinned: 0, instanced: 0, sprite: 0, points: 0, line: 0, multiMat: 0, plain: 0 };
  scene.traverse((o) => {
    if (o.isSprite) { kind.sprite++; return; }
    if (o.isPoints) { kind.points++; return; }
    if (o.isLine) { kind.line++; return; }
    if (!o.isMesh) return;
    let n = 1;
    if (Array.isArray(o.material)) { n = o.material.length; kind.multiMat++; }
    else if (o.geometry.groups && o.geometry.groups.length > 1) n = o.geometry.groups.length;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (o.isSkinnedMesh) kind.skinned++;
    else if (o.isInstancedMesh) kind.instanced++;
    else if (m && m.transparent) kind.transparent++;
    else if (m && m.alphaTest > 0) kind.alphaTest++;
    else kind.plain++;
    const key = (m && (m.name || m.type)) + ':' + (m && m.color ? m.color.getHexString() : '');
    perMat.set(key, (perMat.get(key) || 0) + n);
  });
  out.kind = kind;
  out.topMaterials = [...perMat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);

  // 实测差值：隐藏一类看 calls 掉多少
  const deltas = {};
  const hideWhere = (pred) => { const hid = []; scene.traverse((o) => { if (pred(o) && o.visible) { o.visible = false; hid.push(o); } }); return () => hid.forEach((o) => (o.visible = true)); };
  const tryHide = async (name, pred) => { const restore = hideWhere(pred); deltas[name] = out.total - (await calls()); restore(); };
  await tryHide('sprites', (o) => o.isSprite);
  await tryHide('transparent', (o) => o.isMesh && o.material && !Array.isArray(o.material) && o.material.transparent);
  await tryHide('skinned', (o) => o.isSkinnedMesh);
  await tryHide('instanced', (o) => o.isInstancedMesh);
  await tryHide('batched', (o) => typeof o.name === 'string' && o.name.startsWith('batch:'));
  out.deltas = deltas;
  out.afterRestore = await calls();
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
