// Desktop Chromium, real application, landscape viewport. Not a phone certification.
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { open } from './cdp.mjs';

const viewport = { width: 844, height: 390, deviceScaleFactor: 3, mobile: true,
  screenWidth: 844, screenHeight: 390, screenOrientation: { type: 'landscapePrimary', angle: 90 } };
const routes = [
  { id: 'game-gate', page: 'index.html?view=gate&hour=17', ready: 'window.__game?.photo === true' },
  { id: 'viewer-overview', page: 'viewer.html', ready: 'document.querySelector("#view-select")?.options.length > 1' },
];
const rounds = 3, frames = 120;
const percentile = (values, q) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * q) - 1];
const outputDir = '.cache/autoresearch';
const id = new Date().toISOString().replace(/[:.]/g, '-');

async function freePort() {
  const probe = createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const { port } = probe.address();
  await new Promise((resolve, reject) => probe.close(err => err ? reject(err) : resolve()));
  return port;
}

// Capture uncapped foreground rAF intervals, not the game's clamped simulation dt or smoothed FPS.
function sample(n) {
  return `new Promise((resolve, reject) => {
    let last; const dt = []; const timeout = setTimeout(() => reject(Error('frame sample timed out')), 75000);
    function tick(t) {
      if (document.hidden) { clearTimeout(timeout); reject(Error('page hidden during sample')); return; }
      if (last !== undefined) dt.push(t - last);
      last = t;
      if (dt.length < ${n}) requestAnimationFrame(tick);
      else { clearTimeout(timeout); resolve(dt); }
    }
    requestAnimationFrame(tick);
  })`;
}

async function measure(browser, origin, route) {
  await browser.call('Page.navigate', { url: `${origin}/${route.page}` });
  const ready = await browser.until(`location.pathname.endsWith('/${route.page.split('?')[0]}') && document.getElementById('loading')?.classList.contains('off') && (${route.ready})`, 120000);
  if (!ready) throw Error(`${route.id}: not ready: ${browser.logs.slice(-3).join('; ')}`);
  const info = await browser.js(`(() => {
    const c = document.getElementById('c'), gl = c.getContext('webgl2');
    if (!gl || gl.isContextLost() || !c.width || !c.height) throw Error('no live drawing buffer');
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    return { width:c.width, height:c.height, css:[innerWidth, innerHeight], dpr:devicePixelRatio,
      gpu:dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      version:gl.getParameter(gl.VERSION), ua:navigator.userAgent };
  })()`);
  if (!info || info.css[0] !== viewport.width || info.css[1] !== viewport.height) throw Error(`${route.id}: invalid viewport/context: ${JSON.stringify(info)}`);
  if (!(await browser.js(sample(30)))) throw Error(`${route.id}: warm-up failed`);
  const samples = [];
  for (let i = 0; i < rounds; ++i) {
    const d = await browser.js(sample(frames));
    if (!Array.isArray(d) || d.length !== frames || d.some(v => !Number.isFinite(v) || v <= 0)) throw Error(`${route.id}: invalid samples`);
    samples.push(d);
  }
  const errors = browser.errors();
  if (errors.length) throw Error(`${route.id}: ${errors.slice(-4).join('; ')}`);
  await browser.shot(`${outputDir}/${id}-${route.id}.jpg`);
  return { id: route.id, info, samples, p95:percentile(samples.map(d => percentile(d, .95)), .5), p99:percentile(samples.map(d => percentile(d, .99)), .5) };
}

const port = await freePort(), origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['scripts/serve.mjs', '--port', String(port)], { env: { ...process.env, SERVE_HOST:'127.0.0.1' }, stdio:'ignore' });
try {
  let ready = false;
  for (let i = 0; i < 100 && server.exitCode === null; ++i) {
    try { ready = (await fetch(`${origin}/index.html`, { method:'HEAD' })).ok; } catch { /* Starting. */ }
    if (ready) break;
    await delay(100);
  }
  if (!ready) throw Error('Local benchmark server failed to start');
  await mkdir(outputDir, { recursive:true });
  const records = [];
  for (const route of routes) {
    const profile = await mkdtemp(join(tmpdir(), 'hrg-mobile-bench-'));
    let browser;
    try {
      browser = await open('about:blank', { port:await freePort(), w:viewport.width, h:viewport.height, profile });
      for (const [name, params] of [['Emulation.setDeviceMetricsOverride', viewport], ['Emulation.setTouchEmulationEnabled', { enabled:true, maxTouchPoints:5 }]]) {
        const result = await browser.call(name, params);
        if (result.error) throw Error(`${name}: ${result.error.message}`);
      }
      records.push(await measure(browser, origin, route));
    } finally {
      browser?.close();
      await rm(profile, { recursive:true, force:true, maxRetries:6, retryDelay:250 });
    }
  }
  await writeFile(`${outputDir}/${id}.json`, JSON.stringify({ protocol:1, viewport, rounds, frames, records }));
  console.log(`Raw intervals and reference views: ${outputDir}/${id}`);
  for (const entry of records) console.log(`${entry.id}: ${entry.info.width}x${entry.info.height}, ${entry.info.gpu}; p95=${entry.p95.toFixed(2)}, p99=${entry.p99.toFixed(2)} ms`);
  console.log(`METRIC worst_scene_p95_ms=${Math.max(...records.map(r => r.p95)).toFixed(3)}`);
  console.log(`METRIC worst_scene_p99_ms=${Math.max(...records.map(r => r.p99)).toFixed(3)}`);
} finally { server.kill(); }
