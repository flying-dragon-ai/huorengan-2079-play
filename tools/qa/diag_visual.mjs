// 视觉对照：同一个页面、同一帧里先截图，再原地跑静态批处理并重绘，逐像素比对。
// 动画被冻结，所以差异只可能来自批处理本身。
// 用法：node tools/qa/diag_visual.mjs [入口] [入口2 ...]
import { spawn } from 'node:child_process';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { open } from './cdp.mjs';

const viewport = { width: 844, height: 390, deviceScaleFactor: 3, mobile: true,
  screenWidth: 844, screenHeight: 390, screenOrientation: { type: 'landscapePrimary', angle: 90 } };
const pages = process.argv.slice(2).length ? process.argv.slice(2) : ['index.html?view=gate&hour=17&batch=0'];
const outDir = '.cache/visual';

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
const profile = await mkdtemp(join(tmpdir(), 'hrg-vis-'));
await mkdir(outDir, { recursive: true });
try {
  let ready = false;
  for (let i = 0; i < 100 && server.exitCode === null; ++i) {
    try { ready = (await fetch(`${origin}/index.html`, { method: 'HEAD' })).ok; } catch { /* 启动中 */ }
    if (ready) break;
    await delay(100);
  }
  if (!ready) throw Error('server failed to start');
  for (const [i, page] of pages.entries()) {
    const b = await open(`${origin}/${page}`, { port: await freePort(), w: viewport.width, h: viewport.height, profile: join(profile, 'p' + i) });
    try {
      for (const [name, params] of [['Emulation.setDeviceMetricsOverride', viewport], ['Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }]]) {
        const r = await b.call(name, params);
        if (r.error) throw Error(`${name}: ${r.error.message}`);
      }
      const ok = await b.until(`document.getElementById('loading')?.classList.contains('off') && window.__game?.photo === true`, 120000);
      if (!ok) throw Error(`${page}: not ready`);
      await delay(2500);
      // 冻结循环：最后一帧留在画布上
      await b.js('window.__game.loop = () => {}; true');
      await delay(300);
      const before = await b.call('Page.captureScreenshot', { format: 'png' });
      const stats = await b.js(`(async () => {
        const g = window.__game;
        const { batchStatic } = await import('/src/gfx/batch.js');
        const res = batchStatic(g.world, { owners: [g], structural: [g.island.root] });
        g.pipe.render(0, g.time);
        return res;
      })()`);
      await delay(300);
      const after = await b.call('Page.captureScreenshot', { format: 'png' });
      const name = `${i}-${page.replace(/[^a-z0-9]+/gi, '_')}`;
      await writeFile(`${outDir}/${name}-before.png`, Buffer.from(before.data, 'base64'));
      await writeFile(`${outDir}/${name}-after.png`, Buffer.from(after.data, 'base64'));
      const diff = await b.js(`(async () => {
        const load = (b64) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = 'data:image/png;base64,' + b64; });
        const [a, c] = await Promise.all([load(${JSON.stringify(before.data)}), load(${JSON.stringify(after.data)})]);
        const px = (im) => { const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height;
          const x = cv.getContext('2d'); x.drawImage(im, 0, 0); return x.getImageData(0, 0, im.width, im.height).data; };
        const A = px(a), C = px(c);
        let sum = 0, max = 0, over8 = 0, n = A.length / 4;
        for (let k = 0; k < A.length; k += 4) {
          const d = Math.max(Math.abs(A[k] - C[k]), Math.abs(A[k + 1] - C[k + 1]), Math.abs(A[k + 2] - C[k + 2]));
          sum += d; if (d > max) max = d; if (d > 8) over8++;
        }
        return { size: [a.width, a.height], meanAbs: +(sum / n).toFixed(3), max, pctOver8: +(100 * over8 / n).toFixed(3) };
      })()`);
      console.log(name, JSON.stringify({ batch: stats && { batches: stats.batches, merged: stats.merged }, diff }));
    } finally {
      b.close();
    }
  }
} finally {
  server.kill();
  try { await rm(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 }); } catch { /* 退出竞态 */ }
}
