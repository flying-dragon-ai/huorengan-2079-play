// 逐项关闭后期通道 / 雾 / 水面，确认冰岛白光来源
// 用法：node tools/qa/diag_iceland_fx.mjs
// 环境变量：BASE_URL 覆盖入口地址（默认 http://127.0.0.1:2079/index.html）
import { open } from './cdp.mjs';
const out = 'tests/e2e/shots/20261118';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:2079/index.html';
const b = await open(BASE + '?dev=1', { port: 9357 });
const G = (e) => b.js(`(()=>{const g=__game;${e}})()`);
const pose = async () => {
  await G(`g.togglePhoto(true); g.orbit.enableDamping=false; g.pipe.camera.position.set(-19,6,-151); g.orbit.target.set(-29,2,-165); g.orbit.update(); g.setPhotoHour(12);`);
  await b.sleep(1300);
};
try {
  await b.until(`window.__game && document.getElementById('loading').classList.contains('off')`, 90000);
  await G(`g.dev.jump(-32,-150)`); await b.sleep(1200);
  await pose(); await b.shot(`${out}/fx_0_base.jpg`);
  await G(`g.pipe.bloom.strength=0`); await b.sleep(700); await b.shot(`${out}/fx_1_nobloom.jpg`);
  await G(`g.world.fog.density=0.00001`); await b.sleep(700); await b.shot(`${out}/fx_2_nofog.jpg`);
  await G(`g.env.water.visible=false`); await b.sleep(700); await b.shot(`${out}/fx_3_nowater.jpg`);
  await G(`g.pipe.renderer.toneMappingExposure=0.45`); await b.sleep(700); await b.shot(`${out}/fx_4_lowexposure.jpg`);
  console.log(JSON.stringify(await G(`return {exposure:g.pipe.renderer.toneMappingExposure,bloom:g.pipe.bloom.strength,fog:g.world.fog.density,hour:g.env.hour,sun:g.env.sun.intensity}`)));
  console.log('errors', b.errors());
} finally { b.close(); }
