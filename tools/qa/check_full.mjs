// 自动演示从头跑到「自由闯荡」，看主线有没有被街区改坏，收集报错
// 用法：node tools/qa/check_full.mjs [输出目录]
// 环境变量：BASE_URL 覆盖入口地址（默认 http://127.0.0.1:2079/index.html）
import { open } from './cdp.mjs';
const out = process.argv[2] || 'tests/e2e/shots/20261118';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:2079/index.html';
const b = await open(BASE + '?auto=1', { port: 9360 });
const S = `JSON.stringify({s:__game.state,ph:__game.phase,p:__game.player.pos.toArray().map(Math.round),fps:Math.round(__game.fps),meter:__game.meter,gags:__game.districts.gags,seen:[...__game.districts.gagSeen]})`;
try {
  await b.until(`window.__game && document.getElementById('loading').classList.contains('off')`, 90000);
  await b.click(800, 380);
  const t0 = Date.now(); let last = '', k = 0;
  while (Date.now() - t0 < 330000) {
    const st = await b.js(S); const ph = st && JSON.parse(st).ph;
    if (ph !== last) { console.log(Math.round((Date.now() - t0) / 1000) + 's', st); last = ph; await b.shot(`${out}/full_${String(k++).padStart(2, '0')}_${ph}.jpg`); }
    if (ph === 'free') { await b.sleep(4000); console.log('END', await b.js(S)); await b.shot(`${out}/full_free.jpg`); break; }
    await b.sleep(1000);
  }
} finally {
  console.log('---- errors ----'); console.log(b.errors().join('\n') || '(none)');
  console.log('---- warnings ----'); console.log(b.logs.filter((l) => /warn/.test(l)).slice(0, 10).join('\n') || '(none)');
  b.close();
}
