// 街区验收：跳过开场 → 拍几张场景照 → 走一遍笑点 → 接当地任务并用机器人做完 → 收集控制台报错
// 用法：node tools/qa/check_district.mjs shanghai [输出目录]
// 环境变量：BASE_URL 覆盖入口地址（默认 http://127.0.0.1:2079/index.html）
import { open } from './cdp.mjs';
const id = process.argv[2] || 'shanghai';
const out = process.argv[3] || 'tests/e2e/shots/20261118';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:2079/index.html';
const b = await open(BASE + '?dev=1', { port: 9350 });
const log = (...a) => console.log(...a);
const G = (expr) => b.js(`(()=>{const g=__game;${expr}})()`);
const D = `g.districts.list.find(d=>d.id==='${id}')`;
const view = async (name, eye, target, hour = null) => {
  await G(`g.togglePhoto(true); g.orbit.enableDamping=false; g.pipe.camera.position.set(${eye}); g.orbit.target.set(${target}); g.orbit.update(); ${hour != null ? `g.setPhotoHour(${hour});` : ''}`);
  await b.sleep(1800); await b.shot(`${out}/${id}_${name}.jpg`); log('shot', name);
  await G(`g.togglePhoto(false)`); await b.sleep(300);
};
try {
  await b.until(`window.__game && document.getElementById('loading').classList.contains('off')`, 90000);
  const info = await G(`const d=${D}; const q=d.quest; return {name:d.name, at:q&&[q.at.x,q.at.z], gags:d.gags.list.map(x=>[x.id,x.x,x.z]), views:d.views||[]}`);
  log(JSON.stringify(info));
  await G(`return g.dev.jump(${info.at[0]}, ${info.at[1] + 8}, 'free', Math.PI)`);
  await b.sleep(2500);
  await b.shot(`${out}/${id}_ride.jpg`);
  for (const v of info.views) {
    await G(`${D}.ring && (${D}.ring.g.visible=false)`);
    await view(v[0], v[1], v[2], v[3]);
  }
  // 笑点：挨个传送过去
  for (const [gid, x, z] of info.gags) {
    await G(`g.dev.tp(${x}, ${z}+1.5, 0)`); await b.sleep(300);
    await G(`g.dev.tp(${x}, ${z}, 0)`); await b.sleep(1200);
    log('gag', gid, 'seen=', await G(`return g.districts.gagSeen.has('${gid}')`));
  }
  if (await G(`return !!${D}.testGag`)) { await G(`${D}.testGag(g)`); await b.sleep(3000); await b.shot(`${out}/${id}_gag.jpg`); }
  // 接任务
  await G(`g.dev.tp(${info.at[0]}, ${info.at[1]}, Math.PI)`); await b.sleep(800);
  await b.key('KeyE'); await b.sleep(1500);
  log('active', await G(`return !!g.districts.active`));
  await b.shot(`${out}/${id}_quest_start.jpg`);
  const t0 = Date.now(); let shot2 = false;
  while (Date.now() - t0 < 150000) {
    const st = await G(`const a=g.districts.active; if(!a) return null; return {t:a.t, note:a.note, nav:a.nav&&[a.nav.pos.x,a.nav.pos.z]}`);
    if (!st) break;
    if (await G(`return !!${D}.testStep`)) { await G(`${D}.testStep(g)`); await b.sleep(400); await G(`${D}.testStep(g)`); }
    else if (st.nav) {
      const [x, z] = st.nav;
      await G(`const p=g.player; const dx=p.pos.x-(${x}), dz=p.pos.z-(${z}), d=Math.hypot(dx,dz)||1; if(d>12) g.dev.tp(${x}+dx/d*9, ${z}+dz/d*9, Math.atan2(-dx,-dz)); g.dev.ride(${x}, ${z});`);
    }
    await b.sleep(900);
    if (!shot2 && Date.now() - t0 > 6000) { shot2 = true; await b.shot(`${out}/${id}_quest_mid.jpg`); }
  }
  await G(`g.dev.ride(null)`);
  await b.sleep(800); await b.shot(`${out}/${id}_quest_end.jpg`);
  log('done', await G(`return [...g.districts.done]`), 'meter', await G(`return g.meter`), 'fps', await G(`return Math.round(g.fps)`));
  log('result', await b.js(`document.getElementById('result').innerText`));
  await b.key('KeyM'); await b.sleep(800); await b.shot(`${out}/${id}_map.jpg`); await b.key('KeyM');
} finally {
  log('---- errors ----'); log(b.errors().join('\n') || '(none)');
  log('---- warnings ----'); log(b.logs.filter((l) => /warn/.test(l)).slice(0, 10).join('\n') || '(none)');
  b.close();
}
