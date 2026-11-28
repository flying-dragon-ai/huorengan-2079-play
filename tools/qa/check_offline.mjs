// 离线单文件验收：以 file:// 打开 dist/活人感2079.html，确认能启动、8 街区齐全、零报错。
// 单文件版走 data-models="procedural"，不读任何外部 GLB，所以 file:// 下应当完全自足。
// 用法：node tools/qa/check_offline.mjs [输出目录]
import { open } from './cdp.mjs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

const out = process.argv[2] || 'tests/e2e/shots/offline';
const file = resolve('dist/活人感2079.html');
if (!existsSync(file)) {
  console.error('找不到 ' + file + '，先跑 npm run build');
  process.exit(1);
}
const url = pathToFileURL(file).href;
console.log('打开 ' + url);

const b = await open(url, { port: 9362 });
const S = `JSON.stringify({
  models: document.documentElement.dataset.models,
  s: __game && __game.state,
  ph: __game && __game.phase,
  fps: __game && Math.round(__game.fps),
  meter: __game && __game.meter,
  districts: __game && __game.island && __game.island.districts.map((d) => d.id || d.constructor.name),
  gags: __game && __game.districts && __game.districts.gags,
})`;

let verdict = 'FAIL';
try {
  const booted = await b.until(`window.__game && document.getElementById('loading').classList.contains('off')`, 90000);
  console.log('booted=' + booted);
  const st = JSON.parse(await b.js(S));
  console.log('state ' + JSON.stringify(st));

  await b.click(800, 380);
  await b.sleep(6000);
  const after = JSON.parse(await b.js(S));
  console.log('after-start ' + JSON.stringify(after));
  await b.shot(`${out}/offline_start.jpg`);

  const checks = [
    ['data-models=procedural', st.models === 'procedural'],
    ['__game 已挂载', !!st.s],
    ['8 个街区', Array.isArray(st.districts) && st.districts.length === 8],
    ['点击后离开标题', after.s !== 'title'],
    ['有帧率', typeof after.fps === 'number' && after.fps > 0],
  ];
  for (const [name, ok] of checks) console.log((ok ? 'PASS ' : 'FAIL ') + name);
  verdict = checks.every(([, ok]) => ok) ? 'PASS' : 'FAIL';
} finally {
  console.log('---- errors ----');
  console.log(b.errors().join('\n') || '(none)');
  console.log('---- warnings ----');
  console.log(b.logs.filter((l) => /warn/.test(l)).slice(0, 10).join('\n') || '(none)');
  console.log('---- verdict ----');
  console.log(verdict + (b.errors().length === 0 ? ' (零报错)' : ' (有报错)'));
  b.close();
}
