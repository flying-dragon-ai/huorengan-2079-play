// 魔都弄堂（上海参考图）：梧桐、石库门、十家咖啡店一家比一家贵、西方明珠塔、老电车
// 当地任务（打）：咖啡店打工——把门口只拍照不买的网红撞走
// 只在这里有的笑点：咖啡价格阶梯（最后一杯八百送一句加油）、排队网红、明珠塔收费合影、梧桐落叶警告
import * as THREE from 'three';
import { mat, box, cyl, board, neon, drawTex, V3, Gags, flat } from './kit.js';
import { Cardboard } from '../../actors/npc/index.js';

const CAFES = [
  ['咖啡 · 平价', '¥18', '良心价（杯子另收）'], ['燕麦拿铁', '¥38', '燕麦是进口的燕麦'], ['冷萃 · 冥想', '¥58', '喝前请先冥想十分钟'],
  ['一杯八十', '¥80', '多加冰，少加班'], ['手冲 · 有故事', '¥128', '豆子坐过头等舱'], ['咖啡 · 上班', '¥198', '喝完自动打卡'],
  ['精品 · 禁止拍照', '¥288', '杯子比你贵'], ['豆子见过海', '¥388', '豆子比你先去过马尔代夫'], ['520 拿铁', '¥520', '拉花是你前任'],
  ['加油咖啡', '¥800', '一杯八百，送你一句加油'],
];
const INFLU = [['探店博主', '#ff8ad8'], ['九宫格', '#ffd84a'], ['氛围感', '#7ef6ff'], ['拉花测评', '#ffb36b'], ['打卡达人', '#a8ff7e'], ['佛系拍照', '#c9a0ff'], ['咖啡 KOL', '#ff6b6b'], ['小红薯', '#ff5fa8']];
const INFLU_SAY = ['家人们看这个拉花！', '别挡我光！', '这杯我只拍不喝', '再拍最后一张', '氛围感拉满', '我的九宫格还差一格', '这个角度显瘦', '老板能打折吗我有十个粉丝'];

function selfieStick(root) {
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.2, 6), mat(0x222222));
  stick.position.set(0.45, 1.55, 0.25); stick.rotation.z = -0.7; stick.rotation.x = 0.3; root.add(stick);
  const phone = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.55, 0.04), mat(0x111111, { emissive: 0x5577ff, emissiveIntensity: 0.6 }));
  phone.position.set(0.85, 2.0, 0.42); root.add(phone);
}

export class Shanghai {
  constructor(island) {
    this.island = island; this.id = 'shanghai';
    this.name = '魔都弄堂'; this.tagline = '梧桐 · 石库门 · 一条街十家咖啡店'; this.color = '#ff8ad8';
    this.center = [-100, -105]; this.bounds = [-157, -43, -157, -43];
    this.gags = new Gags();
    this.buildCafes();
    this.buildTrees();
    this.buildTram();
    this.buildLaundry();
    this.buildQueue();
    this.buildPhotographer();
    this.quest = {
      title: '咖啡店打工', short: '咖啡店打工', kind: '打', time: 75, gain: 12, at: V3(-132, 0, -96),
      intro: ['咖啡店老板', '门口全是只拍照不买的网红！帮我撞走 8 个，日薪八十（扣工服费八十）。'],
      goal: '撞飞门口拍照的网红（骑车撞或者跑过去撞）',
      cheer: ['网红清场完毕', '老板：明天还来吗', '日薪 0 元', '打工人的胜利'],
      start: (g, a) => this.startQuest(g, a), update: (g, dt, a) => this.updateQuest(g, dt, a), end: (g, win, a) => this.endQuest(g, win, a),
    };
  }

  // 十家咖啡店：按从西到东的顺序越来越贵，最后一家一杯八百
  buildCafes() {
    const I = this.island;
    const rows = (I.shRows || []).slice(0, 10).sort((a, b) => a.x - b.x);
    this.cafes = [];
    rows.forEach((s, i) => {
      const [name, price, tag] = CAFES[i];
      const north = s.z < s.zFront, dir = north ? 1 : -1, ry = north ? 0 : Math.PI;
      const zf = s.zFront + dir * 0.25, w = Math.min(7, s.w - 2);
      neon(I, name, ['#ffb347', '#ff6f91', '#7ef0ff', '#ffe66d'][i % 4], w, w / 4, s.x, 4.7, zf, ry, { bg: '#1a120c' });
      const pt = board(I, [price], 2.2, 1.1, s.x + w / 2 - 0.6, 6.4, zf + dir * 0.05, ry, { bg: i === 9 ? '#b0122a' : '#2a1a10', fg: '#ffe9a8', glowK: 1.3 });
      // 门口雨棚
      const aw = box(I, Math.min(6, s.w - 2.5), 0.12, 1.6, s.x, 3.2, s.zFront + dir * 0.8, mat([0x8a1f2a, 0x1f4a3a, 0x2a3a6a, 0x6a2a1a][i % 4]));
      aw.rotation.x = -dir * 0.25;
      // 外摆：一桌两椅一块小黑板，撞了会飞
      const g = new THREE.Group();
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.05, 16), mat(0xe8e2d6, { metalness: 0.3 })); top.position.y = 0.75; g.add(top);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.75, 6), mat(0x333333)); leg.position.y = 0.37; g.add(leg);
      for (const cx of [-0.75, 0.75]) {
        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.42), mat(0xb08a5a)); seat.position.set(cx, 0.45, 0); g.add(seat);
        const back = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.05), mat(0xb08a5a)); back.position.set(cx, 0.72, cx > 0 ? 0.2 : -0.2); back.rotation.y = Math.PI / 2; g.add(back);
      }
      const chalk = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.0), new THREE.MeshStandardMaterial({ map: drawTex(256, 320, (x) => {
        x.fillStyle = '#1d2a22'; x.fillRect(0, 0, 256, 320); x.strokeStyle = '#a07a4a'; x.lineWidth = 14; x.strokeRect(0, 0, 256, 320);
        x.fillStyle = '#fff'; x.font = '800 52px "PingFang SC"'; x.textAlign = 'center'; x.fillText(price, 128, 90);
        x.font = '600 26px "PingFang SC"'; const t = tag; x.fillText(t.slice(0, 8), 128, 170); x.fillText(t.slice(8, 16), 128, 210);
        x.fillStyle = '#ffd84a'; x.fillText('今日推荐', 128, 280);
      }), roughness: 0.9 }));
      chalk.position.set(1.4, 0.55, 0); chalk.rotation.y = north ? 0 : Math.PI; g.add(chalk);
      I.addProp(g, s.x - 1.5, s.zFront + dir * 2.2, 0, 1.1, 2);
      const spot = V3(s.x, 0, s.zFront + dir * 4.5); // 店门口的路边
      this.cafes.push({ s, name, price, tag, pt, spot, dir });
      this.gags.add({
        id: 'cafe' + i, x: spot.x, z: spot.z, r: 5.5, cool: 45,
        fire: (g) => {
          g.districts.bubble(this.priceAnchor(i), `${price}：${tag}`, 3, 0.2);
          g.laugh += 2;
          if (i === 9) {
            g.ui.banner('一杯八百', '送你一句：加油');
            g.ui.popup('<h3>☕ 加油咖啡 · ¥800</h3><p>已自动扣款 <b>¥800</b></p><p>赠品：一句「加油」（口头，不可转让）</p>', 'bad', 3);
            g.audio.coin(); g.audio.say('一杯八百，送你一句：加油！', { pitch: 1.1 });
            g.ui.burst(['八百！！', '加油是赠品', '这咖啡里有金子', '我选择喝自来水', '魔都物价'], 7);
          } else if (i >= 6) g.ui.danmaku(`${name} ${price}？？`, true);
        },
      });
    });
  }
  priceAnchor(i) {
    const c = this.cafes[i];
    if (!c.anchor) { c.anchor = new THREE.Object3D(); c.anchor.position.set(c.s.x, 7.6, c.s.zFront + c.dir * 0.6); this.island.add(c.anchor); }
    return c.anchor;
  }

  // 梧桐：灰白斑驳的树干，宽大的黄绿色树冠，沿弄堂两边
  buildTrees() {
    const I = this.island, r = I.r;
    const trunk = new THREE.CylinderGeometry(0.28, 0.42, 6.5, 8); trunk.translate(0, 3.25, 0);
    const leaf = new THREE.IcosahedronGeometry(2.2, 1); leaf.scale(1.25, 0.7, 1.25);
    const bark = new THREE.MeshStandardMaterial({ roughness: 0.9, map: drawTex(128, 256, (x) => {
      x.fillStyle = '#c9c2a8'; x.fillRect(0, 0, 128, 256);
      for (let i = 0; i < 60; i++) { x.fillStyle = ['#8f8a6c', '#e3dcc3', '#6f6a52', '#a9b08a'][i % 4]; x.beginPath(); x.ellipse(Math.random() * 128, Math.random() * 256, 6 + Math.random() * 18, 4 + Math.random() * 12, Math.random() * 3, 0, 7); x.fill(); }
    }) });
    const tm = [], lm = [], lc = [];
    const tables = this.cafes.map((c) => c.s.x);
    for (const side of [-1, 1]) for (let x = -146; x < -54; x += 13) {
      const xx = x + (side > 0 ? 6 : 0);
      if (tables.some((tx) => Math.abs(tx - 1.5 - xx) < 3.2) || Math.abs(xx + 100) < 4) continue;
      const z = -100 + side * 8.9;
      const s = 0.9 + r() * 0.3;
      tm.push(new THREE.Matrix4().compose(V3(xx, 0, z), new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), r() * 6), V3(s, s, s)));
      for (let k = 0; k < 4; k++) {
        lm.push(new THREE.Matrix4().compose(V3(xx + (r() - 0.5) * 4 * s, (6.2 + r() * 1.6) * s, z + (r() - 0.5) * 3.5 * s - side * 1.2, ), new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), r() * 6), V3(s, s, s).multiplyScalar(0.8 + r() * 0.4)));
        lc.push(new THREE.Color().setHSL(0.17 + r() * 0.08, 0.55, 0.36 + r() * 0.12));
      }
      I.col.add(xx - 0.4, xx + 0.4, z - 0.4, z + 0.4, 6);
    }
    const T = new THREE.InstancedMesh(trunk, bark, tm.length); tm.forEach((m, i) => T.setMatrixAt(i, m)); T.castShadow = true; I.add(T);
    const L = new THREE.InstancedMesh(leaf, new THREE.MeshStandardMaterial({ roughness: 0.8, flatShading: true }), lm.length);
    lm.forEach((m, i) => { L.setMatrixAt(i, m); L.setColorAt(i, lc[i]); }); L.castShadow = true; I.add(L);
    this.leafColor = new THREE.Color(0.85, 0.75, 0.25);
    this.gags.add({ id: 'leaves', x: -100, z: -100, r: 50, cool: 35,
      when: (g) => g.player.mode === 'bike' && Math.abs(g.player.speed) > 19 && Math.abs(g.player.pos.z + 100) < 8,
      fire: (g) => {
        for (let i = 0; i < 4; i++) g.fx.puff(g.player.pos.clone().add(V3((Math.random() - 0.5) * 6, 6, (Math.random() - 0.5) * 6)), 14, this.leafColor, 3);
        g.ui.danmaku('梧桐：骑慢点，我叶子掉光了', true); g.ui.danmaku('魔都限速：法式慢生活'); g.laugh += 2;
      } });
  }

  // 老电车：停在弄堂东头，牌子写着开往 2079
  buildTram() {
    const I = this.island, x = -76, z = -104.6;
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(10, 2.6, 2.5), mat(0xc79a3a, { roughness: 0.5 })); body.position.y = 1.9; g.add(body);
    const belt = new THREE.Mesh(new THREE.BoxGeometry(10.05, 0.5, 2.55), mat(0x2f5a3a)); belt.position.y = 1.0; g.add(belt);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(10.3, 0.3, 2.7), mat(0x6a5038)); roof.position.y = 3.35; g.add(roof);
    const win = I.neonMat(new THREE.Color(1.6, 1.25, 0.7));
    for (let i = -4; i <= 4; i += 1.3) for (const sz of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), win); w.position.set(i, 2.35, sz * 1.27); if (sz < 0) w.rotation.y = Math.PI; g.add(w); }
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.6), mat(0x222222)); pole.position.set(2, 4.6, 0); pole.rotation.z = 0.5; g.add(pole);
    g.traverse((m) => { if (m.isMesh) { m.castShadow = true; } });
    g.position.set(x, 0, z); I.add(g);
    I.col.add(x - 5, x + 5, z - 1.25, z + 1.25, 3.5);
    board(I, ['71 路 · 开往 2079', '本车已停运 54 年'], 3.4, 1.1, x - 5.1, 2.7, z, -Math.PI / 2, { bg: '#2f5a3a' });
  }

  // 晾衣杆：石库门二楼伸出来的竹竿，挂着秋裤
  buildLaundry() {
    const I = this.island;
    const cloth = [0xff6b6b, 0x6bc4ff, 0xffffff, 0xffd84a, 0xb58aff];
    (I.shRows || []).slice(10, 16).forEach((s, k) => {
      const north = s.z < s.zFront, dir = north ? 1 : -1;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, s.w * 0.8), mat(0xb89a5a));
      pole.rotation.z = Math.PI / 2; pole.position.set(s.x, 6.4, s.zFront + dir * 1.2); I.add(pole);
      for (let i = 0; i < 4; i++) {
        const c = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.0 + (i % 2) * 0.4), mat(cloth[(i + k) % 5], { side: THREE.DoubleSide }));
        c.position.set(s.x - s.w * 0.3 + i * s.w * 0.2, 5.8, s.zFront + dir * 1.2); I.add(c);
      }
    });
  }

  // 「加油咖啡」门口排队的网红：排队两小时、拍照五秒、不喝
  buildQueue() {
    const I = this.island, c = this.cafes[9];
    if (!c) return;
    this.queue = [];
    for (let i = 0; i < 5; i++) {
      const [name, color] = INFLU[(i + 3) % INFLU.length];
      const n = new Cardboard(I.scene, { name, color, face: i % 2 ? 'shy' : 'grin', h: 1.7 });
      selfieStick(n.root);
      n.home = V3(c.s.x - 4 - i * 1.3, 0, c.s.zFront + c.dir * 1.4);
      n.root.position.copy(n.home); n.yaw = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2; n.root.rotation.y = n.yaw;
      this.queue.push(n);
    }
    board(I, ['排队 2 小时', '拍照 5 秒 · 不喝'], 2.4, 1.2, c.s.x - 4 - 5 * 1.3 - 0.8, 1.2, c.s.zFront + c.dir * 1.4, c.dir > 0 ? 0 : Math.PI, { bg: '#ffffff', fg: '#c0182a' });
  }

  // 明珠塔下的收费合影
  buildPhotographer() {
    const I = this.island;
    const p = new Cardboard(I.scene, { name: '摄影师', color: '#9fd0ff', face: 'grin', h: 1.8 });
    p.root.position.set(-93, 0, -111.5); p.yaw = 0; p.root.rotation.y = 0;
    const cam = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.3), mat(0x111111)); cam.position.set(0, 1.5, 0.3); p.root.add(cam);
    this.photog = p;
    board(I, ['明珠塔合影', '¥80 / 张（不含你）'], 2.6, 1.3, -89.5, 1.0, -111.2, 0, { bg: '#30184a', fg: '#ffd88a' });
    this.gags.add({ id: 'photo', x: -93, z: -108, r: 5.5, cool: 40, fire: (g) => {
      p.say('来，看镜头，茄子！'); g.flash = 0.9; g.audio.tone('square', 2000, 2000, 0.05, 0.2);
      g.tl.at(0.8, () => {
        g.ui.popup('<h3>📸 合影成功</h3><p>已扣款 <b>¥80</b></p><p>温馨提示：照片里只有塔，没有你（你的活人感太低，拍不出来）</p>', 'bad', 3.2);
        g.audio.coin(); g.ui.burst(['照片里没有我', '八十块拍了个塔', '摄影师：AI 修掉了', '魔都特色'], 5);
      });
      g.laugh += 4;
    } });
  }

  update(g, dt, inside) {
    const p = g.player, I = this.island;
    if (inside) this.gags.update(g, p);
    // 排队网红被撞飞、会自己爬回来接着排
    for (const n of this.queue || []) this.tickCardboard(g, n, dt, inside, '我的九宫格！');
    this.photog.tickBubble(dt); this.photog.physics(dt, I);
    if (inside && !this.photog.flying && flat(p.pos, this.photog.root.position) < 1.5 && p.mode === 'bike' && Math.abs(p.speed) > 6) { this.photog.knock(p.pos, p.vel); this.photog.say('我的镜头！八十！'); g.laugh += 4; }
    if (this.qn) for (const n of this.qn) {
      n.tickBubble(dt);
      if (n.physics(dt, I)) continue;
      if (n.out) continue;
      n.t = (n.t || 0) + dt;
      n.root.rotation.y = n.yaw + Math.sin(n.t * 3) * 0.3; // 转来转去找角度
      n.root.position.y = I.heightAt(n.root.position.x, n.root.position.z) + Math.abs(Math.sin(n.t * 4)) * 0.08;
    }
  }
  tickCardboard(g, n, dt, inside, cry) {
    const I = this.island, p = g.player;
    n.tickBubble(dt);
    if (n.physics(dt, I)) return;
    if (inside && flat(p.pos, n.root.position) < 1.5 && ((p.mode === 'bike' && Math.abs(p.speed) > 5) || (p.mode === 'foot' && Math.hypot(p.vel.x, p.vel.z) > 5))) {
      n.knock(p.pos, p.mode === 'bike' ? p.vel : p.vel.clone().multiplyScalar(2)); n.say(cry); g.laugh += 5; g.audio.boing();
      g.ui.danmaku(`${['排队的', '网红', '博主'][Math.floor(Math.random() * 3)]}被撞飞了`, true);
      return;
    }
    if (n.home && flat(n.root.position, n.home) > 0.6) n.walkTo(dt, n.home.x, n.home.z, 2.5, I);
  }

  // ---------- 当地任务：咖啡店打工（打） ----------
  startQuest(g) {
    const I = this.island;
    // 站在马路牙子边上拍照（避开梧桐和外摆桌）
    const spots = [[-140, -94.5], [-126.5, -105.5], [-120.5, -94.5], [-113.5, -105.5], [-87.5, -105.5], [-81.5, -94.5], [-68.5, -94.5], [-61, -105.5]];
    this.qn = spots.map(([x, z], i) => {
      const [name, color] = INFLU[i];
      const n = new Cardboard(g.world, { name, color, face: ['grin', 'shy', 'star', 'grin'][i % 4], h: 1.8 });
      selfieStick(n.root); n.root.position.set(x, 0, z); n.yaw = z > -100 ? Math.PI : 0; n.root.rotation.y = n.yaw;
      n.say(INFLU_SAY[i]); return n;
    });
    this.hit = 0; this.sayT = 2;
  }
  updateQuest(g, dt, a) {
    const p = g.player;
    for (const n of this.qn) {
      if (n.out) continue;
      const d = flat(p.pos, n.root.position);
      const fast = (p.mode === 'bike' && Math.abs(p.speed) > 4) || (p.mode === 'foot' && (Math.hypot(p.vel.x, p.vel.z) > 4.5 || p.air));
      if (d < 1.7 && fast) {
        n.knock(p.pos, p.mode === 'bike' ? p.vel : p.vel.clone().multiplyScalar(2.5)); n.out = true; this.hit++;
        n.say(['我还没修图！', '我的粉丝会替我报仇', '这条不发了', '取关！', '我只是想拍个照'][this.hit % 5]);
        g.audio.boing(); g.pipe.shake = 0.4; g.laugh += 6;
        g.ui.danmaku(`清场 ${this.hit}/8`, true);
        if (this.hit === 4) g.line(['咖啡店老板', '好！再撞四个，我给你拍个照（收费）'], 3);
      }
    }
    if ((this.sayT -= dt) <= 0) { this.sayT = 2.2; const alive = this.qn.filter((n) => !n.out); if (alive.length) alive[Math.floor(Math.random() * alive.length)].say(INFLU_SAY[Math.floor(Math.random() * INFLU_SAY.length)]); }
    // 导航指向最近的网红
    let best = null, bd = 1e9;
    for (const n of this.qn) if (!n.out) { const d = flat(p.pos, n.root.position); if (d < bd) { bd = d; best = n; } }
    a.nav = best ? { pos: best.root.position, label: '拍照的网红' } : null;
    return { note: `清场 ${this.hit}/8 · 还剩 ${Math.ceil(a.t)} 秒`, win: this.hit >= 8 };
  }
  // 自动验收用：沿着人行道从侧面冲过去
  testStep(g) {
    const n = (this.qn || []).find((n) => !n.out); if (!n) return;
    const q = n.root.position, p = g.player;
    if (this._tgt !== n || Math.abs(p.pos.z - q.z) > 1 || p.speed < 1) { this._tgt = n; g.dev.tp(q.x - 7, q.z, Math.PI / 2); }
    g.dev.ride(q.x + 3, q.z);
  }
  endQuest(g, win) {
    for (const n of this.qn || []) n.remove ? n.remove() : g.world.remove(n.root);
    const hit = this.hit; this.qn = null;
    return win
      ? [`清场：${hit} / 8 个网红`, '工资：¥80 − 工服 ¥80 = <b>¥0</b>', '老板：明天还来吗？']
      : [`清场：${hit} / 8 个网红（没撞完）`, '老板：你被开除了，但工服费照扣', '网红们：这条视频叫「被电驴追着跑的一天」'];
  }
}
