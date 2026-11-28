// 大苹果街区（纽约参考图）：时代广场大屏、自由奶蛙像、黄出租、消防梯砖楼、地铁口
// 当地任务（送）：外卖冲刺——热狗车的四单，100 秒内送到全岛
// 只在这里有的笑点：地铁「终点站：铁岭」直接传送到老家县城门口、自由奶蛙像要咖啡钱、大屏 KISS CAM 拍你和电驴、出租车起步价 ¥80
import * as THREE from 'three';
import { mat, box, cyl, board, neon, drawTex, V3, Gags, flat } from './kit.js';
import { Cardboard } from '../../actors/npc/index.js';
import { genModel } from '../../actors/models.js';

const C = [100, 100];
const DROPS = [
  { pos: V3(100, 0, 95.5), who: '自由奶蛙像', line: '举了一天手，终于有人给我送吃的了' },
  { pos: V3(0, 0, 38), who: '广场保安', line: '值班不能走开，谢谢你，热狗比工资热' },
  { pos: V3(68, 0, -103), who: '便利店店员', line: '我们自己也卖热狗……但你的更贵' },
  { pos: V3(-60, 0, 231), who: '救生员', line: '吃完要等半小时才能下水（反正海是贴图）' },
];

export class BigApple {
  constructor(island) {
    this.island = island; this.id = 'bigapple';
    this.name = '大苹果'; this.tagline = '大屏 · 黄出租 · 地铁直达铁岭'; this.color = '#ff5a5a';
    this.center = C; this.bounds = [43, 157, 43, 157]; this.replaces = ['AI 生成中100,100'];
    this.gags = new Gags(); this.kiss = 0;
    this.buildBlocks();
    this.buildScreens();
    this.buildStatue();
    this.buildTaxis();
    this.buildSubway();
    this.buildHotdog();
    this.buildHometownGate();
    this.quest = {
      title: '外卖冲刺', short: '外卖冲刺', kind: '送', time: 105, gain: 14, at: V3(116, 0, 114),
      intro: ['热狗摊老板', '四单热狗，全岛配送！一百秒内送完，超时扣你一根香肠。'],
      goal: '把热狗送到四个地方（跟着 ◆ 走）',
      cheer: ['外卖之王', '四单全送到', '热狗还是热的', '袋鼠：下次我来'],
      start: (g, a) => this.startQuest(g, a), update: (g, dt, a) => this.updateQuest(g, dt, a), end: (g, win, a) => this.endQuest(g, win, a),
    };
    this.marks = [{ x: 78, z: 124, color: '#3fbf6a', r: 6, label: '地铁 → 铁岭' }];
  }

  // 四周一圈高楼，中间空出广场，三个口进出
  buildBlocks() {
    const I = this.island;
    const blocks = [
      [57, 92, 57, 68], [108, 143, 57, 68], [57, 92, 132, 143], [108, 143, 132, 143],
      [57, 68, 68, 92], [57, 68, 108, 132], [132, 143, 68, 92], [132, 143, 108, 132],
    ];
    this.walls = [];
    for (const [x0, x1, z0, z1] of blocks) {
      const long = x1 - x0 > z1 - z0, n = long ? 2 : 1, step = (long ? x1 - x0 : z1 - z0) / n;
      for (let i = 0; i < n; i++) {
        const w = long ? step - 0.6 : x1 - x0, d = long ? z1 - z0 : step - 0.6;
        const x = long ? x0 + step * (i + 0.5) : (x0 + x1) / 2, z = long ? (z0 + z1) / 2 : z0 + step * (i + 0.5);
        const h = 26 + I.r() * 38;
        I.building(x, z, w, d, h, I.r() < 0.55 ? 'concrete' : 'glass');
        this.walls.push({ x, z, w, d, h });
      }
    }
    // 砖楼外挂的消防梯（朝广场那面）
    const iron = mat(0x1a1a1e, { metalness: 0.6, roughness: 0.4 });
    for (const b of this.walls) {
      const fx = b.x < C[0] - 20 ? b.x + b.w / 2 + 0.6 : b.x > C[0] + 20 ? b.x - b.w / 2 - 0.6 : b.x;
      const fz = b.z < C[1] - 20 ? b.z + b.d / 2 + 0.6 : b.z > C[1] + 20 ? b.z - b.d / 2 - 0.6 : b.z;
      const along = Math.abs(fz - b.z) > Math.abs(fx - b.x); // 在南北面
      for (let y = 4; y < Math.min(b.h - 2, 22); y += 3.2) {
        box(this.island, along ? 4 : 1.2, 0.12, along ? 1.2 : 4, fx, y, fz, iron, { cast: false });
        box(this.island, along ? 4 : 0.05, 0.9, along ? 0.05 : 4, fx + (along ? 0 : 0.6 * Math.sign(fx - b.x)), y + 0.1, fz + (along ? 0.6 * Math.sign(fz - b.z) : 0), iron, { cast: false });
      }
    }
    // 广场地面：深色湿地砖 + 斑马线
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(64, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1a1c24, roughness: 0.15, metalness: 0.5 }));
    ground.position.set(C[0], 0.02, C[1]); ground.receiveShadow = true; I.add(ground);
  }

  // 时代广场大屏：一块会动（广告 / KISS CAM），两块静态
  buildScreens() {
    const I = this.island;
    const mk = (w, h, x, y, z, ry) => {
      const t = drawTex(512, 512 * h / w, () => {});
      const m = new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(1.25, 1.25, 1.25), toneMapped: true });
      I.env.neon.push({ mat: m, base: new THREE.Color(1.15, 1.15, 1.15) });
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); p.position.set(x, y, z); p.rotation.y = ry; I.add(p);
      return t;
    };
    this.big = mk(18, 14, 100, 22, 68.6, 0);
    const apple = mk(9, 13, 68.6, 18, 80, Math.PI / 2);
    const frog = mk(9, 13, 131.4, 18, 120, -Math.PI / 2);
    this.drawApple(apple); this.drawFrogAd(frog);
    this.screenT = 0; this.adI = 0;
    neon(I, 'TIMES 方块', '#ffd84a', 10, 2.5, 100, 13.5, 68.7, 0);
  }
  drawApple(t) {
    const x = t.ctx, W = t.canvas.width, H = t.canvas.height;
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#ff3fb4'); g.addColorStop(1, '#5a1aa0'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.fillStyle = '#e8102a'; x.beginPath(); x.arc(W / 2 - 60, H / 2, 130, 0, 7); x.arc(W / 2 + 60, H / 2, 130, 0, 7); x.fill();
    x.fillStyle = '#4a2a10'; x.fillRect(W / 2 - 8, H / 2 - 190, 16, 70);
    x.fillStyle = '#3fbf3a'; x.beginPath(); x.ellipse(W / 2 + 50, H / 2 - 170, 50, 22, -0.4, 0, 7); x.fill();
    x.fillStyle = '#fff'; x.font = '900 60px "PingFang SC"'; x.textAlign = 'center'; x.fillText('大苹果', W / 2, 110); x.font = '800 40px "PingFang SC"'; x.fillText('¥8000（只有一个）', W / 2, H - 70);
    t.needsUpdate = true;
  }
  drawFrogAd(t) {
    const x = t.ctx, W = t.canvas.width, H = t.canvas.height;
    x.fillStyle = '#0a2a4a'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#9fe8b0'; x.beginPath(); x.ellipse(W / 2, H / 2, 170, 140, 0, 0, 7); x.fill();
    x.fillStyle = '#fff'; for (const s of [-1, 1]) { x.beginPath(); x.arc(W / 2 + s * 75, H / 2 - 110, 50, 0, 7); x.fill(); }
    x.fillStyle = '#111'; for (const s of [-1, 1]) { x.beginPath(); x.arc(W / 2 + s * 75, H / 2 - 105, 22, 0, 7); x.fill(); }
    x.strokeStyle = '#111'; x.lineWidth = 10; x.beginPath(); x.arc(W / 2, H / 2 + 10, 70, 0.2, Math.PI - 0.2); x.stroke();
    x.fillStyle = '#ffd84a'; x.font = '900 52px "PingFang SC"'; x.textAlign = 'center'; x.fillText('奶蛙代言', W / 2, 90); x.fillStyle = '#fff'; x.font = '700 38px "PingFang SC"'; x.fillText('看了会笑 · 笑了会活', W / 2, H - 60);
    t.needsUpdate = true;
  }
  drawBig(t) {
    const tx = this.big, x = tx.ctx, W = tx.canvas.width, H = tx.canvas.height;
    if (this.kiss > 0) {
      x.fillStyle = '#2a0010'; x.fillRect(0, 0, W, H);
      x.strokeStyle = '#ff3f7a'; x.lineWidth = 14; x.strokeRect(14, 14, W - 28, H - 28);
      x.fillStyle = '#ff5fa8'; x.font = '900 64px "PingFang SC"'; x.textAlign = 'center'; x.fillText('KISS CAM ❤', W / 2, 100);
      const s = 1 + Math.sin(t * 8) * 0.08; x.save(); x.translate(W / 2, H / 2 + 20); x.scale(s, s);
      x.fillStyle = '#ff2f6a'; x.beginPath(); x.moveTo(0, 60); x.bezierCurveTo(-140, -40, -60, -130, 0, -60); x.bezierCurveTo(60, -130, 140, -40, 0, 60); x.fill(); x.restore();
      x.fillStyle = '#fff'; x.font = '800 44px "PingFang SC"'; x.fillText('你  ❤  你的电驴', W / 2, H - 60);
    } else {
      const ads = [['活人感 2079', '正在加载……99%', '#1a3aff'], ['大苹果 · 现在下单', '明年发货', '#ff3f3a'], ['看什么看', '这块屏比你房租贵', '#ffb000'], ['奶蛙咖啡', '一杯八十 · 纽约也一样', '#00a870']];
      if ((this.adT = (this.adT || 0) - 0.15) <= 0) { this.adT = 3; this.adI = (this.adI + 1) % ads.length; }
      const [a, b, c] = ads[this.adI];
      x.fillStyle = c; x.fillRect(0, 0, W, H);
      for (let i = 0; i < 6; i++) { x.fillStyle = `rgba(255,255,255,${0.06 + 0.05 * Math.sin(t * 3 + i)})`; x.fillRect(0, (i * 70 + t * 80) % H, W, 30); }
      x.fillStyle = '#fff'; x.font = '900 70px "PingFang SC"'; x.textAlign = 'center'; x.fillText(a, W / 2, H / 2 - 10); x.font = '700 40px "PingFang SC"'; x.fillText(b, W / 2, H / 2 + 60);
    }
    tx.needsUpdate = true;
  }

  // 自由奶蛙像：举的不是火炬，是一杯八十的咖啡
  buildStatue() {
    const I = this.island, [x, z] = C;
    box(I, 7, 4, 7, x, 0, z, mat(0xb8b0a0, { roughness: 0.8 }), { col: true });
    board(I, ['自由奶蛙像', 'LIBERTY FROG · 给我你的咖啡钱'], 5, 1.4, x, 1.4, z - 3.56, Math.PI, { bg: '#2a3a2a', fg: '#e8ffe0' });
    const gen = genModel(['bigapple_statue', 'statue_of_liberty_frog', 'liberty_frog', '自由奶蛙像'], 13);
    const g = new THREE.Group(); g.position.set(x, 4, z); I.add(g); this.statue = g;
    if (gen) {
      gen.rotation.y = Math.PI; g.add(gen);
    } else {
      const pat = mat(0x6fb8a0, { roughness: 0.55, metalness: 0.25 });
      const robe = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.8, 7, 18), pat); robe.position.y = 3.5; g.add(robe);
      const body = new THREE.Mesh(new THREE.SphereGeometry(2.2, 20, 16), pat); body.scale.set(1, 0.8, 0.9); body.position.y = 7.4; g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(1.9, 24, 18), pat); head.scale.set(1.15, 0.85, 1); head.position.y = 9.6; g.add(head);
      for (const s of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 12), mat(0xf4f4ea)); eye.position.set(s * 0.95, 10.8, -0.9); g.add(eye);
        const pu = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), mat(0x111111)); pu.position.set(s * 0.95, 10.85, -1.42); g.add(pu);
      }
      for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (i - 3) * 0.32; const sp = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.6, 6), pat); sp.position.set(Math.cos(a) * 1.5, 11.5, Math.sin(a) * 1.0 + 0.2); sp.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6); g.add(sp); }
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 4.2, 10), pat); arm.position.set(2.1, 10.2, 0); arm.rotation.z = -0.3; g.add(arm);
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.42, 1.2, 14), mat(0xf6f2ea)); cup.position.set(2.75, 12.6, 0); g.add(cup);
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.18, 14), mat(0x5a3a22)); lid.position.set(2.75, 13.25, 0); g.add(lid);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.3, 10), I.neonMat(new THREE.Color(3, 1.8, 0.5))); flame.position.set(2.75, 14.0, 0); g.add(flame); this.flame = flame;
      const tab = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.7, 0.25), pat); tab.position.set(-1.8, 7.2, -1.2); tab.rotation.z = 0.3; g.add(tab);
      g.rotation.y = Math.PI; // 正面朝北边的大屏
      g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    }
    this.gags.add({ id: 'statue', x, z, r: 14, cool: 40, fire: (gm) => {
      gm.districts.bubble(this.statue, '给我你的疲惫、你的贫穷……和八十块咖啡钱', 4, 15.5);
      gm.audio.say('给我你的疲惫，你的贫穷，和八十块咖啡钱。', { pitch: 0.7, rate: 1 });
      gm.ui.burst(['自由女神要咖啡钱', '纽约也一杯八十', '举的是咖啡！', '自由是付费的'], 5); gm.laugh += 4;
    } });
    this.gags.add({ id: 'kisscam', x, z, r: 26, cool: 50, fire: (gm) => {
      this.kiss = 6; gm.audio.ding(); gm.ui.banner('KISS CAM', '大屏拍到了你和你的电驴'); gm.ui.burst(['KISS CAM！', '亲一个亲一个', '电驴害羞了', '单身狗暴击'], 6); gm.laugh += 4;
    } });
  }

  buildTaxis() {
    const I = this.island;
    this.taxis = [];
    for (const [x, z, ry] of [[78, 76, 0.2], [124, 80, -0.3], [126, 124, 2.8], [92, 128, 1.6]]) {
      const g = genModel(['yellow_taxi', 'nyc_taxi', 'taxi', '黄色出租车'], 1.7) || (() => {
        const t = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.9, 4.4), mat(0xffc417, { roughness: 0.35, metalness: 0.3 })); body.position.y = 0.75; t.add(body);
        const cab = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 2.3), mat(0x2a3440, { roughness: 0.1, metalness: 0.6 })); cab.position.set(0, 1.5, -0.2); t.add(cab);
        const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.3), new THREE.MeshBasicMaterial({ map: drawTex(128, 48, (c) => { c.fillStyle = '#fff6c0'; c.fillRect(0, 0, 128, 48); c.fillStyle = '#111'; c.font = '900 30px sans-serif'; c.textAlign = 'center'; c.fillText('TAXI', 64, 36); }) }));
        sign.position.set(0, 2.0, -0.2); t.add(sign);
        const chk = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.18, 4.0), new THREE.MeshStandardMaterial({ map: drawTex(256, 16, (c) => { for (let i = 0; i < 32; i++) { c.fillStyle = i % 2 ? '#111' : '#fff'; c.fillRect(i * 8, 0, 8, 8); c.fillStyle = i % 2 ? '#fff' : '#111'; c.fillRect(i * 8, 8, 8, 8); } }) }));
        chk.position.y = 0.95; t.add(chk);
        for (const sx of [-1, 1]) for (const sz of [-1.4, 1.4]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.3, 14).rotateZ(Math.PI / 2), mat(0x111111)); w.position.set(sx * 1.0, 0.38, sz); t.add(w); }
        return t;
      })();
      const p = I.addProp(g, x, z, ry, 2.0, 6);
      this.taxis.push(p);
      this.gags.add({ id: 'taxi' + this.taxis.length, x, z, r: 5, cool: 30, fire: (gm) => {
        gm.audio.tone('square', 420, 400, 0.18, 0.18); gm.audio.tone('square', 420, 400, 0.25, 0.18, 0.25);
        gm.districts.bubble(g, ['上车吗？起步价 ¥80', '去铁岭？坐地铁更快', '我只收苹果支付', '堵车也计费哦'][this.taxis.length % 4], 3, 2.8); gm.laugh += 2;
      } });
    }
  }

  // 地铁口：牌子写着终点站铁岭，进去就到老家县城门口
  buildSubway() {
    const I = this.island, x = 78, z = 124;
    const rail = mat(0x2f7a4a, { metalness: 0.5, roughness: 0.4 });
    box(I, 4.6, 1.1, 0.12, x, 0, z - 2.6, rail, { col: true });
    box(I, 0.12, 1.1, 5.2, x - 2.3, 0, z, rail, { col: true });
    box(I, 0.12, 1.1, 5.2, x + 2.3, 0, z, rail, { col: true });
    const pit = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 5).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: drawTex(256, 256, (c) => {
      const g = c.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#6a6a6a'); g.addColorStop(1, '#050505'); c.fillStyle = g; c.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 12; i++) { c.fillStyle = `rgba(255,255,255,${0.35 - i * 0.025})`; c.fillRect(0, i * 21, 256, 4); }
      c.fillStyle = 'rgba(255,220,120,0.6)'; c.fillRect(90, 220, 76, 30);
    }) }));
    pit.position.set(x, 0.05, z + 0.2); I.add(pit);
    for (const sx of [-2.3, 2.3]) {
      cyl(I, 0.08, 0.08, 2.8, x + sx, 0, z - 2.6, rail);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), I.neonMat(new THREE.Color(0.6, 2.2, 0.8))); ball.position.set(x + sx, 3.0, z - 2.6); I.add(ball);
    }
    board(I, ['地铁 · 铁岭线', '终点站：铁岭'], 4.6, 1.3, x, 3.6, z - 2.7, Math.PI, { bg: '#123a22', fg: '#ffe066' });
    this.gags.add({ id: 'subway', x, z: z + 0.5, r: 2.4, cool: 6, fire: (g) => this.ride(g) });
  }
  ride(g) {
    g.audio.whoosh(); g.flash = 1;
    g.reboot?.discover('subwayFound');
    g.anchors?.refreshUI();
    g.ui.popup('<h3>🚇 捷径发现：铁岭线直达！</h3><p>已写入跨轮次「记忆笔记本」</p><p>下一秒落到老家县一中门口！</p>', '', 2.2);
    g.tl.at(0.75, () => {
      g.districts.teleport(-100, 53, 0);
      g.flash = 0.8; g.ui.banner('欢迎来到老家县城', '铁岭门楼 · 县一中 · 班主任已就位');
      g.audio.say('终点站，铁岭，到了。', { pitch: 0.9 });
      g.ui.burst(['地铁秒传老家！', '绝佳捷径记住了', '大城市待不下去了'], 5); g.laugh += 8;
    });
  }
  testGag(g) { this.ride(g); }

  // 热狗车（任务起点）
  buildHotdog() {
    const I = this.island, x = 120, z = 118;
    const cart = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.1, 1.4), mat(0xd8d8de, { metalness: 0.6, roughness: 0.3 })); b.position.y = 0.95; cart.add(b);
    const um = new THREE.Mesh(new THREE.ConeGeometry(1.9, 0.7, 12, 1, true), mat(0xff3a3a, { side: THREE.DoubleSide })); um.position.y = 3.0; cart.add(um);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.3), mat(0x333333)); pole.position.y = 1.8; cart.add(pole);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.7), new THREE.MeshBasicMaterial({ map: drawTex(256, 76, (c) => { c.fillStyle = '#ffd84a'; c.fillRect(0, 0, 256, 76); c.fillStyle = '#c0182a'; c.font = '900 30px "PingFang SC"'; c.textAlign = 'center'; c.fillText('热狗 ¥80（同咖啡价）', 128, 48); }) }));
    sign.position.set(0, 1.0, -0.72); sign.rotation.y = Math.PI; cart.add(sign);
    cart.position.set(x, 0, z); cart.rotation.y = 0.5; cart.traverse((m) => { if (m.isMesh) m.castShadow = true; }); I.add(cart);
    I.col.add(x - 1.4, x + 1.4, z - 0.8, z + 0.8, 2);
    // 冒蒸汽的井盖
    this.vents = [[90, 84], [112, 124], [70, 100]];
    this.ventT = 0;
  }

  // 老家县城门口（铁岭）：西南角 AI 生成中的围挡前面先搭一个门楼
  buildHometownGate() {
    const I = this.island, x = -100, z = 59;
    const red = mat(0xb8202a, { roughness: 0.5 }), gold = mat(0xe8b84a, { metalness: 0.6, roughness: 0.35 });
    for (const sx of [-9, 9]) box(I, 1.2, 7.5, 1.2, x + sx, 0, z, red, { col: true });
    box(I, 21, 1.4, 1.6, x, 7.5, z, red);
    box(I, 23, 0.4, 2.4, x, 8.9, z, mat(0x2a2a2a));
    board(I, ['铁岭 · 老家县城 欢迎您', '回来啦？在大城市混得咋样？'], 12, 2.2, x, 6.2, z - 0.85, Math.PI, { bg: '#b8202a', fg: '#ffe8a0' });
    for (const sx of [-6, 6]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), I.neonMat(new THREE.Color(2.4, 0.4, 0.3))); l.scale.y = 1.3; l.position.set(x + sx, 6.5, z - 0.9); I.add(l); }
    board(I, ['县城还在 AI 生成中 37%', '预计完工：春节前（哪年没说）'], 6, 1.6, x + 14, 1.4, z - 0.1, Math.PI, { bg: '#0d2a3a', fg: '#7ef6ff' });
    void gold;
    const uncle = new Cardboard(I.scene, { name: '门口大爷', color: '#c9b08a', face: 'calm', h: 1.75 });
    uncle.root.position.set(x - 6, 0, z - 2.2); uncle.yaw = Math.PI; uncle.root.rotation.y = Math.PI; this.uncle = uncle;
    this.gateGag = new Gags().add({ id: 'uncle', x: x - 4, z: 53, r: 8, cool: 30, fire: (g) => {
      const l = ['回来啦？一个月挣多少？', '在纽约混不下去了吧？', '你家那电驴挺好，多少钱？', '啥时候考公？'];
      uncle.say(l[Math.floor(Math.random() * l.length)]); g.laugh += 3;
    } });
  }

  animate(dt, t) {
    if (this.flame) this.flame.scale.set(1 + Math.sin(t * 13) * 0.1, 1 + Math.sin(t * 9) * 0.15, 1);
    if ((this.screenT -= dt) <= 0) {
      this.screenT = 0.35;
      const pp = this.island.playerPos;
      if (!pp || Math.hypot(pp.x - C[0], pp.z - C[1]) < 120) this.drawBig(t);
    }
  }

  update(g, dt, inside) {
    const p = g.player;
    if (this.kiss > 0) this.kiss -= dt;
    if (inside) this.gags.update(g, p);
    this.gateGag.update(g, p); this.uncle.tickBubble(dt);
    if (inside && (this.ventT -= dt) <= 0) {
      this.ventT = 0.5;
      for (const [x, z] of this.vents) g.fx.puff(V3(x, 0.3, z), 3, new THREE.Color(0.95, 0.95, 1), 1.2);
    }
    if (this.statue) this.statue.rotation.y = Math.PI + Math.sin(g.time * 0.3) * 0.05;
  }

  // ---------- 当地任务：外卖冲刺（送） ----------
  startQuest(g) { this.qi = 0; this.drop = null; this.dropT = 0; }
  updateQuest(g, dt, a) {
    const p = g.player, d = DROPS[this.qi];
    if (d && flat(p.pos, d.pos) < 5.5) {
      g.audio.coin(); g.ui.banner(`送达 ${this.qi + 1}/4`, `${d.who}：${d.line}`); g.ui.say(d.who, d.line, 3.5); g.laugh += 4;
      this.qi++;
    }
    const n = DROPS[this.qi];
    a.nav = n ? { pos: n.pos, label: `热狗 → ${n.who}` } : null;
    return { note: `已送 ${this.qi}/4 · 下一单：${n ? n.who : '无'}`, win: this.qi >= 4 };
  }
  endQuest(g, win, a) {
    const used = Math.round(g.time - a.startAt);
    return win
      ? [`四单全送到，用时 ${used} 秒`, '小费：¥0（顾客说给了好评）', '热狗摊老板：你比袋鼠快']
      : [`送到 ${this.qi} / 4 单`, '超时扣了你一根香肠', '没送到的热狗：已被袋鼠吃掉'];
  }
}
