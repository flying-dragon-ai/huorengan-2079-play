// 老家县城：纽约地铁的终点站，也是班主任随机抽查的起点
import * as THREE from 'three';
import { mat, box, cyl, board, neon, drawTex, V3, Gags, flat } from './kit.js';
import { Cardboard } from '../../actors/npc/index.js';
import { genModel } from '../../actors/models.js';

const ERRANDS = [
  { x: -128, z: 71, who: '县一中后门', line: '拌粉到了？先背：落霞与孤鹜齐飞！' },
  { x: -137, z: 119, who: '菜市场', line: '辣椒算蔬菜，也算水果，更能算主食。' },
  { x: -68, z: 131, who: '公交站', line: '车刚走，下一班在你毕业以后。' },
  { x: -100, z: 60, who: '班主任', line: '全文背诵！放学留下，奶蛙家长来一趟。' },
];
export class Hometown {
  constructor(island) {
    this.island = island; this.id = 'hometown'; this.name = '老家县城';
    this.tagline = '县一中 · 拌粉瓦罐汤 · 班主任在后座'; this.center = [-100, 104];
    this.bounds = [-157, -43, 43, 157]; this.color = '#ff796e'; this.gags = new Gags();
    this.views = [['school', '-100,12,46', '-128,5,78', 9], ['market', '-104,8,107', '-137,3,124', 17], ['bus', '-51,6,148', '-69,2,134', 17]];
    this.buildSchool(); this.buildMarket(); this.buildBus(); this.buildHill(); this.buildTeacher(); this.buildPeople();
    this.quest = { title: '逃不掉的早读', short: '送拌粉并背完课文', kind: '送', time: 90, gain: 15,
      at: V3(-100, 0, 65), intro: ['班主任', '90 秒把三份拌粉送到，再回来默写！别拧油门，落霞与孤鹜齐飞，下一句？'],
      goal: '给学校、菜市场、公交站送拌粉，再回班主任身边', cheer: ['全文背诵通过', '辣椒摄入达标', '今天不用叫家长', '县城学霸'],
      start: (g, a) => this.startQuest(g, a), update: (g, dt, a) => this.updateQuest(g, dt, a), end: (g, win, a) => this.endQuest(g, win, a),
    };
    this.marks = [{ x: -128, z: 80, color: '#ffd464', r: 5, label: '县一中' }, { x: -137, z: 119, color: '#79dd77', r: 5, label: '菜市场' }];
  }
  buildSchool() {
    const I = this.island, wall = mat(0xf0d7ac), red = mat(0xa52f26);
    for (const [x, z, w, d, h] of [[-137, 82, 18, 20, 12], [-113, 83, 18, 18, 10]]) {
      box(I, w, h, d, x, 0, z, wall, { col: true });
      for (let yy = 3; yy < h; yy += 3) for (let xx = x - w / 2 + 2; xx < x + w / 2 - 1; xx += 3.2) box(I, 1.4, 1.5, .08, xx, yy, z + d / 2 + .05, mat(0x40677c, { emissive: 0x233947, emissiveIntensity: .4 }));
      box(I, w + .5, .5, d + .5, x, h, z, red);
    }
    box(I, 1, 6, 1, -138, 0, 64, red, { col: true }); box(I, 1, 6, 1, -118, 0, 64, red, { col: true });
    box(I, 21, 1, 1.2, -128, 6, 64, red);
    board(I, ['县第一中学', '今日早读：落霞与孤鹜齐飞'], 13, 2.3, -128, 4.2, 63.35, Math.PI, { bg: '#a52f26', fg: '#fff2bf' });
    board(I, ['距高考还有 1 天', '（永远只有一天）'], 5.5, 2, -147, 2, 70, Math.PI / 2, { bg: '#f4e6c3', fg: '#bc2a21' });
    this.gags.add({ id: 'gaokao', x: -128, z: 66, r: 9, cool: 35, fire: (g) => {
      g.line(['学校广播', '距高考只剩一天。昨天也是一天，明天也是一天。心态最重要。'], 4.5);
      g.ui.burst(['永远高考前一天', '十年寒窗又十年', '学校的时间循环了'], 5); g.laugh += 4;
    } });
  }
  buildMarket() {
    const I = this.island;
    box(I, 30, .25, 19, -130, 4.6, 126, mat(0x3b7561));
    for (const x of [-144, -116]) for (const z of [118, 134]) cyl(I, .12, .12, 4.6, x, 0, z, mat(0x68726d));
    for (let i = 0; i < 5; i++) {
      const x = -141 + i * 5.5;
      box(I, 4.4, 1.1, 2, x, 0, 121, mat(0xa87340), { col: true });
      for (let k = 0; k < 10; k++) { const p = new THREE.Mesh(new THREE.SphereGeometry(.22, 7, 5), mat([0xe83e32, 0x6cb342, 0xf4c442][i % 3])); p.position.set(x + (k % 5 - 2) * .65, 1.27, 120.6 + Math.floor(k / 5) * .6); I.add(p); }
    }
    board(I, ['菜市场 · 辣椒专区', '辣椒是蔬菜 / 水果 / 县城硬通货'], 11, 1.8, -130, 3.6, 117.8, Math.PI, { bg: '#c83228', fg: '#fff0a0' });
    board(I, ['拌粉 ¥6 + 瓦罐汤 ¥5', '不要辣 = 微辣（县城定义）'], 7.5, 1.7, -116, 2.7, 126, -Math.PI / 2, { bg: '#5e241b', fg: '#ffe8a5' });
    this.gags.add({ id: 'chili', x: -132, z: 115, r: 9, cool: 27, fire: (g) => {
      g.ui.popup('<h3>🌶️ 不要辣</h3><p>老板：明白，微辣。</p><p>微辣 = 只放一瓢，不放两瓢。</p>', 'warn', 3); g.laugh += 3;
    } });
    this.gags.add({ id: 'soup', x: -116, z: 128, r: 6, cool: 32, fire: (g) => {
      g.line(['瓦罐汤老板', '汤不烫，是瓦罐很有事业心，一直在发热。'], 4); g.laugh += 3;
    } });
  }
  buildBus() {
    const I = this.island, bus = genModel(['hometown_bus'], 3.4) || (() => {
      const g = new THREE.Group();
      // 备用公交车使用简单的彩色盒体
      const body = new THREE.Mesh(new THREE.BoxGeometry(3, 2.5, 7), mat(0xe6d6a8)); body.position.y = 1.6; g.add(body);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.03, .55, 7.03), mat(0x63a291)); stripe.position.y = 1.15; g.add(stripe);
      for (const x of [-1.52, 1.52]) for (const z of [-2.3, 2.3]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(.48, .48, .28, 14).rotateZ(Math.PI / 2), mat(0x1a1a1a)); w.position.set(x, .5, z); g.add(w); }
      return g;
    })();
    bus.position.set(-70, 0, 137); bus.rotation.y = .15; I.add(bus); I.col.add(-72, -68, 133, 141, 3.4);
    for (const x of [-78, -69]) cyl(I, .08, .08, 3.5, x, 0, 128, mat(0x515c64));
    box(I, 10, .25, 3, -73.5, 3.5, 128, mat(0x4d7b84));
    board(I, ['县城 1 路 · 环线', '刚走一辆 · 下辆待定'], 5, 1.7, -73.5, 2.5, 126.4, Math.PI, { bg: '#164858', fg: '#d4fbff' });
    this.gags.add({ id: 'bus_wait', x: -74, z: 125, r: 7, cool: 25, fire: (g) => {
      g.ui.popup('<h3>🚌 您刚错过一班车</h3><p>下一班预计：吃完拌粉以后</p><p>实时公交：全靠问门口大爷</p>', '', 3.3); g.laugh += 3;
    } });
  }
  buildHill() {
    const I = this.island;
    for (let i = 0; i < 4; i++) cyl(I, 7 - i * 1.5, 8 - i * 1.4, 2.2, -145, i * 2.2, 143, mat(0x6f8950));
    for (const x of [-148, -142]) for (const z of [140, 146]) cyl(I, .18, .18, 4, x, 8.8, z, mat(0x9d3b28));
    const roof = new THREE.Mesh(new THREE.ConeGeometry(6, 2.8, 4), mat(0x39433c)); roof.rotation.y = Math.PI / 4; roof.position.set(-145, 13.7, 143); I.add(roof);
    board(I, ['思乡亭', 'WiFi满格 · 乡愁满格'], 4.5, 1.2, -145, 10, 138.3, Math.PI, { bg: '#9d3b28', fg: '#ffe7a0' });
  }
  buildTeacher() {
    const I = this.island, model = genModel(['hometown_teacher'], 1.8);
    if (model) { model.position.set(-94, 0, 63); I.add(model); this.teacherModel = model; }
    this.teacher = new Cardboard(I.scene, { name: '班主任', color: '#ac5362', face: 'calm', h: 1.8 });
    this.teacher.root.position.set(-94, 0, 63); this.teacher.root.visible = !model;
    this.gags.add({ id: 'teacher_backseat', x: -100, z: 58, r: 10, cool: 26, fire: (g) => this.teacherRide(g) });
  }
  teacherRide(g) {
    if (this.rideT > 0) return;
    this.rideT = 11; const p = g.player;
    this.teacher.root.visible = false; if (this.teacherModel) this.teacherModel.visible = false;
    this.backseat = genModel(['hometown_teacher'], 1.35) || this.teacher.root.clone(true);
    this.backseat.visible = true; this.backseat.position.set(0, p.mode === 'bike' ? 0.38 : 0, -0.95); p.root.add(this.backseat);
    g.ui.banner('班主任坐上了你的电驴', '落霞与孤鹜齐飞，下一句？'); g.audio.say('落霞与孤鹜齐飞，下一句？', { pitch: .9 });
    g.ui.burst(['随机抽查', '骑车也不能逃课', '后座有班主任', '下一句是啥来着'], 6); g.laugh += 6;
  }
  buildPeople() {
    const I = this.island, model = genModel(['hometown_granny'], 1.7);
    if (model) { model.position.set(-134, 0, 116); I.add(model); this.granny = model; }
    this.aunt = new Cardboard(I.scene, { name: model ? '卖菜阿姨（立牌代班）' : '卖菜阿姨', color: '#e89b73', face: 'grin', h: 1.7 });
    this.aunt.root.position.set(-132, 0, 116); this.aunt.root.visible = !model;
  }
  startQuest(g, a) { this.qi = 0; this.recite = 0; this.teacherRide(g); }
  updateQuest(g, dt, a) {
    const d = ERRANDS[this.qi];
    if (d && flat(g.player.pos, d) < 5) {
      this.qi++; this.recite = 5; g.audio.ding(); g.ui.banner(`拌粉送达 ${this.qi}/3`, d.line);
      if (this.qi < 4) g.ui.say(d.who, d.line, 3); g.laugh += 4;
    }
    if (this.qi === 3) {
      this.recite -= dt;
      const answers = ['秋水共长天一色', '渔舟唱晚，响穷彭蠡之滨', '雁阵惊寒，声断衡阳之浦'];
      const idx = Math.min(2, Math.floor(5 - Math.max(0, this.recite)));
      if (this.recite > 0) a.note = `班主任抽查：${answers[idx]}`;
      else { this.qi = 4; g.ui.banner('默写通过', '班主任：骑车的时候也不要放松学习'); }
    }
    const n = ERRANDS[this.qi]; a.nav = n ? { pos: V3(n.x, 0, n.z), label: this.qi < 3 ? `拌粉 → ${n.who}` : '回班主任身边默写' } : null;
    return { note: a.note || `拌粉 ${Math.min(this.qi, 3)}/3 · 老师正在后座`, win: this.qi >= 4 };
  }
  endQuest(g, win, a) { a.nav = null; return win ? ['三份拌粉全送到，课文也背完了', '班主任：明天开始预习下一篇', '奖励：不用叫家长（今天）'] : [`拌粉送到 ${Math.min(this.qi || 0, 3)}/3`, '默写没赶上：老师决定上门家访', '辣椒油洒了也算社会实践']; }
  update(g, dt, inside) {
    if (inside) this.gags.update(g, g.player);
    this.teacher.tickBubble(dt); this.aunt.tickBubble(dt);
    if (this.rideT > 0 && (this.rideT -= dt) <= 0 && this.backseat) {
      this.backseat.removeFromParent(); this.backseat = null; this.teacher.root.visible = !this.teacherModel;
      if (this.teacherModel) this.teacherModel.visible = true; g.ui.danmaku('班主任下车：回去把全文抄三遍', true);
    }
  }
}
