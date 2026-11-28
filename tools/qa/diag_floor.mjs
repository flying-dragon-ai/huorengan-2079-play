// 诊断：找帧间隔地板。渲染全关、循环全关、空白页三种情况的 rAF 间隔分布。
// 用法：node tools/qa/diag_floor.mjs [url]
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
  const stats = (v) => { const s = [...v].sort((a, b) => a - b);
    return { p50: +s[Math.floor(s.length / 2)].toFixed(2), p95: +s[Math.ceil(s.length * 0.95) - 1].toFixed(2),
      min: +s[0].toFixed(2), max: +s[s.length - 1].toFixed(2), n: s.length }; };
  const sample = (n) => new Promise((res, rej) => {
    let last; const dt = []; const to = setTimeout(() => rej(Error('sample timeout')), 60000);
    const tick = (t) => { if (last !== undefined) dt.push(t - last); last = t;
      if (dt.length < n) requestAnimationFrame(tick); else { clearTimeout(to); res(dt); } };
    requestAnimationFrame(tick);
  });
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const measure = async () => { await wait(1200); return stats(await sample(180)); };
  const out = {};

  out.normal = await measure();

  const origRender = pipe.render;
  pipe.render = () => {};
  out.noRender = await measure();
  pipe.render = origRender;

  // 只保留 rAF 循环，跳过 updatePhoto / env / scenery
  const origPhoto = g.updatePhoto;
  g.updatePhoto = () => {};
  out.noUpdateNoRender = await measure();
  g.updatePhoto = origPhoto;

  // 完全停掉游戏循环：用一个独立的 rAF 采样
  g.loop = () => {};
  out.loopDead = await measure();

  out.limiter = { dtClamp: 1 / 20, lastNow: g.lastNow, fps: g.fps, time: g.time };
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
