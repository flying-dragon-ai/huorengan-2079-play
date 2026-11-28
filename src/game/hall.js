// 人生舱大厅（2079）：一眼望不到头的舱位，每个人头上扣着电饭煲
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { getModel } from '../actors/models.js';
import { genModel } from '../actors/models.js';
import { plainSign, neonSign } from '../gfx/textures.js';
import { lerp, smooth } from '../core/util.js';

export class Hall {
  constructor(pipe) {
    const s = (this.scene = new THREE.Scene());
    s.background = new THREE.Color(0x050a14);
    s.fog = new THREE.FogExp2(0x07101e, 0.011);
    s.environment = pipe.pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    s.environmentIntensity = 0.18;
    s.add(new THREE.HemisphereLight(0x6fa8ff, 0x0a0a14, 0.35));

    // 镜面地板加一层半透明深色地面，看起来像抛光的地
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 400), new THREE.MeshStandardMaterial({ color: 0x0a0f18, roughness: 0.12, metalness: 0.8 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0.01, -150); s.add(floor);

    // 舱位
    const N = [], xs = [-13, -7.5, 7.5, 13];
    for (const x of xs) for (let z = -4; z > -300; z -= 5) N.push([x, z]);
    const shell = new THREE.CapsuleGeometry(1.1, 2.4, 8, 24); shell.rotateX(Math.PI / 2); shell.translate(0, 1.4, 0);
    const bed = new THREE.BoxGeometry(2.2, 0.6, 4); bed.translate(0, 0.3, 0);
    const body = new THREE.SphereGeometry(0.55, 20, 14); body.scale(1, 0.6, 1.6); body.translate(0, 0.95, 0.2);
    const cook = new THREE.CylinderGeometry(0.42, 0.38, 0.45, 24); cook.rotateX(Math.PI / 2); cook.translate(0, 0.95, -1.15);
    const led = new THREE.BoxGeometry(0.3, 0.06, 0.04); led.translate(0, 1.3, -1.15);
    const mk = (geo, mat) => {
      const m = new THREE.InstancedMesh(geo, mat, N.length);
      N.forEach(([x, z], i) => m.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, 0, z)));
      s.add(m); return m;
    };
    mk(bed, new THREE.MeshStandardMaterial({ color: 0xdfe6ee, roughness: 0.25, metalness: 0.3 }));
    mk(body, new THREE.MeshStandardMaterial({ color: 0xf7f3ea, roughness: 0.4 }));
    mk(cook, new THREE.MeshStandardMaterial({ color: 0xcfd6dc, roughness: 0.2, metalness: 0.9 }));
    this.leds = mk(led, new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.25, 0.15) }));
    mk(shell, new THREE.MeshStandardMaterial({ color: 0x9fd8ff, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.18, depthWrite: false }));

    // 灯带
    const strip = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 2.2, 3.2) });
    for (const x of [-4, 4]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.05, 300), strip); m.position.set(x, 0.03, -150); s.add(m); }
    const ceil = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.6, 3.0) });
    // 环形顶灯与舱位编号灯，沿走廊延伸到雾里
    this.hallRings = [];
    for (let z = -2; z > -300; z -= 10) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(8.6, 0.095, 8, 64), ceil);
      ring.position.set(0, 7.3, z); s.add(ring); this.hallRings.push(ring);
      const m = new THREE.Mesh(new THREE.BoxGeometry(6, 0.1, 1.2), ceil); m.position.set(0, 11, z); s.add(m);
    }
    const aisleGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 0.25, 1.5), transparent: true, opacity: 0.5 });
    for (const x of [-17.3, 17.3]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 300), aisleGlow); strip.position.set(x, 0.08, -150); s.add(strip);
    }
    const status = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 1.0), new THREE.MeshBasicMaterial({ map: plainSign(['舱位 2079', '今日已自动活着 ✓', ' emotion.dll 未安装'], { w: 768, h: 160, bg: '#071b2a', fg: '#7ef6ff' }), color: new THREE.Color(1.2, 1.2, 1.2) }));
    status.position.set(-5.7, 2.6, -3); status.rotation.y = Math.PI / 2; s.add(status);
    for (const x of [-20, 20]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(1, 14, 320), new THREE.MeshStandardMaterial({ color: 0x0f1a2a, roughness: 0.5, metalness: 0.6 }));
      w.position.set(x, 7, -150); s.add(w);
    }
    // 尽头的大屏
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(22, 7), new THREE.MeshBasicMaterial({ map: neonSign('人生舱 · 第 2079 区', '#3ff0ff', { w: 1024, h: 256, bg: '#04111c' }), color: new THREE.Color(1.6, 1.6, 1.6) }));
    scr.position.set(0, 7.5, 12); scr.rotation.y = Math.PI; s.add(scr);
    const sub = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.2), new THREE.MeshBasicMaterial({ map: plainSign(['今日 AI 已完成全部工作 ✓'], { w: 1024, h: 160, bg: '#0b2a1a', fg: '#7dffb0' }), color: new THREE.Color(1.3, 1.3, 1.3) }));
    sub.position.set(0, 3.2, 12); sub.rotation.y = Math.PI; s.add(sub);

    // 主角的舱
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, 0.4, 48), new THREE.MeshStandardMaterial({ color: 0x9aa6b4, metalness: 0.7, roughness: 0.3 }));
    pod.position.set(0, 0.2, 6); s.add(pod);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.06, 8, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 2.5, 3.5) }));
    ring.rotation.x = Math.PI / 2; ring.position.set(0, 0.42, 6); s.add(ring);
    this.ring = ring;
    const spot = new THREE.SpotLight(0xcfe8ff, 6, 30, 0.45, 0.7);
    spot.position.set(0, 10, 3); spot.target.position.set(0, 0, 6); spot.castShadow = true; s.add(spot, spot.target);
    this.hero = getModel('naiwa');
    this.hero.position.set(0, 0.4, 6); this.hero.rotation.y = Math.PI; this.hero.scale.setScalar(1.2);
    this.hero.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    s.add(this.hero);

    // 大肥鱼 AI 客服：全息投影
    const fish = (this.fish = new THREE.Group());
    const holo = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.08, 0.5, 0.9), transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false });
    const wire = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 1.0, 1.6), wireframe: true, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false });
    const bodyG = new THREE.SphereGeometry(1, 32, 20); bodyG.scale(1.5, 1.05, 0.75);
    const generatedFish = genModel(['hall_fish'], 2.5);
    if (generatedFish) {
      generatedFish.position.set(-1.2, -1.1, 0); fish.add(generatedFish);
      const halo = new THREE.Mesh(new THREE.SphereGeometry(1.8, 24, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.06, 0.6, 1.0), transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false }));
      fish.add(halo);
      // 保留原全息线框作投影外形
    }
    fish.add(new THREE.Mesh(bodyG, holo), new THREE.Mesh(bodyG, wire));
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.2, 4), holo); tail.rotation.z = Math.PI / 2; tail.position.x = 1.9; tail.scale.z = 0.3; fish.add(tail);
    this.tail = tail;
    for (const z of [-0.5, 0.5]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 3, 3) }));
      e.position.set(-1.0, 0.3, z * 0.9); fish.add(e);
    }
    this.mouth = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.05, 8, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.2, 1.6) }));
    this.mouth.position.set(-1.45, -0.15, 0); this.mouth.rotation.y = Math.PI / 2; fish.add(this.mouth);
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.5), new THREE.MeshBasicMaterial({ map: plainSign(['大肥鱼 AI 客服'], { w: 512, h: 96, bg: '#03202c', fg: '#8ff6ff' }), transparent: true, opacity: 0.9 }));
    tag.position.set(0, 1.5, 0); tag.rotation.y = -Math.PI / 2; fish.add(tag);
    fish.position.set(4.6, 3.0, 3.5); fish.rotation.y = -Math.PI / 2 + 0.5; fish.scale.setScalar(0.8);
    s.add(fish);

    this.t = 0; this.talking = 0; this.leave = 0;
  }

  // 镜头：从远处高空沿走廊飞到主角面前
  camera(cam, t) {
    const k = smooth(0, 16, t);
    const z = lerp(-190, -2.5, k), y = lerp(16, 2.4, smooth(0, 14, t));
    const x = Math.sin(t * 0.35) * lerp(2.5, 0.4, k) + lerp(0, 1.0, k);
    cam.position.set(x, y, z);
    cam.lookAt(lerp(0, 0.8, k), lerp(4, 1.8, k), 8);
    cam.fov = lerp(55, 42, k); cam.updateProjectionMatrix();
  }

  update(dt) {
    this.t += dt;
    const t = this.t;
    this.fish.position.y = 3.2 + Math.sin(t * 1.6) * 0.2;
    this.tail.rotation.y = Math.sin(t * 6) * 0.4;
    const talk = this.talking > 0 ? Math.abs(Math.sin(t * 14)) : 0;
    this.mouth.scale.set(1, 1 + talk * 1.2, 1);
    this.talking -= dt;
    this.hero.scale.y = 1.2 * (1 + Math.sin(t * 2) * 0.02);
    this.ring.material.color.setRGB(0.2, 1.4 + Math.sin(t * 4) * 0.4, 2.0);
    if (this.leave > 0) {
      this.leave += dt;
      const k = smooth(0, 1.4, this.leave);
      this.hero.position.y = 0.4 + k * k * 30;
      this.hero.scale.set(1.2 * (1 - k * 0.6), 1.2 * (1 + k * 2), 1.2 * (1 - k * 0.6));
    }
  }
}
