// 验证两个观景入口：标题画面「先逛中央广场」；送单途中按 P 观景再按 P 回来
// 用法：node tools/qa/check_entries.mjs [输出目录]
// 环境变量：BASE_URL 覆盖入口地址（默认 http://127.0.0.1:2079/index.html）
import { open } from './cdp.mjs';
const out = process.argv[2] || 'tests/e2e/shots/20261118';
const S = `JSON.stringify({s:__game.state,ph:__game.phase,photo:!!__game.photo,m:__game.player.mode,p:__game.player.pos.toArray().map(v=>+v.toFixed(2)),t:+__game.time.toFixed(2),title:!document.getElementById('title').classList.contains('off'),fps:Math.round(__game.fps)})`;
const BASE = process.env.BASE_URL || 'http://127.0.0.1:2079/index.html';
const b = await open(BASE + '?auto=1');
const res = [];
try {
  await b.until(`window.__game && __game.state==='title'`, 90000);
  // 入口一：标题画面的「先逛中央广场」按钮
  const r = await b.js(`(()=>{const e=document.getElementById('tour').getBoundingClientRect();return [e.x+e.width/2,e.y+e.height/2]})()`);
  await b.click(r[0], r[1]); await b.sleep(2500);
  res.push('A1 ' + await b.js(S)); await b.shot(`${out}/entry_A_tour.jpg`);
  await b.js(`document.getElementById('photo-place').value='plaza';document.getElementById('photo-place').onchange()`); await b.sleep(1500);
  await b.shot(`${out}/entry_A_plaza.jpg`);
  await b.js(`document.getElementById('photo-hour').click()`); await b.sleep(800);
  const ex = await b.js(`(()=>{const e=document.getElementById('photo-exit').getBoundingClientRect();return [e.x+e.width/2,e.y+e.height/2,document.getElementById('photo-exit').textContent]})()`);
  await b.click(ex[0], ex[1]); await b.sleep(1200);
  res.push('A2 ' + await b.js(S) + ' exitBtn=' + ex[2]);
  // 入口二：自动演示开始送单后按 P
  await b.click(800, 380);
  await b.until(`__game.phase==='deliver'`, 150000);
  // 送单开始几秒后会播「假过场」（画面卡成 PPT），这期间 P 本来就不响应，要等它放完
  const sawPPT = await b.until(`__game.pptT>0`, 12000, 50); res.push('saw fake cutscene ' + sawPPT); await b.until(`!(__game.pptT>0)`, 15000); await b.sleep(1500);
  const before = await b.js(S); res.push('B0 ' + before);
  await b.key('KeyP'); await b.sleep(2500);
  const mid1 = await b.js(S); await b.shot(`${out}/entry_B_pause.jpg`);
  await b.sleep(2000); const mid2 = await b.js(S);
  res.push('B1 ' + mid1); res.push('B2 ' + mid2);
  await b.key('KeyP'); await b.sleep(2500);
  res.push('B3 ' + await b.js(S)); await b.shot(`${out}/entry_B_resume.jpg`);
  const ok = await b.until(`__game.phase==='night'`, 90000);
  res.push('B4 reached night=' + ok + ' ' + await b.js(S));
} finally {
  console.log(res.join('\n')); console.log('---- errors ----'); console.log(b.errors().join('\n') || '(none)');
  console.log('---- all logs ----'); console.log(b.logs.slice(0, 40).join('\n'));
  b.close();
}
