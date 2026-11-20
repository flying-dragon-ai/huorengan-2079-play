// 热带海滩（里约参考图）：波浪石板路、棕榈、救生塔、海上的山和张开双臂的奶蛙像、摩天轮栈桥、黄昏
// 当地任务（躲）：沙滩躲亲戚——60 秒别被亲戚问到三次；躲进遮阳伞下能躲一会儿（伞主人会收钱）
// 只在这里有的笑点：海是贴图不让下水、摩天轮一圈要 2079 年、黄金时刻锁定（会员专享）、防晒霜 SPF 2079、救生员喊话
import * as THREE from 'three';
import { mat, box, cyl, board, neon, drawTex, V3, Gags, flat, groundQuad } from './kit.js';
import { Chaser, Cardboard } from '../../actors/npc/index.js';
import { genModel } from '../../actors/models.js';
import { groundH } from '../terrain.js';

const RELS = [
  { name: '七大姑', color: '#ff9f6b', face: 'grin', lines: ['工资多少？', '对象呢？', '防晒了吗？', '晒这么黑找不到对象'] },
  { name: '八大姨', color: '#ff8fb1', face: 'star', lines: ['房子买了没？', '在海边买房才叫成功', '胖了啊？', '泳圈是你的肚子吗'] },
  { name: '三舅妈', color: '#c9a0ff', face: 'grin', lines: ['考公没？', '隔壁小王都考上了', '编制！编制！', '海边有编制吗'] },
  { name: '表哥', color: '#9fd0ff', face: 'calm', lines: ['我年薪百万', '你那电驴多少钱', '借我点钱', '我也在 AI 公司'] },
];
const HIDE = [[-50, 238], [-20, 240], [8, 234], [40, 230], [-75, 245], [-100, 236]]; // 都在干沙上，别放进海里（进海会被「海是贴图」弹回）

export class Beach {
  constructor(island) {
    this.island = island; this.id = 'beach';
    this.name = '热带海滩'; this.tagline = '棕榈大道 · 摩天轮栈桥 · 日落永远停在黄金时刻'; this.color = '#ffb347';
    this.center = [0, 245]; this.bounds = [-330, 330, 204, 420];
    this.gags = new Gags(); this.locked = false;
    this.buildPromenade();
    this.buildKiosk();
    this.buildTowers();
    this.buildWheel();
    this.buildMountain();
    this.buildToys();
    this.buildVendor();
    this.gags.add({ id: 'sea', x: 40, z: 300, r: 400, cool: 12, when: (g) => groundH(g.player.pos.x, g.player.pos.z) < -0.9 && !g.player.air && !(Math.abs(g.player.pos.x) < 3.2 && g.player.pos.z > 248 && g.player.pos.z < 362), fire: (g) => {
      g.ui.popup('<h3>🌊 这片海是 AI 画的贴图</h3><p>请勿下水（下了也湿不了）</p><p>已把你放回沙滩</p>', 'warn', 2.6);
      const p = g.player; g.districts.teleport(p.pos.x * 0.8, Math.min(262, p.pos.z), Math.PI);
      g.ui.burst(['海是贴图哈哈', '我游泳圈都带了', 'AI 偷懒实锤', '退钱！'], 5); g.laugh += 4;
    } });
    this.gags.add({ id: 'wheel', x: 0, z: 338, r: 9, cool: 40, fire: (g) => {
      this.wheelBoost = 4;
      g.ui.popup('<h3>🎡 摩天轮 · 一圈 ¥80</h3><p>转一圈需要：2079 年</p><p>已为您排队，前面还有 3 亿人</p>', 'bad', 3);
      g.audio.coin(); g.ui.burst(['一圈 2079 年', '排到下辈子', '摩天轮也一杯八十', '先转为敬'], 5); g.laugh += 4;
    } });
    this.gags.add({ id: 'golden', x: 0, z: 240, r: 400, cool: 9999, once: true, when: (g) => this.canLock(g), fire: (g) => {
      g.ui.banner('日落已锁定：黄金时刻', '热带海滩会员专享 · 离开海滩自动恢复');
      g.ui.burst(['太阳不落山了', '会员连太阳都能买', '永远的黄昏', '拍照模式已开启'], 5); g.laugh += 3;
    } });
    this.quest = {
      title: '沙滩躲亲戚', short: '沙滩躲亲戚', kind: '躲', time: 60, gain: 12, at: V3(30, 0, 228),
      intro: ['七大姑', '大家快来！奶蛙在海边！今天必须问清楚：工资、对象、房子、编制！'],
      goal: '60 秒内别被亲戚问到 3 次（躲进发光的遮阳伞下，不许跑出海滩）',
      cheer: ['躲过了亲戚', '工资保密成功', '对象：无可奉告', '海边隐身术'],
      start: (g, a) => this.startQuest(g, a), update: (g, dt, a) => this.updateQuest(g, dt, a), end: (g, win, a) => this.endQuest(g, win, a),
    };
    this.marks = [{ x: 0, z: 350, color: '#ff8ad8', r: 6, label: '摩天轮' }];
  }

  // 科帕卡巴纳那种黑白波浪石板路
  buildPromenade() {
    const I = this.island;
    const t = drawTex(512, 128, (x, W, H) => {
      x.fillStyle = '#f4efe4'; x.fillRect(0, 0, W, H);
      x.fillStyle = '#1e1e22';
      for (let k = -1; k < 3; k++) {
        x.beginPath();
        for (let i = 0; i <= W; i += 4) x.lineTo(i, k * 64 + 20 + Math.sin(i / W * Math.PI * 4) * 22);
        for (let i = W; i >= 0; i -= 4) x.lineTo(i, k * 64 + 44 + Math.sin(i / W * Math.PI * 4) * 22);
        x.fill();
      }
    }, { repeat: 1 });
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(30, 1);
    groundQuad(I, -157, 217.3, 157, 221.6, 0.045, new THREE.MeshStandardMaterial({ map: t, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 }));
  }

  // 海边小酒吧：条纹顶棚、靠着的冲浪板、高脚凳
  buildKiosk() {
    const I = this.island, x = -30, z = 230;
    const wood = mat(0x9a6a3a, { roughness: 0.85 });
    box(I, 5, 1.2, 2.4, x, 0, z, wood, { col: true });
    for (const sx of [-2.3, 2.3]) for (const sz of [-1.1, 1.1]) cyl(I, 0.1, 0.1, 3.2, x + sx, 0, z + sz, wood);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(6, 0.25, 3.4), new THREE.MeshStandardMaterial({ map: drawTex(256, 64, (c) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#ffffff' : '#2aa8d8'; c.fillRect(i * 32, 0, 32, 64); } }) }));
    roof.position.set(x, 3.3, z); roof.castShadow = true; I.add(roof);
    board(I, ['椰子 ¥80', '（和咖啡同价）'], 3, 1, x, 3.9, z - 1.75, Math.PI, { bg: '#2aa8d8', fg: '#fff' });
    const colors = [0xff5a5a, 0xffd23f, 0x3fd8a8];
    colors.forEach((c, i) => {
      const sb = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 2.2, 4, 10), mat(c)); sb.scale.z = 0.25;
      sb.position.set(x + 3.2 + i * 0.7, 1.4, z - 0.6); sb.rotation.z = -0.18; sb.castShadow = true; I.add(sb);
    });
    for (let i = 0; i < 3; i++) { const st = new THREE.Group(); const s = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.08, 12), mat(0x3fd8c8)); s.position.y = 0.8; st.add(s); const l = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8), mat(0x555555)); l.position.y = 0.4; st.add(l); I.addProp(st, x - 1.6 + i * 1.6, z - 2.1, 0, 0.4, 1); }
  }

  buildTowers() {
    const I = this.island;
    const mk = (x, z, col, label) => {
      const g = genModel(['lifeguard_tower', 'lifeguard tower', '救生塔'], 6.5) || (() => {
        const t = new THREE.Group(), wood = mat(0xe8e0d0);
        const cab = new THREE.Mesh(new THREE.BoxGeometry(3, 2.2, 3), mat(col)); cab.position.y = 4.2; t.add(cab);
        const rf = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.2, 4), mat(0xffffff)); rf.position.y = 5.9; rf.rotation.y = Math.PI / 4; t.add(rf);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3.2), wood); l.position.set(sx * 1.2, 1.6, sz * 1.2); t.add(l); }
        const ramp = new THREE.Mesh(new THREE.BoxGeometry(1, 0.1, 4), wood); ramp.position.set(0, 1.6, -2.6); ramp.rotation.x = -0.75; t.add(ramp);
        return t;
      })();
      g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
      g.position.set(x, groundH(x, z), z); I.add(g); I.col.add(x - 1.5, x + 1.5, z - 1.5, z + 1.5, 6);
      board(I, [label], 2.8, 0.7, x, groundH(x, z) + 3.1, z - 1.56, Math.PI, { bg: '#d8202a', fg: '#fff' });
    };
    mk(40, 246, 0xffd23f, '救生站 · 海是贴图');
    mk(-110, 244, 0x3fb8ff, '救生站 · 禁止游泳');
    const guard = new Cardboard(I.scene, { name: '救生员', color: '#ff5a5a', face: 'grin', h: 1.8 });
    guard.root.position.set(-60, groundH(-60, 232), 232.5); guard.root.rotation.y = Math.PI; guard.yaw = Math.PI; this.guard = guard;
    this.gags.add({ id: 'guard', x: -60, z: 232, r: 7, cool: 25, fire: (g) => { guard.say(['禁止游泳！海是贴图！', '要冲浪？去东京淋雨吧', '我只救活人感低于 3% 的'][Math.floor(Math.random() * 3)]); g.laugh += 2; } });
  }

  // 栈桥尽头的摩天轮
  buildWheel() {
    const I = this.island, z = 352, top = 1.2, R = 10;
    const steel = mat(0xf0f0f4, { metalness: 0.6, roughness: 0.3 });
    for (const sx of [-1.8, 1.8]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, R + 2.5), steel);
      leg.position.set(sx, top + (R + 2.5) / 2, z + 1.5); leg.rotation.z = sx * 0.04; I.add(leg);
      const leg2 = leg.clone(); leg2.position.z = z - 1.5; I.add(leg2);
    }
    const wheel = new THREE.Group(); wheel.position.set(0, top + R + 1.2, z); wheel.rotation.y = Math.PI / 2; I.add(wheel);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.18, 8, 72), I.neonMat(new THREE.Color(2.2, 0.6, 1.6))); wheel.add(rim);
    const rim2 = new THREE.Mesh(new THREE.TorusGeometry(R * 0.55, 0.12, 8, 48), I.neonMat(new THREE.Color(0.6, 1.8, 2.2))); wheel.add(rim2);
    const cabCols = [0xff5a5a, 0xffd23f, 0x3fb8ff, 0x7aff7a, 0xff8ad8];
    this.cabins = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, R), steel); sp.position.set(Math.cos(a) * R / 2, Math.sin(a) * R / 2, 0); sp.rotation.z = a - Math.PI / 2; wheel.add(sp);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.4), mat(cabCols[i % 5])); cab.position.set(Math.cos(a) * R, Math.sin(a) * R - 0.8, 0); wheel.add(cab); this.cabins.push(cab);
    }
    this.wheel = wheel; this.wheelBoost = 0;
    // 栈桥上的灯
    for (let zz = 258; zz < 346; zz += 10) for (const sx of [-2.8, 2.8]) {
      cyl(I, 0.06, 0.06, 2.2, sx, top, zz, mat(0x333333));
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), I.neonMat(new THREE.Color(2.6, 1.8, 0.8))); l.position.set(sx, top + 2.35, zz); I.add(l);
    }
    neon(I, '摩天轮 · 一圈 ¥80', '#ff8ad8', 6, 1.5, 0, top + 2.4, z - 7, Math.PI);
  }

  // 海上的山：顶上一尊张开双臂的奶蛙像（等你回家吃饭）
  buildMountain() {
    const I = this.island;
    const rock = new THREE.MeshStandardMaterial({ color: 0x4f6a3a, roughness: 0.95, flatShading: true });
    const geo = new THREE.ConeGeometry(48, 95, 12, 5);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y < 47 && y > -47) { const k = 1 + (Math.sin(i * 12.9898) * 0.5) * 0.25; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, rock); m.position.set(-210, 40, 470); m.scale.set(1, 1, 0.8); I.add(m);
    const m2 = new THREE.Mesh(new THREE.ConeGeometry(34, 55, 10, 3), rock); m2.position.set(-150, 20, 500); I.add(m2);
    const st = new THREE.Group(), stone = mat(0xe8e4dc, { roughness: 0.7 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.2, 8, 12), stone); body.position.y = 4; st.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(1.6, 14, 10), stone); head.scale.set(1.2, 0.85, 1); head.position.y = 9; st.add(head);
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), stone); e.position.set(s * 0.8, 10, -0.6); st.add(e); }
    const arms = new THREE.Mesh(new THREE.BoxGeometry(12, 1.1, 1.1), stone); arms.position.y = 6.6; st.add(arms);
    st.position.set(-210, 87, 470); st.rotation.y = Math.PI * 0.95; I.add(st);
  }

  // 沙滩排球、火烈鸟泳圈：都能撞飞
  buildToys() {
    const I = this.island;
    const ballTex = drawTex(128, 64, (c) => { ['#ff5a5a', '#ffffff', '#3fb8ff', '#ffd23f', '#ffffff', '#3fd8a8'].forEach((col, i) => { c.fillStyle = col; c.fillRect(i * 22, 0, 22, 64); }); });
    for (const [x, z] of [[-40, 236], [5, 233], [62, 236], [-88, 238], [100, 245]]) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.4 }));
      const g = new THREE.Group(); b.position.y = 0.45; g.add(b); I.addProp(g, x, z, 0, 0.5, 0.5);
    }
    for (const [x, z] of [[-15, 238], [80, 250]]) {
      const g = genModel(['flamingo_float', 'flamingo', '火烈鸟泳圈'], 1.6) || (() => {
        const f = new THREE.Group(), pink = mat(0xff7ab8, { roughness: 0.35 });
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.32, 10, 24), pink); ring.rotation.x = Math.PI / 2; ring.position.y = 0.32; f.add(ring);
        const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.3), pink); neck.position.set(0.8, 0.9, 0); neck.rotation.z = 0.25; f.add(neck);
        const hd = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), pink); hd.position.set(0.65, 1.55, 0); f.add(hd);
        const bk = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.3, 6), mat(0x222222)); bk.position.set(0.45, 1.5, 0); bk.rotation.z = Math.PI / 2; f.add(bk);
        return f;
      })();
      I.addProp(g, x, z, Math.random() * 6, 1.0, 1);
    }
    // 排球网
    const net = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.0), new THREE.MeshStandardMaterial({ map: drawTex(256, 32, (c) => { c.strokeStyle = '#fff'; c.lineWidth = 2; for (let i = 0; i < 256; i += 8) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 32); c.stroke(); } for (let j = 0; j < 32; j += 8) { c.beginPath(); c.moveTo(0, j); c.lineTo(256, j); c.stroke(); } }), transparent: true, side: THREE.DoubleSide }));
    net.position.set(-5, 2.1, 262); I.add(net);
    for (const sx of [-4.6, 4.6]) cyl(I, 0.06, 0.06, 2.6, -5 + sx, groundH(-5 + sx, 262), 262, mat(0xdddddd));
  }

  buildVendor() {
    const I = this.island;
    const v = new Cardboard(I.scene, { name: '防晒霜小贩', color: '#ffe066', face: 'star', h: 1.75 });
    v.root.position.set(15, 0, 224.5); v.root.rotation.y = Math.PI; v.yaw = Math.PI; this.vendor = v;
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.5, 10), mat(0xff8a3a)); bottle.position.set(0.5, 1.2, 0.2); v.root.add(bottle);
    this.gags.add({ id: 'sunscreen', x: 15, z: 222, r: 5, cool: 30, fire: (g) => {
      v.say('防晒霜 SPF 2079！涂了 AI 就看不见你');
      g.ui.popup('<h3>🧴 已涂防晒霜 SPF 2079</h3><p>AI 识别率 -50%</p><p>副作用：活人感 -3%（皮肤太光滑了）</p>', '', 2.6);
      g.meter = Math.max(0, g.meter - 3); g.ui.setMeter(g.meter); g.laugh += 3;
    } });
  }

  // 黄金时刻锁定：只在自由闯荡（或入夜一段时间后）生效，离开海滩恢复
  canLock(g) { return g.phase === 'free' || (g.phase === 'night' && g.time - (g.nightStart || 0) > 25); }
  lockSun(g, on) {
    const env = g.env;
    if (on && !this.locked) { this.locked = { hour: env.hour, speed: env.speed }; env.speed = 0; env.hour = 18.2; env.apply(); }
    else if (!on && this.locked) { env.hour = this.locked.hour; env.speed = this.locked.speed; this.locked = false; env.apply(); }
  }

  animate(dt, t) {
    if (this.wheel) {
      if (this.wheelBoost > 0) this.wheelBoost -= dt;
      this.wheel.rotation.z += dt * (this.wheelBoost > 0 ? 1.2 : 0.08);
      for (const c of this.cabins) c.rotation.z = -this.wheel.rotation.z;
    }
  }

  update(g, dt, inside) {
    const p = g.player;
    if (inside) this.gags.update(g, p);
    this.guard.tickBubble(dt); this.vendor.tickBubble(dt);
    this.lockSun(g, inside && this.canLock(g) && g.state !== 'finale');
  }

  // ---------- 当地任务：沙滩躲亲戚（躲） ----------
  startQuest(g) {
    const I = this.island;
    this.rels = RELS.map((r, i) => {
      const c = new Chaser(g.world, 'aunt', V3(-90 + i * 55, 0, 258), r);
      c.say(r.lines[0]); return { c, cool: 0 };
    });
    this.hides = HIDE.map(([x, z]) => {
      const u = new THREE.Group();
      const top = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.0, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0x7ef6ff, emissive: 0x2ab8ff, emissiveIntensity: 0.5, side: THREE.DoubleSide }));
      top.position.y = 3.0; u.add(top);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3), mat(0xffffff)); pole.position.y = 1.5; u.add(pole);
      const ring = new THREE.Mesh(new THREE.RingGeometry(2.0, 2.3, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 2.5, 3), side: THREE.DoubleSide })); ring.position.y = 0.08; u.add(ring);
      u.position.set(x, groundH(x, z), z); g.world.add(u);
      return { u, x, z, used: 0, off: 0, top };
    });
    this.caught = 0; this.hidden = null; void I;
  }
  updateQuest(g, dt, a) {
    const p = g.player, I = this.island;
    if (p.pos.z < 204) { this.ranAway = true; return { fail: true }; }
    // 躲伞
    let hide = null;
    for (const h of this.hides) {
      if (h.off > 0) { h.off -= dt; h.top.material.emissiveIntensity = 0; continue; }
      h.top.material.emissiveIntensity = 0.5;
      if (Math.hypot(p.pos.x - h.x, p.pos.z - h.z) < 2.3 && (p.mode === 'foot' || Math.abs(p.speed) < 4)) hide = h;
    }
    if (hide) {
      if (this.hidden !== hide) { this.hidden = hide; hide.used = 0; g.ui.danmaku('躲进伞下了！', true); }
      hide.used += dt;
      if (hide.used > 6) {
        hide.off = 10; this.hidden = null;
        g.ui.popup('<h3>伞主人回来了</h3><p>「这伞 ¥80 一小时，你躲了 6 秒，给你抹个零：¥80」</p>', 'bad', 2.4); g.audio.coin(); g.laugh += 3;
      }
    } else this.hidden = null;
    const fake = { pos: V3(0, 0, 0), mode: 'foot', speed: 0, vel: V3(0, 0, 0) };
    for (const r of this.rels) {
      r.cool -= dt;
      if (this.hidden) { fake.pos.set(r.c.root.position.x + Math.sin(g.time + r.c.phase) * 6, 0, r.c.root.position.z + Math.cos(g.time * 0.7 + r.c.phase) * 6); r.c.update(dt, fake, I); if (Math.random() < dt * 0.3) r.c.say('人呢？'); }
      else r.c.update(dt, p, I);
      if (!this.hidden && !r.c.flying && r.cool <= 0 && flat(p.pos, r.c.root.position) < 1.5) {
        this.caught++; r.cool = 4;
        const q = r.c.lines[Math.floor(Math.random() * r.c.lines.length)];
        r.c.say(q); g.ui.popup(`<h3>被问到了（${this.caught}/3）</h3><p>「${q}」</p>`, 'warn', 1.8);
        g.audio.crash(); g.pipe.shake = 0.5; g.laugh += 5;
        const dx = p.pos.x - r.c.root.position.x, dz = p.pos.z - r.c.root.position.z, d = Math.hypot(dx, dz) || 1;
        r.c.root.position.x -= dx / d * 8; r.c.root.position.z -= dz / d * 8;
      }
    }
    // 导航指向最近的能用的伞
    let best = null, bd = 1e9;
    for (const h of this.hides) if (h.off <= 0) { const d = Math.hypot(p.pos.x - h.x, p.pos.z - h.z); if (d < bd) { bd = d; best = h; } }
    a.nav = best && !this.hidden ? { pos: V3(best.x, 0, best.z), label: '躲进遮阳伞' } : null;
    if (this.caught >= 3) return { fail: true };
    return { note: `被问 ${this.caught}/3 · ${this.hidden ? '躲着呢（' + Math.max(0, 6 - this.hidden.used).toFixed(0) + ' 秒）' : '快跑'} · 撑到 0 秒就赢`, win: a.t <= 0.05 };
  }
  // 自动验收用：一直往离亲戚最远的伞挪
  testStep(g) {
    const p = g.player; let best = null, bs = -1;
    for (const h of this.hides || []) {
      if (h.off > 0) continue;
      const s = Math.min(...this.rels.map((r) => Math.hypot(r.c.root.position.x - h.x, r.c.root.position.z - h.z)));
      if (s > bs) { bs = s; best = h; }
    }
    if (best && (!this.hidden || this.hidden.used > 5)) g.dev.tp(best.x, best.z, 0);
  }
  endQuest(g, win) {
    for (const r of this.rels || []) g.world.remove(r.c.root);
    for (const h of this.hides || []) g.world.remove(h.u);
    this.rels = []; this.hides = [];
    const ran = this.ranAway; this.ranAway = false;
    return win
      ? [`被问到：${this.caught} / 3 次`, '工资、对象、房子、编制：<b>全部保密</b>', '七大姑：明年过年见']
      : ran ? ['跑出海滩 = 认输', '七大姑：跑什么跑，过年还不是要回来', '亲戚们已建群：「关心奶蛙」'] : [`被问到：${this.caught} 次`, '你一个月挣多少：已被全家知道', '亲戚们已建群：「关心奶蛙」'];
  }
}
