// 诊断：给门禁场景抓 CPU 自耗时分布，判断 50ms 帧间隔是 JS 还是 GPU 卡住。
// 用法：node tools/qa/diag_profile.mjs [url] [毫秒]
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
const windowMs = Number(process.argv[3] || 3000);

async function freePort() {
  const probe = createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const { port } = probe.address();
  await new Promise((resolve, reject) => probe.close(err => err ? reject(err) : resolve()));
  return port;
}

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
  await delay(1500);

  await browser.call('Profiler.enable');
  await browser.call('Profiler.setSamplingInterval', { interval: 100 });
  await browser.call('Profiler.start');
  const t0 = await browser.js('performance.now()');
  await delay(windowMs);
  const t1 = await browser.js('performance.now()');
  const { profile: prof } = await browser.call('Profiler.stop');

  const byId = new Map();
  for (const n of prof.nodes) byId.set(n.id, n);
  const self = new Map();
  const dt = prof.timeDeltas, samples = prof.samples;
  let total = 0;
  for (let i = 0; i < samples.length; i++) {
    const d = dt[i] || 0; total += d;
    const n = byId.get(samples[i]);
    if (!n) continue;
    const cf = n.callFrame;
    const url = (cf.url || '').replace(origin, '').split('/').slice(-2).join('/');
    const key = `${cf.functionName || '(anonymous)'} @ ${url}:${cf.lineNumber + 1}`;
    self.set(key, (self.get(key) || 0) + d);
  }
  const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
  console.log(`window ${((t1 - t0) / 1000).toFixed(2)} s, sampled ${(total / 1e6).toFixed(2)} s`);
  for (const [k, v] of top) console.log(`${(v / 1000).toFixed(1).padStart(8)} ms  ${(100 * v / total).toFixed(1).padStart(5)}%  ${k}`);
  const idle = [...self.entries()].filter(([k]) => /\(idle\)|\(program\)|\(gpu\)/.test(k)).reduce((a, [, v]) => a + v, 0);
  console.log(`idle/program/gpu buckets: ${(idle / 1000).toFixed(1)} ms`);
  console.log(browser.errors().slice(0, 5).join('\n'));
} finally {
  browser?.close();
  server.kill();
  await rm(profile, { recursive: true, force: true, maxRetries: 6, retryDelay: 250 });
}
