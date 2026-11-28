// 东京便利店一条街（东京参考图）：雨夜、樱花、便利店、高架电车、自动贩卖机墙
// 当地任务（躲）：赶末班电车——集齐 3 张回家的票再上站台，路上贩卖机会掉亲戚出来拦你
// 只在这里有的笑点：人生贩卖机（投币掉出七大姑追着跑 / 纸片人对象 / 周末售罄）、电车广播、只下在东京的雨、便利店进门铃
import * as THREE from 'three';
import { mat, box, cyl, board, neon, drawTex, V3, Gags, flat, inRect } from './kit.js';
import { Chaser, Cardboard } from '../../actors/npc/index.js';
import { genModel } from '../../actors/models.js';

const DECK_Y = 10.2, DECK_Z = -107.2;
const AUNTS = [
  { name: '七大姑', color: '#ffb36b', face: 'star', lines: ['投币的是你吧？', '工资多少？', '对象呢？', '还买饮料？', '回老家考公吧'] },
  { name: '八大姨', color: '#ff8fb1', face: 'grin', lines: ['胖了啊？', '房子买了没？', '什么时候结婚？', '隔壁孩子都二胎了'] },
  { name: '二舅', color: '#9fd0ff', face: 'calm', lines: ['年轻人要稳定', '我当年……', '来喝两杯', '你这工作能干一辈子？'] },
];

export class Tokyo {
  constructor(island) {
    this.island = island; this.id = 'tokyo';
    this.name = '东京便利店街'; this.tagline = '雨夜 · 樱花 · 自动贩卖机什么都卖'; this.color = '#a46bff';
    this.center = [100, -100]; this.bounds = [43, 157, -157, -43];
    this.gags = new Gags(); this.vendN = 0; this.extras = [];
    this.views=[['storefront','73,4,-96','73,2.7,-110.1',21]];
    this.buildViaduct();
    this.buildStore();
    this.buildSakura();
    this.buildLanterns();
    this.buildLifeVendor();
    this.buildRain();
    this.gags.add({ id: 'train_pa', x: 100, z: -100, r: 60, cool: 45, when: () => Math.abs(this.train.position.x - this.island.ctxPlayerX) < 35 && this.trainMoving,
      fire: (g) => { g.audio.tone('sine', 660, 660, 0.25, 0.15); g.audio.tone('sine', 520, 520, 0.4, 0.15, 0.3); g.line(['车内广播', '下一站：加班。再下一站：还是加班。本次列车不停：周末。'], 4.5); g.laugh += 3; } });
    this.gags.add({ id: 'rain', x: 100, z: -100, r: 70, cool: 120, fire: (g) => {
      g.line(['大肥鱼 AI 客服', '东京的雨是付费天气，只下在这条街。其他街区：省算力，不下。'], 4.5);
      g.ui.burst(['雨只下在东京？', '边界线上一半湿一半干', 'AI 省算力实锤', '好有氛围'], 5); g.laugh += 3;
    } });
    this.quest = {
      title: '赶末班电车', short: '赶末班电车', kind: '躲', time: 75, gain: 12, at: V3(60, 0, -96),
      intro: ['站务员', '末班电车马上发车！先集齐 3 张「回家的票」再上站台。小心，贩卖机会掉亲戚出来拦你。'],
      goal: '集齐 3 张回家的票，再上电车站台（别被亲戚拦住）',
      cheer: ['赶上末班车了', '下一站：加班', '亲戚没追上', '活人感 +12'],
      start: (g, a) => this.startQuest(g, a), update: (g, dt, a) => this.updateQuest(g, dt, a), end: (g, win, a) => this.endQuest(g, win, a),
    };
    this.station = V3(128, 0, -103);
  }

  // 高架：桥面架在北边人行道上空，电车来回跑，在「家里玛特站」停
  buildViaduct() {
    const I = this.island, conc = mat(0x8c8f96, { roughness: 0.8 });
    box(I, 124, 0.9, 5.6, 100, DECK_Y - 0.9, DECK_Z, conc);
    box(I, 124, 1.0, 0.25, 100, DECK_Y, DECK_Z + 2.7, conc);
    box(I, 124, 1.0, 0.25, 100, DECK_Y, DECK_Z - 2.7, conc);
    for (let x = 44; x <= 156; x += 16) { if (Math.abs(x - 50) < 8 || Math.abs(x - 150) < 8) continue; cyl(I, 0.45, 0.55, DECK_Y - 0.9, x, 0, -108.6, conc, { col: true, seg: 10 }); }
    for (const z of [-108.4, -106]) box(I, 124, 0.12, 0.12, 100, DECK_Y, z, mat(0x555555, { metalness: 0.7, roughness: 0.3 }), { cast: false });
    // 站台楼梯（装饰）和站名牌
    for (let i = 0; i < 8; i++) box(I, 2.4, 0.35, 1.0, 132, i * 1.2, -109 + i * 0.0, mat(0x6a6d74), { cast: false }).position.x = 134 - i * 0.9;
    board(I, ['家里玛特站', '末班电车 23:59 · 开往：回家'], 6, 1.6, 128, DECK_Y + 2.6, DECK_Z + 2.9, 0, { bg: '#0a2a6a' });
    neon(I, '末班电车', '#7ef6ff', 5, 1.25, 112, DECK_Y - 2.2, DECK_Z + 2.9, 0);
    // 电车：三节，车窗发光
    const tr = new THREE.Group();
    const body = mat(0xe8eef4, { roughness: 0.35, metalness: 0.3 }), stripe = mat(0x2a8a4a);
    const win = I.neonMat(new THREE.Color(1.5, 1.6, 1.8));
    for (let c = 0; c < 3; c++) {
      const cx = c * 14.6 - 14.6;
      const b = new THREE.Mesh(new THREE.BoxGeometry(14, 3, 2.9), body); b.position.set(cx, 1.6, 0); tr.add(b);
      const s = new THREE.Mesh(new THREE.BoxGeometry(14.05, 0.35, 2.95), stripe); s.position.set(cx, 0.9, 0); tr.add(s);
      for (const sz of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(12, 1.0), win); w.position.set(cx, 2.1, sz * 1.46); if (sz < 0) w.rotation.y = Math.PI; tr.add(w); }
    }
    tr.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    tr.position.set(60, DECK_Y, DECK_Z); I.add(tr);
    this.train = tr; this.trainT = 0; this.trainMoving = true;
  }
  // 电车：西 → 东，站台停 6 秒，再回去
  animate(dt, t) {
    this.trainT = (this.trainT + dt) % 40;
    const k = this.trainT, A = 20, B = 128, C = 175;
    let x;
    if (k < 9) x = A + (B - A) * (k / 9); else if (k < 15) x = B; else if (k < 20) x = B + (C - B) * ((k - 15) / 5);
    else if (k < 34) x = C - (C - A) * ((k - 20) / 14); else x = A;
    this.trainMoving = !(k >= 9 && k < 15) && k < 34;
    this.train.position.x = x; this.train.visible = x < 172;
    this.atStation = k >= 9 && k < 15;
    if (this.petals && this.petals.visible) this.animatePetals(dt);
  }

  // 便利店「家里玛特」：白底三色条，门口一个巨大的甜筒
  buildStore() {
    const I = this.island, x = 68, z = -110.3;
    const face = drawTex(512, 256, (c) => {
      c.fillStyle = '#f6f7fb'; c.fillRect(0, 0, 512, 256);
      c.fillStyle = '#1d6fd8'; c.fillRect(0, 0, 512, 34); c.fillStyle = '#ffffff'; c.fillRect(0, 34, 512, 8); c.fillStyle = '#2bb24c'; c.fillRect(0, 42, 512, 22);
      c.fillStyle = '#1d6fd8'; c.font = '900 46px "PingFang SC"'; c.textAlign = 'center'; c.fillText('家里玛特 · 24h', 256, 112);
      c.fillStyle = '#ffe9a0'; c.fillRect(20, 130, 472, 120);
      c.fillStyle = '#334'; c.font = '700 22px "PingFang SC"';
      ['电饭煲', '饭团', '亲戚', '回家的票', '关东煮', '勇气'].forEach((t, i) => { c.fillStyle = ['#ff6b6b', '#4d96ff', '#6bcB77', '#ffd93d'][i % 4]; c.fillRect(34 + i * 76, 150, 60, 54); c.fillStyle = '#222'; c.fillText(t, 64 + i * 76, 232); });
    });
    const m = new THREE.MeshBasicMaterial({ map: face, color: new THREE.Color(1.15, 1.15, 1.15) });
    I.env.neon.push({ mat: m, base: new THREE.Color(1.05, 1.05, 1.05) });
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), m); plate.position.set(x, 2.6, z + 0.05); I.add(plate);
    I.col.add(x - 5, x + 5, z - 0.4, z + 0.2, 5);
    // 甜筒
    const cone = cyl(I, 0.55, 0.05, 1.4, x + 6.2, 0.4, -108.4, mat(0xd99a4a));
    cone.rotation.x = Math.PI;
    for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.55 - i * 0.14, 16, 12), mat(0xfff4e0)); s.position.set(x + 6.2, 2.1 + i * 0.42, -108.4); I.add(s); }
    I.col.add(x + 5.6, x + 6.8, -109, -107.8, 3);
    // 招财猫看板：用生成模型（有的话），没有就画一个
    const cat = genModel(['tokyo_lucky_cat', 'lucky_cat', '招财猫'], 2.2);
    if (cat) { cat.position.set(x - 3.5, 5.2, z + 0.8); I.add(cat); }
    else {
      const head = new THREE.Mesh(new THREE.SphereGeometry(1.2, 20, 16), mat(0xffffff)); head.position.set(x - 3.5, 6.4, z + 0.9); I.add(head);
      for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.7, 8), mat(0xffffff)); ear.position.set(x - 3.5 + s * 0.7, 7.5, z + 0.9); I.add(ear); }
      const eyeM = mat(0x111111);
      for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), eyeM); e.position.set(x - 3.5 + s * 0.42, 6.55, z + 2.05); I.add(e); }
      const paw = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), mat(0xffffff)); paw.position.set(x - 2.3, 7.2, z + 1.1); I.add(paw); this.catPaw = paw;
    }
    this.gags.add({ id: 'store', x, z: -105, r: 4, cool: 20, fire: (g) => {
      [659, 523, 392, 523, 587, 784].forEach((f, i) => g.audio.tone('sine', f, f, 0.22, 0.13, i * 0.22));
      g.districts.bubble(plate, '欢迎光临！本店有：电饭煲、亲戚、回家的票', 3.2, 3.2); g.laugh += 2;
      g.ui.danmaku('便利店进门铃 DNA 动了', true);
    } });
  }

  buildSakura() {
    const I = this.island, r = I.r;
    const pts = [[57, -113], [143, -113], [57, -86], [143, -86], [62, -56.5], [82, -56.5], [102, -56.5], [122, -56.5], [140, -56.5]];
    const trunk = new THREE.CylinderGeometry(0.22, 0.35, 4.2, 7); trunk.translate(0, 2.1, 0);
    const blob = new THREE.IcosahedronGeometry(1.9, 1);
    const tm = [], bm = [], bc = [];
    for (const [x, z] of pts) {
      tm.push(new THREE.Matrix4().compose(V3(x, 0, z), new THREE.Quaternion(), V3(1, 1, 1)));
      for (let k = 0; k < 5; k++) {
        bm.push(new THREE.Matrix4().compose(V3(x + (r() - 0.5) * 3.5, 4.3 + r() * 1.8, z + (r() - 0.5) * 3.5), new THREE.Quaternion(), V3(1, 0.8, 1).multiplyScalar(0.7 + r() * 0.5)));
        bc.push(new THREE.Color().setHSL(0.93 + r() * 0.04, 0.75, 0.78 + r() * 0.1));
      }
      I.col.add(x - 0.35, x + 0.35, z - 0.35, z + 0.35, 4);
    }
    const T = new THREE.InstancedMesh(trunk, mat(0x4a3030), tm.length); tm.forEach((m, i) => T.setMatrixAt(i, m)); T.castShadow = true; I.add(T);
    const B = new THREE.InstancedMesh(blob, new THREE.MeshStandardMaterial({ roughness: 0.7, flatShading: true, emissive: 0xff6fae, emissiveIntensity: 0.12 }), bm.length);
    bm.forEach((m, i) => { B.setMatrixAt(i, m); B.setColorAt(i, bc[i]); }); B.castShadow = true; I.add(B);
    // 飘落的花瓣
    const N = 500, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { pos[i * 3] = 50 + Math.random() * 100; pos[i * 3 + 1] = Math.random() * 9; pos[i * 3 + 2] = -120 + Math.random() * 70; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.petals = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffb8d8, size: 0.22, transparent: true, opacity: 0.9, depthWrite: false }));
    I.add(this.petals);
  }
  animatePetals(dt) {
    const a = this.petals.geometry.attributes.position, t = performance.now() / 1000;
    for (let i = 0; i < a.count; i++) {
      let y = a.getY(i) - dt * 0.9; let x = a.getX(i) + Math.sin(t + i) * dt * 0.6;
      if (y < 0) y = 9;
      a.setY(i, y); a.setX(i, x);
    }
    a.needsUpdate = true;
  }

  // 居酒屋红灯笼：沿北边人行道一串
  buildLanterns() {
    const I = this.island, red = I.neonMat(new THREE.Color(2.2, 0.35, 0.25));
    const geo = new THREE.SphereGeometry(0.35, 12, 10); geo.scale(1, 1.3, 1);
    const ms = [];
    for (let x = 84; x < 124; x += 2.6) ms.push(new THREE.Matrix4().compose(V3(x, 3.6, -110.0), new THREE.Quaternion(), V3(1, 1, 1)));
    const L = new THREE.InstancedMesh(geo, red, ms.length); ms.forEach((m, i) => L.setMatrixAt(i, m)); I.add(L);
    board(I, ['居酒屋 · 加班后', '生啤 ¥80（与咖啡同价）'], 5, 1.4, 104, 5.2, -110.25, 0, { bg: '#3a0a0a', fg: '#ffd8a8' });
  }

  // 人生贩卖机：在贩卖机墙中间空出来的那格
  buildLifeVendor() {
    const I = this.island, x = 100, z = -89.3;
    const face = drawTex(256, 320, (c) => {
      c.fillStyle = '#c0182a'; c.fillRect(0, 0, 256, 320);
      c.fillStyle = '#fff'; c.font = '900 34px "PingFang SC"'; c.textAlign = 'center'; c.fillText('人生贩卖机', 128, 44);
      const items = [['亲戚', '¥199'], ['对象', '¥520'], ['周末', '售罄'], ['后悔药', '缺货']];
      items.forEach(([n, p], i) => { const y = 70 + i * 58; c.fillStyle = '#fff6e0'; c.fillRect(18, y, 220, 48); c.fillStyle = '#222'; c.font = '800 26px "PingFang SC"'; c.textAlign = 'left'; c.fillText(n, 30, y + 33); c.fillStyle = p.startsWith('¥') ? '#c0182a' : '#888'; c.textAlign = 'right'; c.fillText(p, 226, y + 33); });
      c.fillStyle = '#111'; c.fillRect(60, 300, 136, 14);
    });
    const front = new THREE.MeshBasicMaterial({ map: face, color: new THREE.Color(1.2, 1.2, 1.2) });
    I.env.neon.push({ mat: front, base: new THREE.Color(1.1, 1.1, 1.1) });
    const side = mat(0x8a0f1c, { roughness: 0.3, metalness: 0.4 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.6, 1.0), [side, side, side, side, side, front]);
    m.rotation.y = Math.PI; m.position.set(x, 1.3, z + 0.5); m.castShadow = true; I.add(m);
    this.vendor = m;
    this.gags.add({ id: 'vendor', x, z: -92.5, r: 3.6, cool: 12, fire: (g) => this.vend(g) });
  }
  vend(g) {
    const k = this.vendN++ % 4, at = V3(100, 0, -91.5);
    g.audio.coin(); g.audio.tone('square', 200, 120, 0.3, 0.15, 0.3);
    this.vendor.position.y = 1.45; setTimeout(() => { this.vendor.position.y = 1.3; }, 200);
    if (k === 0) {
      const c = new Chaser(g.world, 'aunt', at.clone().add(V3(0, 0, -1)), { ...AUNTS[0], name: '七大姑（贩卖机款）' });
      c.say('谁投的币？工资多少？'); this.extras.push({ c, t: 16, chase: true });
      g.ui.banner('投币成功：亲戚 ×1', '七大姑从出货口掉出来了'); g.ui.burst(['贩卖机真卖亲戚', '快跑！', '¥199 买了个七大姑', '能退货吗'], 6);
      g.laugh += 6;
    } else if (k === 1) {
      const c = new Cardboard(g.world, { name: '对象（纸片人）', color: '#ffc0e0', face: 'shy', h: 1.8 });
      c.root.position.copy(at); c.yaw = Math.PI; c.say('我们不合适，你太 3D 了'); this.extras.push({ c, t: 9, flop: true });
      g.ui.banner('投币成功：对象 ×1', '¥520 · 纸片人 · 不支持退换'); g.ui.burst(['对象是纸片人', '520 块买了张纸', '她说你太 3D 了', '哈哈哈哈'], 6);
      g.laugh += 6;
    } else if (k === 2) {
      g.ui.popup('<h3>周末 · 已售罄</h3><p>补货时间：退休以后</p><p>已为您推荐：调休（需先上 7 天班）</p>', 'bad', 3); g.audio.crash(); g.laugh += 4;
    } else {
      g.ui.popup('<h3>后悔药 · 缺货</h3><p>本机今日已售出 2079 盒</p><p>最后一盒被你妈买走了</p>', 'bad', 3); g.audio.crash(); g.laugh += 4;
    }
  }
  testGag(g) { this.vendN = 0; this.vend(g); }

  // 只下在东京的雨：一团雨线跟着镜头
  buildRain() {
    const N = 900, pos = new Float32Array(N * 6);
    this.rainSeed = [];
    for (let i = 0; i < N; i++) this.rainSeed.push([Math.random() * 60 - 30, Math.random() * 24, Math.random() * 60 - 30]);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rain = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x9fc8ff, transparent: true, opacity: 0.38, depthWrite: false }));
    this.rain.frustumCulled = false; this.rain.visible = false; this.island.add(this.rain);
    this.rainT = 0;
  }
  updateRain(dt, focus) {
    const a = this.rain.geometry.attributes.position; this.rainT += dt;
    for (let i = 0; i < this.rainSeed.length; i++) {
      const s = this.rainSeed[i];
      const y = 24 - ((s[1] + this.rainT * 26) % 24);
      const x = focus.x + s[0], z = focus.z + s[2];
      const inside = x > 43 && x < 157 && z > -157 && z < -43;
      const yy = inside ? y : -50;
      a.setXYZ(i * 2, x, yy, z); a.setXYZ(i * 2 + 1, x + 0.1, yy + 0.9, z);
    }
    a.needsUpdate = true;
  }

  update(g, dt, inside) {
    const p = g.player, I = this.island;
    I.ctxPlayerX = p.pos.x;
    if (inside) this.gags.update(g, p);
    const near = p.pos.x > 20 && p.pos.x < 180 && p.pos.z > -180 && p.pos.z < -20;
    const cold = (g.env?.coldMode || 0) > 0.5;
    this.rain.visible = near && !cold;
    if (this.petals) this.petals.visible = near && !cold;
    if (this.rain.visible) this.updateRain(dt, p.pos);
    if (this.catPaw) this.catPaw.position.y = 7.2 + Math.sin(g.time * 5) * 0.25;
    for (let i = this.extras.length - 1; i >= 0; i--) {
      const e = this.extras[i]; e.t -= dt;
      if (e.chase) e.c.update(dt, p, I); else { e.c.tickBubble(dt); e.c.physics(dt, I); if (e.flop && e.t < 5) e.c.root.rotation.x = Math.min(Math.PI / 2, (5 - e.t) * 3); }
      if (e.t <= 0) { if (e.chase) e.c.say('我回机器里了'); g.world.remove(e.c.root); this.extras.splice(i, 1); }
    }
  }

  // ---------- 当地任务：赶末班电车（躲） ----------
  startQuest(g, a) {
    this.tickets = [V3(150, 0, -128), V3(100, 0, -50), V3(50, 0, -137)].map((p) => {
      const m = new THREE.Group();
      const tk = genModel(['train_ticket', 'ticket', '车票'], 1.0);
      const card = tk || new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 0.08), new THREE.MeshStandardMaterial({ map: drawTex(256, 144, (c) => {
        c.fillStyle = '#ffe9a0'; c.fillRect(0, 0, 256, 144); c.fillStyle = '#1d6fd8'; c.fillRect(0, 0, 256, 30);
        c.fillStyle = '#c0182a'; c.font = '900 34px "PingFang SC"'; c.textAlign = 'center'; c.fillText('回家的票', 128, 86); c.font = '600 18px "PingFang SC"'; c.fillStyle = '#333'; c.fillText('限末班车 · 不退不换', 128, 124);
      }), emissive: 0xffd060, emissiveIntensity: 0.35 }));
      m.add(card); m.position.copy(p).setY(1.6); g.world.add(m);
      return { m, p, got: false };
    });
    this.relatives = []; this.spawnT = 3; this.blocked = 0;
  }
  updateQuest(g, dt, a) {
    const p = g.player;
    for (const t of this.tickets) {
      if (t.got) continue;
      t.m.rotation.y += dt * 2.5; t.m.position.y = 1.6 + Math.sin(g.time * 3) * 0.2;
      if (flat(p.pos, t.p) < 3) { t.got = true; g.world.remove(t.m); g.audio.coin(); const n = this.tickets.filter((x) => x.got).length; g.ui.banner(`回家的票 ${n}/3`, n === 3 ? '快上站台！' : '还差 ' + (3 - n) + ' 张'); g.laugh += 3; }
    }
    // 亲戚从贩卖机里掉出来拦人
    const inTokyo = inRect(p.pos, [43, 157, -157, -43]);
    if ((this.spawnT -= dt) <= 0 && inTokyo && this.relatives.length < 3) {
      this.spawnT = 7;
      const from = V3(Math.max(62, Math.min(138, p.pos.x + p.heading().x * 18)), 0, -91);
      const c = new Chaser(g.world, 'aunt', from, AUNTS[Math.floor(Math.random() * 3)]);
      c.say('等等！先回答一个问题！'); this.relatives.push({ c, t: 16 });
      g.audio.tone('square', 200, 120, 0.3, 0.15); g.ui.danmaku('贩卖机又掉出一个亲戚', true);
    }
    for (let i = this.relatives.length - 1; i >= 0; i--) {
      const r = this.relatives[i]; r.t -= dt; r.c.update(dt, p, this.island);
      if (!r.c.flying && flat(p.pos, r.c.root.position) < 1.5) {
        a.t -= 6; this.blocked++; r.c.say(r.c.lines[Math.floor(Math.random() * r.c.lines.length)]);
        g.ui.popup(`<h3>被${r.c.lines === AUNTS[2].lines ? '二舅' : '亲戚'}拦住了</h3><p>回答「工资多少」耽误了 <b>6 秒</b></p>`, 'warn', 1.8);
        g.audio.crash(); p.speed *= -0.3; g.laugh += 5; r.t = 0;
      }
      if (r.t <= 0) { g.world.remove(r.c.root); this.relatives.splice(i, 1); }
    }
    const got = this.tickets.filter((t) => t.got).length;
    let nav;
    if (got < 3) {
      let bd = 1e9; for (const t of this.tickets) if (!t.got) { const d = flat(p.pos, t.p); if (d < bd) { bd = d; nav = { pos: t.p, label: '回家的票' }; } }
    } else nav = { pos: this.station, label: '电车站台' };
    a.nav = nav;
    const win = got === 3 && flat(p.pos, this.station) < 5;
    return { note: `票 ${got}/3 · 被拦 ${this.blocked} 次`, win };
  }
  endQuest(g, win) {
    for (const t of this.tickets || []) if (!t.got) g.world.remove(t.m);
    for (const r of this.relatives || []) g.world.remove(r.c.root);
    this.relatives = [];
    if (win) { this.trainT = 9.5; g.line(['车内广播', '欢迎乘坐末班电车。本车开往：回家。预计到达时间：春节。'], 5); }
    return win
      ? ['赶上了末班电车', `被亲戚拦下：${this.blocked} 次（每次耽误 6 秒）`, '车票备注：<b>单程</b>']
      : ['末班电车开走了', `被亲戚拦下：${this.blocked} 次`, '站务员：明天早点来，首班车 5:00（还是去加班）'];
  }
}
