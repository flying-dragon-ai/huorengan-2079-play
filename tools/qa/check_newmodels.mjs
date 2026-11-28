// 新模型落地检查：?dev=1 跳到每个新模型面前截图，看朝向/比例/加载报错。
// 用法：node tools/qa/check_newmodels.mjs [输出目录]
// 环境变量：BASE_URL 覆盖入口地址（默认 http://127.0.0.1:2079/index.html）
import { open } from './cdp.mjs';
const out = process.argv[2] || 'tests/e2e/shots/20261119';
// [名字, x, z, yaw]：yaw = atan2(视线X, 视线Z)，0 = 朝 +Z 看
const SPOTS = [
  ['statue', 100, 62, 0],          // 自由奶蛙像 (100,100)，正面应朝 +Z
  ['taxi_front', 78, 62, 0],       // 出租车 (78,76)，车头应朝 +Z
  ['taxi_side', 62, 76, Math.PI / 2], // 侧面：车身长轴应沿 Z
  ['cat', 64.5, -95, Math.PI],     // 招财猫在便利店顶 (64.5,-109.5)，正面应朝 +Z
  ['tower', 40, 226, 0],           // 救生塔 (40,246)
  ['flamingo', -15, 224, 0],       // 火烈鸟泳圈 (-15,238)
];
const BASE = process.env.BASE_URL || 'http://127.0.0.1:2079/index.html';
const b = await open(BASE + '?dev=1', { port: 9352 });
try {
  await b.until(`window.__game && document.getElementById('loading').classList.contains('off')`, 90000);
  await b.js(`__game.dev.jump(100, 62, 'free', 0)`);
  await b.sleep(2000);
  for (const [name, x, z, yaw] of SPOTS) {
    await b.js(`__game.dev.tp(${x}, ${z}, ${yaw})`);
    await b.sleep(1500);
    await b.shot(`${out}/new_${name}.jpg`);
    console.log('shot', name);
  }
  // 出租车：街面机位会被楼挡，用观景自由相机沿车身轴拍两头 + 侧面
  const t = await b.js(`(()=>{const d=__game.districts.list.find(d=>d.id==='bigapple'); const p=d.taxis[0]; const o=p.obj||p.root||p; return {x:o.position.x, z:o.position.z, ry:o.rotation.y};})()`);
  console.log('taxi0', JSON.stringify(t));
  await b.js(`__game.togglePhoto(true); __game.orbit.enableDamping=false;`);
  const views = [
    ['taxi_axisA', t.x - Math.sin(t.ry) * 13, 3.2, t.z - Math.cos(t.ry) * 13],
    ['taxi_axisB', t.x + Math.sin(t.ry) * 13, 3.2, t.z + Math.cos(t.ry) * 13],
    ['taxi_side2', t.x + Math.cos(t.ry) * 13, 3.2, t.z - Math.sin(t.ry) * 13],
  ];
  for (const [name, ex, ey, ez] of views) {
    await b.js(`__game.pipe.camera.position.set(${ex},${ey},${ez}); __game.orbit.target.set(${t.x},1,${t.z}); __game.orbit.update();`);
    await b.sleep(1200); await b.shot(`${out}/new_${name}.jpg`); console.log('shot', name);
  }
  await b.js(`__game.togglePhoto(false)`);
  const genWarn = b.logs.filter((l) => l.includes('[gen]') || l.includes('[models]'));
  console.log('gen/model warnings:', genWarn.length ? genWarn.join('\n') : '(none)');
  console.log('errors:', b.errors().length ? b.errors().join('\n') : '(none)');
} finally { b.close(); }
