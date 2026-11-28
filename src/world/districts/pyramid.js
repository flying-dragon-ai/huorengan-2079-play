// 金字塔工地：千年工程、现代快递，以及关心砖块产权的阿努比斯
import * as THREE from 'three';
import { mat, box, cyl, board, neon, V3, Gags, flat } from './kit.js';
import { Cardboard } from '../../actors/npc/index.js';
import { genModel, standee } from '../../actors/models.js';

const DROPS = [
  { x: -70, z: -13, who: '金字塔一号垛', line: '这块放法老客厅，也就是整个金字塔。' },
  { x: -128, z: -5, who: '塔吊下班处', line: '砖收到，塔吊的加班费结一下。' },
  { x: -140, z: -27, who: '快递柜', line: '您有一个存放 3000 年的包裹。' },
  { x: -75, z: 31, who: '骆驼停车场', line: '停骆驼免费，开走收两把草。' },
];
export class Pyramid {
  constructor(island) {
    this.island = island; this.id = 'pyramid'; this.name = '金字塔工地';
    this.tagline = '千年工程 · 当日达 · 骆驼专用车位'; this.center = [-100, 0];
    this.bounds = [-157, -43, -43, 43]; this.color = '#ffc85a';
    this.gags = new Gags(); this.temp = [];
    this.views = [['overview', '-45,23,40', '-108,11,-9', 17], ['crane', '-145,10,31', '-128,15,15', 17]];
    this.buildPyramid(); this.buildScaffold(); this.buildCrane(); this.buildLocker();
    this.buildCamel(); this.buildForeman(); this.buildSiteProps();
    this.quest = {
      title: '给法老搬砖', short: '送四趟千年加急砖', kind: '送', time: 90, gain: 14,
      at: V3(-87, 0, 29),
      intro: ['阿努比斯监工', '四块千年加急砖，90 秒送完！不许问法老为什么也催发货。'],
      goal: '按 ◆ 把四块砖送到四个工地位置', cheer: ['法老确认收货', '骆驼拒绝五星好评', '工伤：笑出腹肌', '工地准时下班'],
      start: (g, a) => this.startQuest(g, a), update: (g, dt, a) => this.updateQuest(g, dt, a), end: (g, win, a) => this.endQuest(g, win, a),
    };
    this.marks = [{ x: -110, z: -8, color: this.color, r: 6, label: '金字塔' }, { x: -140, z: -27, color: '#72edff', r: 5, label: '快递柜' }];
  }
  buildPyramid() {
    const I = this.island, stone = mat(0xcfa965, { roughness: 0.92 });
    for (let k = 0; k < 9; k++) {
      const w = 39 - k * 4.1;
      box(I, w, 2.4, w, -108, k * 2.4, -10, stone, { col: true });
    }
    const cap = new THREE.Mesh(new THREE.ConeGeometry(3.1, 4.6, 4), mat(0xffd57c, { metalness: 0.35 }));
    cap.rotation.y = Math.PI / 4; cap.position.set(-108, 23.7, -10); I.add(cap);
    board(I, ['法老精装loft · 内部无公摊', '首付：一块砖 · 工期：3000年'], 8, 2.2, -108, 2.8, 10.1, 0, { bg: '#664521', fg: '#ffe4a0' });
    this.gags.add({ id: 'pyramid_property', x: -108, z: 13, r: 9, cool: 30, fire: (g) => {
      g.line(['法老售楼处', '不是烂尾，是法老要求保留毛坯的历史感。窗户正在考古。'], 4.5);
      g.ui.burst(['千年期房', '公摊面积为零', '因为根本没有间', '物业费交了三千年'], 5); g.laugh += 4;
    } });
  }
  buildScaffold() {
    const I = this.island, wood = mat(0x806044), metal = mat(0x6a7476, { metalness: 0.7 });
    for (const x of [-133, -126]) for (const z of [-9, -2]) {
      cyl(I, .1, .1, 12, x, 0, z, metal); I.col.add(x - .2, x + .2, z - .2, z + .2, 12);
    }
    for (let y = 3; y < 12; y += 3) {
      box(I, 8, .18, 8, -129.5, y, -5.5, wood);
      box(I, 8, .09, .09, -129.5, y + 1.1, -1.5, metal);
    }
    board(I, ['文明施工', '金字塔倒了算文物'], 5.6, 1.5, -130, 9.4, -1.35, 0, { bg: '#d9821f', fg: '#21160a' });
  }
  buildCrane() {
    const I = this.island, yellow = mat(0xe9ad23, { metalness: .45 }), dark = mat(0x3a332a);
    box(I, 2.1, 27, 2.1, -141, 0, 16, yellow, { col: true });
    for (let y = 2; y < 26; y += 3) { box(I, 3.2, .17, .17, -141, y, 17.1, dark); box(I, .17, .17, 3.2, -141, y, 16, dark); }
    box(I, 34, 1.1, 1.3, -129, 27, 16, yellow);
    box(I, 7, 3, 2.8, -146, 25, 16, dark);
    this.hook = new THREE.Group();
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, 10), dark); cable.position.y = -5; this.hook.add(cable);
    const hook = new THREE.Mesh(new THREE.TorusGeometry(.45, .1, 7, 14, Math.PI * 1.6), dark); hook.position.y = -10; this.hook.add(hook);
    this.hook.position.set(-115, 27, 16); I.add(this.hook);
    this.gags.add({ id: 'crane_offwork', x: -137, z: 21, r: 8, cool: 28, fire: (g) => {
      g.line(['塔吊司机', '不是不吊，是砖的工龄比我大，得它先签字。'], 4); g.ui.burst(['塔吊准时下班', '砖比法老还老', '劳动仲裁找阿努比斯'], 4); g.laugh += 3;
    } });
  }
  buildLocker() {
    const I = this.island;
    box(I, 6, 4, 1.2, -140, 0, -31, mat(0xe58e24), { col: true });
    for (let i = 0; i < 6; i++) { box(I, .75, .65, .03, -142.4 + i * .94, 2.4, -30.37, mat(0xffcf62)); box(I, .14, .07, .04, -142.4 + i * .94, 2.62, -30.34, mat(0x333333)); }
    board(I, ['金字塔驿站', '法老件 · 三千年不取也不退'], 5.8, 1.4, -140, 3.5, -30.34, 0, { bg: '#123a44', fg: '#ffe183' });
    this.gags.add({ id: 'ancient_delivery', x: -140, z: -27, r: 6, cool: 32, fire: (g) => {
      g.ui.popup('<h3>📦 千年加急</h3><p>取件人：图坦卡蒙</p><p>备注：放门口就行，里面的人出不来</p>', '', 3.5); g.audio.ding(); g.laugh += 4;
    } });
  }
  buildCamel() {
    const I = this.island, root = new THREE.Group();
    const model = genModel(['pyramid_camel'], 2.4);
    if (model) root.add(model); else {
      const body = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 10), mat(0xc5995e)); body.scale.set(.8, .8, 1.4); body.position.y = 1.5; root.add(body);
      const neck = new THREE.Mesh(new THREE.CapsuleGeometry(.25, 1.5), body.material); neck.position.set(0, 2.25, 1); neck.rotation.x = -.35; root.add(neck);
      const head = new THREE.Mesh(new THREE.BoxGeometry(.6, .55, 1), body.material); head.position.set(0, 3.1, 1.4); root.add(head);
      for (const x of [-.55, .55]) for (const z of [-.8, .8]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(.13, .16, 1.3), body.material); leg.position.set(x, .65, z); root.add(leg); }
    }
    root.position.set(-74, 0, 28); I.add(root); this.camel = root;
    board(I, ['骆驼专用位', '其他动物与电驴禁止停双峰'], 5, 1.4, -74, 1.6, 34, Math.PI, { bg: '#654221' });
    this.gags.add({ id: 'camel_parking', x: -74, z: 30, r: 8, cool: 25, fire: (g) => {
      g.districts.bubble(root, '停车位里有两个峰，别想蹭我的车位。', 3.4, 3.5);
      g.ui.burst(['双峰停车位', '骆驼也有新能源', '百公里一把草'], 4); g.laugh += 3;
    } });
  }
  buildForeman() {
    const I = this.island, root = new THREE.Group();
    const model = genModel(['pyramid_anubis'], 2.1);
    root.add(model || standee({ name: '阿努比斯监工', color: '#dba83e', face: 'calm', h: 2 }));
    root.position.set(-88, 0, 25); I.add(root);
    const hardhat = new THREE.Mesh(new THREE.SphereGeometry(.47, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xffd42a)); hardhat.position.y = model ? 1.93 : 1.98; root.add(hardhat);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(.57, .57, .1, 16), hardhat.material); brim.position.y = hardhat.position.y; root.add(brim);
    this.foreman = new Cardboard(I.scene, { root });
    this.gags.add({ id: 'anubis_brick', x: -88, z: 25, r: 8, cool: 22, fire: (g) => {
      this.foreman.say('这砖是你家的吗？不是？那正好，搬我家去。'); g.laugh += 4;
      g.ui.burst(['法老零元购', '监工：这砖是你家的吗', '砖的产权已考古'], 4);
    } });
  }
  buildSiteProps() {
    const I = this.island;
    for (let i = 0; i < 9; i++) { const x = -90 + (i % 3) * 1.15, z = 33 + Math.floor(i / 3) * .85; box(I, .95, .65, .65, x, 0, z, mat(i % 2 ? 0xb55d37 : 0xcd784a)); }
    for (const [x, z] of [[-65, 24], [-136, 34], [-91, -35]]) { const cone = new THREE.Mesh(new THREE.ConeGeometry(.4, 1, 12), mat(0xff6822)); cone.position.set(x, .5, z); I.add(cone); }
    neon(I, '千年工程 · 今年交付', '#ffd05a', 9, 2, -106, 5.5, 37.5, Math.PI);
  }
  startQuest(g, a) {
    this.qi = 0; this.endTemp(g); this.carry = new THREE.Group();
    const brick = new THREE.Mesh(new THREE.BoxGeometry(.8, .45, .5), mat(0xc56840)); brick.position.y = 1.55; this.carry.add(brick);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(.6, .2), new THREE.MeshBasicMaterial({ color: 0xffe5a5 })); label.position.set(0, 1.55, .26); this.carry.add(label);
    g.player.root.add(this.carry); this.temp.push(this.carry);
    this.marker = new THREE.Mesh(new THREE.TorusGeometry(2.8, .14, 8, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc85a').multiplyScalar(2) }));
    this.marker.rotation.x = Math.PI / 2; this.marker.position.y = .2; g.world.add(this.marker); this.temp.push(this.marker);
  }
  updateQuest(g, dt, a) {
    const d = DROPS[this.qi];
    if (d && flat(g.player.pos, d) < 4.3) {
      this.qi++; g.audio.coin(); g.ui.banner(`送砖 ${this.qi}/4`, `${d.who}：${d.line}`); g.laugh += 3;
      const pile = new THREE.Mesh(new THREE.BoxGeometry(1, .65, .7), mat(0xc56840)); pile.position.set(d.x, .33, d.z); g.world.add(pile); this.temp.push(pile);
    }
    const n = DROPS[this.qi];
    a.nav = n ? { pos: V3(n.x, 0, n.z), label: `千年加急 → ${n.who}` } : null;
    if (n) { this.marker.position.set(n.x, .22 + Math.sin(g.time * 4) * .08, n.z); this.marker.rotation.z += dt; } else this.marker.visible = false;
    return { note: `加急砖 ${this.qi}/4${n ? ' · ' + n.who : ''}`, win: this.qi >= 4 };
  }
  endTemp(g) { for (const o of this.temp) o.removeFromParent(); this.temp.length = 0; }
  endQuest(g, win, a) { const n = this.qi || 0; this.endTemp(g); a.nav = null; return win ? ['四块砖均已签收', '阿努比斯：这砖现在是法老家的了', '日结：三千年以后到账'] : [`送砖 ${n}/4`, '快递柜拒收：法老没接电话', '骆驼：下次让法老自己搬']; }
  update(g, dt, inside) {
    if (inside) this.gags.update(g, g.player);
    this.foreman.tickBubble(dt);
    if (this.hook) this.hook.position.x = -115 + Math.sin(g.time * .35) * 4;
    if (this.camel) this.camel.rotation.y = Math.sin(g.time * .7) * .08;
  }
}
