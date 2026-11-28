// 冰岛近景过曝定位：一次会话里逐层关闭可疑光源，各拍一张
// 用法：node tools/qa/diag_iceland.mjs
// 环境变量：BASE_URL 覆盖入口地址（默认 http://127.0.0.1:2079/index.html）
import { open } from './cdp.mjs';
const out = 'tests/e2e/shots/20261118';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:2079/index.html';
const b = await open(BASE + '?dev=1', { port: 9355 });
const G = (e) => b.js(`(()=>{const g=__game;${e}})()`);
const pose = async () => {
  await G(`g.togglePhoto(true); g.orbit.enableDamping=false; g.pipe.camera.position.set(-19,6,-151); g.orbit.target.set(-29,2,-165); g.orbit.update(); g.setPhotoHour(12);`);
  await b.sleep(1500);
};
try {
  await b.until(`window.__game && document.getElementById('loading').classList.contains('off')`, 90000);
  await G(`g.dev.jump(-32,-150)`); await b.sleep(1500);
  await pose(); await b.shot(`${out}/diag_a_all.jpg`);
  await G(`g.guide.marker.visible=false`); await b.sleep(600); await b.shot(`${out}/diag_b_nomarker.jpg`);
  await G(`g.districts.list.forEach(d=>d.ring&&(d.ring.g.visible=false))`); await b.sleep(600); await b.shot(`${out}/diag_c_norings.jpg`);
  await G(`const d=g.districts.list.find(x=>x.id==='iceland'); d.auroras.forEach(a=>a.mesh.visible=false)`); await b.sleep(600); await b.shot(`${out}/diag_d_noaurora.jpg`);
  await G(`const d=g.districts.list.find(x=>x.id==='iceland'); d.mist.visible=false; d.steam.forEach(s=>s.ripple.visible=false)`); await b.sleep(600); await b.shot(`${out}/diag_e_nomist.jpg`);
  await G(`g.env.sunDisc.visible=false; g.env.sun.intensity=0`); await b.sleep(600); await b.shot(`${out}/diag_f_nosun.jpg`);
  console.log(JSON.stringify(await G(`return {exposure:g.pipe.renderer.toneMappingExposure,bloom:g.pipe.bloom.strength,night:g.env.night,sun:g.env.sun.intensity,hour:g.env.hour,flash:g.flash||0}`)));
  console.log('errors', b.errors());
} finally { b.close(); }
