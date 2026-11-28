// 诊断：打印门禁场景的渲染统计（draw call、对象数、材质数、程序数）与逐帧 CPU 归属。
// 用法：node tools/qa/diag_scene.mjs [url]
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
  await delay(2500);

  const stats = await browser.js(`(() => {
    const g = window.__game, r = g.pipe.renderer, s = g.pipe.scene || g.world;
    const counts = { objects: 0, meshes: 0, skinned: 0, instanced: 0, sprites: 0, points: 0, lines: 0, lights: 0, groups: 0 };
    const materials = new Set(), geometries = new Set(), textures = new Set();
    const byType = new Map(), byGeo = new Map();
    s.traverse(o => {
      counts.objects++;
      byType.set(o.type, (byType.get(o.type) || 0) + 1);
      if (o.isMesh) { counts.meshes++; if (o.isSkinnedMesh) counts.skinned++; if (o.isInstancedMesh) counts.instanced++;
        if (o.geometry) { geometries.add(o.geometry.uuid); const k = o.geometry.type + ':' + (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position?.count) + ':inst' + (o.count || 1); byGeo.set(k, (byGeo.get(k) || 0) + 1); }
        const m = o.material; (Array.isArray(m) ? m : [m]).forEach(x => x && materials.add(x.uuid)); }
      if (o.isSprite) counts.sprites++;
      if (o.isPoints) counts.points++;
      if (o.isLine) counts.lines++;
      if (o.isLight) counts.lights++;
      if (o.isGroup) counts.groups++;
    });
    for (const m of []) void m;
    const mats = []; const seen = new Set();
    s.traverse(o => { const m = o.material; if (!m) return; for (const x of (Array.isArray(m) ? m : [m])) { if (seen.has(x.uuid)) continue; seen.add(x.uuid); mats.push({ type: x.type, side: x.side, transparent: !!x.transparent, vertexColors: !!x.vertexColors, map: !!x.map, count: 0 }); } });
    return {
      info: JSON.parse(JSON.stringify(r.info)),
      programs: r.info.programs?.length,
      counts, materialCount: materials.size, geometryCount: geometries.size,
      byType: [...byType.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12),
      geoGroups: byGeo.size,
      topGeo: [...byGeo.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8),
      shadowMap: r.shadowMap.enabled, shadowType: r.shadowMap.type,
      pixelRatio: r.getPixelRatio(), size: [r.domElement.width, r.domElement.height],
      camPos: g.pipe.camera.position.toArray().map(v => +v.toFixed(1)),
      children: s.children.length,
    };
  })()`);
  console.log(JSON.stringify(stats, null, 1));
  console.log('errors:', browser.errors().slice(0, 5).join(' | ') || 'none');
} finally {
  browser?.close();
  server.kill();
  await rm(profile, { recursive: true, force: true, maxRetries: 6, retryDelay: 250 });
}
