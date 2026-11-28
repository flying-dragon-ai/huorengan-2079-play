// 射线检测：从相机中心往画面打几条射线，打印命中的物体与材质
// 用法：node tools/qa/diag_iceland_ray.mjs
// 环境变量：BASE_URL 覆盖入口地址（默认 http://127.0.0.1:2079/index.html）
import { open } from './cdp.mjs';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:2079/index.html';
const b = await open(BASE + '?dev=1', { port: 9359 });
const G = (e) => b.js(`(()=>{const g=__game;${e}})()`);
try {
  await b.until(`window.__game && document.getElementById('loading').classList.contains('off')`, 90000);
  await G(`g.dev.jump(-32,-150)`); await b.sleep(1200);
  await G(`g.togglePhoto(true); g.orbit.enableDamping=false; g.pipe.camera.position.set(-19,6,-151); g.orbit.target.set(-29,2,-165); g.orbit.update(); g.setPhotoHour(12);`);
  await b.sleep(1200);
  const hits = await G(`
    const THREE = await import('three');
    const rc = new THREE.Raycaster();
    const cam = g.pipe.camera; cam.updateMatrixWorld(true);
    const out = [];
    for (const [nx,ny] of [[0,0],[0.2,0.1],[-0.2,0.0],[0.3,-0.2],[0,0.3]]) {
      rc.setFromCamera(new THREE.Vector2(nx,ny), cam);
      const hs = rc.intersectObjects(g.world.children, true).slice(0,3).map(h=>({
        name: h.object.name||'', type: h.object.type, dist: +h.distance.toFixed(1),
        mat: h.object.material?.type, color: h.object.material?.color ? '#'+h.object.material.color.getHexString() : '',
        emis: h.object.material?.emissive ? '#'+h.object.material.emissive.getHexString() : '',
        op: h.object.material?.opacity, geo: h.object.geometry?.type
      }));
      out.push({nx,ny,hs});
    }
    return out;`);
  console.log(JSON.stringify(hits, null, 1));
  console.log('errors', b.errors());
} finally { b.close(); }
