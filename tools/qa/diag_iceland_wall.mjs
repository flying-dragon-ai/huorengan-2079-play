// 遮挡测试：在相机前方放一块黑墙，看白光是否被挡住；再隐藏全岛发光招牌
// 用法：node tools/qa/diag_iceland_wall.mjs
// 环境变量：BASE_URL 覆盖入口地址（默认 http://127.0.0.1:2079/index.html）
import { open } from './cdp.mjs';
const out = 'tests/e2e/shots/20261118';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:2079/index.html';
const b = await open(BASE + '?dev=1', { port: 9356 });
const G = (e) => b.js(`(()=>{const g=__game;${e}})()`);
try {
  await b.until(`window.__game && document.getElementById('loading').classList.contains('off')`, 90000);
  await G(`g.dev.jump(-32,-150)`); await b.sleep(1200);
  await G(`g.togglePhoto(true); g.orbit.enableDamping=false; g.pipe.camera.position.set(-19,6,-151); g.orbit.target.set(-29,2,-165); g.orbit.update(); g.setPhotoHour(12);`);
  await b.sleep(1400); await b.shot(`${out}/diag_wall_0.jpg`);
  // 在相机与目标之间放一块不发光黑墙
  await G(`const THREE=await import('three'); const w=new THREE.Mesh(new THREE.PlaneGeometry(60,40),new THREE.MeshBasicMaterial({color:0x000000,side:THREE.DoubleSide})); w.position.set(-24,4,-158); w.lookAt(g.pipe.camera.position); g.world.add(w); window.__wall=w;`);
  await b.sleep(700); await b.shot(`${out}/diag_wall_1.jpg`);
  await G(`window.__wall.visible=false`);
  // 隐藏所有 emissive / MeshBasicMaterial 的霓虹与招牌
  await G(`let n=0; g.world.traverse(o=>{if(o.isMesh&&o.material&&o.material.color&&o.material.color.r>1.2&&o.material.type==='MeshBasicMaterial'){o.visible=false;n++}}); window.__hid=n;`);
  await b.sleep(700); await b.shot(`${out}/diag_wall_2.jpg`);
  console.log('hidden bright mats', await b.js('window.__hid'));
  console.log('cam', await G(`return [g.pipe.camera.position.toArray(), g.orbit.target.toArray()]`));
  console.log('errors', b.errors());
} finally { b.close(); }
