// 诊断：把 50ms 帧间隔拆到阴影 / 后期 / 分辨率 / 场景绘制几个来源上。
// 用法：node tools/qa/diag_split.mjs [url]
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
  const g = window.__game, pipe = g.pipe, r = pipe.renderer;
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
    const p95 = pct(runs.map((d) => pct(d, 0.95)), 0.5);
    const calls = r.info.render.calls;
    return { p95: +p95.toFixed(2), calls };
  };
  const out = {};
  const origRender = pipe.render;
  const origShadow = r.shadowMap.enabled;
  const origPr = r.getPixelRatio();

  out.baseline = await measure();

  r.shadowMap.enabled = false; r.shadowMap.needsUpdate = true;
  out.noShadow = await measure();
  r.shadowMap.enabled = origShadow; r.shadowMap.needsUpdate = true;

  pipe.bloom.enabled = false;
  out.noBloom = await measure();
  pipe.bloom.enabled = true;

  pipe.render = (dt, t) => { pipe.g.uTime.value = t; r.render(pipe.scene, pipe.camera); };
  out.directNoComposer = await measure();
  pipe.render = origRender;

  r.setPixelRatio(origPr * 0.6); pipe.composer.setPixelRatio(origPr * 0.6); pipe.composer.setSize(innerWidth, innerHeight);
  out.halfRes = await measure();
  r.setPixelRatio(origPr); pipe.composer.setPixelRatio(origPr); pipe.composer.setSize(innerWidth, innerHeight);

  // 只留可见对象：统计视锥内对象数，估算合并空间
  const cam = pipe.camera; cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const THREE_Frustum = cam.frustum || null;
  let total = 0, mesh = 0, inFrustum = 0;
  const byMat = new Map();
  pipe.scene.traverse((o) => { total++; if (o.isMesh) { mesh++; byMat.set(o.material?.uuid, (byMat.get(o.material?.uuid) || 0) + 1); } });
  out.stats = { total, mesh, materials: byMat.size,
    biggest: [...byMat.values()].sort((a, b) => b - a).slice(0, 5) };

  out.baseline2 = await measure();
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
