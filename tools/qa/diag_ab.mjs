// A/B 对照：交替加载两个入口，量 pipe.render() 的 CPU 耗时与 draw call。
// 交替是为了让漂移（GPU 降频、后台负载）落在两边，而不是全压在某一侧。
// 用法：node tools/qa/diag_ab.mjs "index.html?view=gate&hour=17" "index.html?view=gate&hour=17&batch=0" [轮数]
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
const [pageA, pageB] = [process.argv[2] || 'index.html?view=gate&hour=17', process.argv[3] || 'index.html?view=gate&hour=17&batch=0'];
const rounds = Number(process.argv[4] || 3);

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
  const q = (v, p) => { const s = [...v].sort((a, b) => a - b); return +s[Math.min(s.length - 1, Math.ceil(s.length * p) - 1)].toFixed(2); };
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const frames = (n) => new Promise((res) => { let k = 0; const tick = () => (++k >= n ? res() : requestAnimationFrame(tick)); requestAnimationFrame(tick); });
  let rec = null;
  const orig = pipe.render;
  pipe.render = function (dt, t) { const a = performance.now(); orig.call(pipe, dt, t); if (rec) { rec.cpu.push(performance.now() - a); rec.frame.push(a); } };
  await wait(700);
  rec = { cpu: [], frame: [] };
  await frames(150);
  const { cpu, frame } = rec; rec = null;
  const gaps = frame.slice(1).map((v, i) => v - frame[i]);
  const s = r.info.autoReset; r.info.autoReset = false; r.info.reset(); await frames(2);
  const calls = r.info.render.calls / 2, tris = r.info.render.triangles / 2; r.info.autoReset = s;
  let objects = 0; pipe.scene.traverse(() => objects++);
  return { cpu_p50: q(cpu, .5), cpu_p95: q(cpu, .95), gap_p50: q(gaps, .5), gap_p95: q(gaps, .95),
    calls, tris, objects, batch: g.batch || null, errors: 0 };
})()`;

const port = await freePort(), origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['scripts/serve.mjs', '--port', String(port)], { env: { ...process.env, SERVE_HOST: '127.0.0.1' }, stdio: 'ignore' });
const profile = await mkdtemp(join(tmpdir(), 'hrg-ab-'));
const runs = { A: [], B: [] };
try {
  let ready = false;
  for (let i = 0; i < 100 && server.exitCode === null; ++i) {
    try { ready = (await fetch(`${origin}/index.html`, { method: 'HEAD' })).ok; } catch { /* 启动中 */ }
    if (ready) break;
    await delay(100);
  }
  if (!ready) throw Error('server failed to start');
  for (let k = 0; k < rounds; ++k) {
    for (const [tag, page] of [['A', pageA], ['B', pageB]]) {
      let browser;
      try {
        browser = await open(`${origin}/${page}`, { port: await freePort(), w: viewport.width, h: viewport.height, profile: join(profile, `${tag}${k}`) });
        for (const [name, params] of [['Emulation.setDeviceMetricsOverride', viewport], ['Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }]]) {
          const r = await browser.call(name, params);
          if (r.error) throw Error(`${name}: ${r.error.message}`);
        }
        const ok = await browser.until(`document.getElementById('loading')?.classList.contains('off') && window.__game?.photo === true`, 120000);
        if (!ok) throw Error(`${tag}: not ready: ${browser.logs.slice(-3).join('; ')}`);
        const res = await browser.js(probeJs);
        const errs = browser.errors();
        console.log(`${tag}#${k}`, JSON.stringify(res), errs.length ? 'ERR ' + errs.slice(0, 2).join(' | ') : '');
        runs[tag].push(res);
      } finally {
        browser?.close();
      }
    }
  }
  const med = (arr, k) => { const v = arr.map((x) => x[k]).sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
  console.log('---');
  for (const tag of ['A', 'B']) {
    console.log(`${tag}: cpu_p50=${med(runs[tag], 'cpu_p50')} cpu_p95=${med(runs[tag], 'cpu_p95')} gap_p50=${med(runs[tag], 'gap_p50')} gap_p95=${med(runs[tag], 'gap_p95')} calls=${med(runs[tag], 'calls')} objects=${med(runs[tag], 'objects')}`);
  }
} finally {
  server.kill();
  await rm(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
}
