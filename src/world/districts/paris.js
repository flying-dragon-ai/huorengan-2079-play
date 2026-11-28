// 巴黎：铁塔、街角面包店，以及一场随时变成下午茶的法棍决斗
import * as THREE from 'three';
import { mat, box, cyl, board, neon, V3, Gags } from './kit.js';
import { Cardboard } from '../../actors/npc/index.js';
import { Parts, boxG, cylG, sphereG, torusG, planeG, coneG, buildIglooBlocks, towerRadius } from './detail.js';
import { genModel, standee } from '../../actors/models.js';

export class Paris {
  constructor(island) {
    this.island = island; this.id = 'paris'; this.name = '巴黎';
    this.center = [100, 0]; this.bounds = [43, 157, -43, 43]; this.color = '#ff9fc8';
    this.gags = new Gags(); this.t = 0; this.actors = []; this.temp = [];
    this.marks = [{ name: '埃菲尔铁塔', x: 70, z: -20 }, { name: '巴黎决斗场', x: 104, z: 0 }];
    this.views = [
      ['tower', '42,22,35', '70,23,-20', 18],
      ['bakery', '121,4.5,7', '137,3.3,18.5', 18.2],
      ['duel', '99,5,11', '104,1,0', 17],
    ];
    this.buildTower(); this.buildBakery(); this.buildFountain(); this.buildFlowers();
    this.buildDuel(); this.buildPeople(); this.buildGround();
    this.gags.add({ id: 'baguette_duel', x: 104, z: 0, r: 4.2, cool: 14, fire: (g) => this.interruptDuel(g) });
    this.gags.add({ id: 'tower_lift', x: 70, z: -10, r: 3.5, cool: 30, fire: (g) => {
      g.line(['铁塔检票员', '电梯今天休假。您可以走楼梯，或者把面包放在楼下，减轻配重。'], 4.5);
      g.ui.burst(['法式减负', '塔没动，面包先上去了', '退票要排三天'], 4.5); g.laugh += 3;
    } });
    this.gags.add({ id: 'fountain_wish', x: 105, z: 26, r: 5.5, cool: 25, fire: (g) => {
      g.line(['许愿喷泉', '收到「一夜暴富」订单。已自动兑换成一枚硬币，请下次再投。'], 4.5);
      g.ui.burst(['愿望已外包', '喷泉也要抽成', '到账：原路退回'], 4.5); g.laugh += 3;
    } });
    this.gags.add({ id: 'bakery_queue', x: 136, z: 17, r: 3.5, cool: 25, fire: (g) => {
      g.line(['面包店老板', '本店法棍按硬度分三级：早餐、正餐、防身。决斗用请走冠军通道。'], 4.5);
      g.ui.burst(['新鲜出炉，趁热格挡', '购买即默认加入骑士团', '蒜香附魔 +3'], 4.5); g.laugh += 3;
    } });
    this.quest = {
      title: '法棍骑士挑战赛', short: '撞飞 6 名法棍斗士', kind: '撞', time: 75, gain: 15,
      at: V3(104, 0, -5),
      intro: ['面包店老板', '六位骑士堵在门口决斗！高速走过去、跳撞或骑车撞飞他们。记住：打断决斗，他们只会当场开饭。'],
      goal: '75 秒内撞飞 6 名持法棍斗士', cheer: ['法棍骑士团解散', '决斗变成野餐', '巴黎交通恢复', '活人感 +15'],
      start: (g, a) => this.startQuest(g, a),
      update: (g, dt, a) => this.updateQuest(g, dt, a),
      end: (g, win, a) => this.endQuest(g, win, a),
    };
  }

  buildTower() {
    const I=this.island, P=new Parts(new THREE.Group());
    const iron=mat(0x705548,{metalness:.68,roughness:.48}), edge=mat(0x9a7254,{metalness:.7,roughness:.4});
    const stone=mat(0xc9baa6,{roughness:.86}), brass=mat(0xc5a26b,{metalness:.7,roughness:.35});
  const X=70,Z=-20, point=(sx,sz,y)=>V3(X+sx*towerRadius(y),y*1.22,Z+sz*towerRadius(y));
    // 四腿按真实收分曲线分成 40 段；内外双线 + 每段交叉腹杆，形成连续镂空结构
    for(const sx of [-1,1]) for(const sz of [-1,1]) {
      P.add(boxG(3.2,.6,3.2),stone,X+sx*7.2,.3,Z+sz*7.2);
      P.add(boxG(2.1,.35,2.1),brass,X+sx*7.2,.77,Z+sz*7.2);
      for(let j=0;j<40;j++) {
        const y0=j*.78,y1=(j+1)*.78;
        P.beam(point(sx,sz,y0),point(sx,sz,y1),y0<11?.30:.16,iron);
        const in0=V3(X+sx*(towerRadius(y0)-.48),y0,Z+sz*(towerRadius(y0)-.48));
        const in1=V3(X+sx*(towerRadius(y1)-.48),y1,Z+sz*(towerRadius(y1)-.48));
        P.beam(in0,in1,.12,edge);
        if(j%2===0) P.add(sphereG(.075,8,6),brass,in0.x,in0.y,in0.z);
      }
    }
    // 四个侧面每 2 米做一层梁与 X 撑，远观也看得出格构而不是几根柱子
    const sides=[[[ -1,-1],[1,-1]],[[1,-1],[1,1]],[[1,1],[-1,1]],[[-1,1],[-1,-1]]];
    for(const [[ax,az],[bx,bz]] of sides) for(let j=0;j<15;j++) {
      const y0=j*1.5,y1=Math.min(31,y0+1.5);
      const a=point(ax,az,y0), b=point(bx,bz,y0), c=point(ax,az,y1), d=point(bx,bz,y1);
      P.beam(a,b,.10,edge); P.beam(a,d,.072,iron); P.beam(b,c,.072,iron);
      if(j%2===0){P.beam(a.clone().lerp(d,.5),b.clone().lerp(c,.5),.05,edge);}
    }
    // 三层平台：厚梁、悬挑檐口、栏杆立柱、扶手、铆钉
    for(const [y,w] of [[10.8,7.8],[21,3.9],[30.9,1.35]]) {
      P.add(boxG(w,.24,w),iron,X,y*1.22,Z); P.add(boxG(w+.38,.10,w+.38),brass,X,y*1.22+.22,Z);
      const n=Math.max(6,Math.round(w*2.2));
      for(let k=0;k<n;k++) for(const s of [-1,1]) {
        const a=-w/2+k*w/n;
        for(const [dx,dz] of [[a,s*w/2],[s*w/2,a]]) P.add(boxG(.055,.7,.055),edge,X+dx,y*1.22+.72,Z+dz);
      }
      for(const s of [-1,1]) { P.add(boxG(w+.1,.07,.07),edge,X,y*1.22+1.1,Z+s*w/2);P.add(boxG(.07,.07,w+.1),edge,X+s*w/2,y*1.22+1.1,Z); }
    }
    P.add(cylG(.13,.42,6.2,16),iron,X,37.8,Z); P.add(sphereG(.24,16,10),brass,X,44.2,Z);
    // 一层观景咖啡厅与玻璃围护
    P.add(boxG(3.4,2.3,3.4),mat(0x24343b,{metalness:.3,roughness:.22}),X,10.9*1.22,Z);
    for(const s of [-1,1]) P.add(boxG(3.7,.12,.12),brass,X,12.2*1.22,Z+s*1.72);
    P.finish(); I.add(P.group);
    board(I,['埃菲尔铁塔','电梯维修中 · 面包可寄存'],6.4,1.8,70,1.2,-11.9,0,{bg:'#48372f'});
  }

  buildGround() {
    const I=this.island, ground=new THREE.Mesh(new THREE.PlaneGeometry(104,86).rotateX(-Math.PI/2),mat(0xb5a69a,{roughness:.82}));
    ground.position.set(100,.018,0);ground.receiveShadow=true;I.add(ground);
    const P=new Parts(new THREE.Group()),curb=mat(0xd3c6b6,{roughness:.9}),road=mat(0x8f8580,{roughness:.82});
    // 石板步行区和细路缘，不再让街区与荒草直接相接
    P.add(boxG(104,.1,86),road,100,0,0);
    for(const z of [-42,42]) P.add(boxG(104,.22,.35),curb,100,.11,z);
    for(const x of [48,152]) P.add(boxG(.35,.22,86),curb,x,.11,0);
    for(let x=54;x<150;x+=4) for(let z=-36;z<39;z+=4) P.add(boxG(3.92,.025,3.92),mat((Math.round(x+z)/4)%2?0xb5a69a:0xb9aea2,{roughness:.86}),x,.075,z);
    P.group.name='巴黎石板步行区';P.finish();I.add(P.group);
  }

  beam(a, b, width, material) {
    const d = b.clone().sub(a), o = new THREE.Mesh(new THREE.BoxGeometry(width, d.length(), width), material);
    o.position.copy(a).add(b).multiplyScalar(.5); o.quaternion.setFromUnitVectors(V3(0, 1, 0), d.normalize());
    o.castShadow = true; this.island.add(o); return o;
  }

  buildBakery() {
    const I=this.island,P=new Parts(new THREE.Group());
    const plaster=mat(0xe7c6a4,{roughness:.86}),trim=mat(0xf3e2c5,{roughness:.7}),wood=mat(0x56372b,{roughness:.62});
    const dark=mat(0x202e34,{metalness:.35,roughness:.26}),glass=mat(0x93b5b5,{metalness:.35,roughness:.13,transparent:true,opacity:.33});
    const wine=mat(0x73384a,{roughness:.75}),cream=mat(0xf3ddbc,{roughness:.85});
    const x=137,z=25;
    // 街角两层店铺，奶油色线脚、深绿窗框、法式小阳台
    P.add(boxG(16,8.7,10),plaster,x,4.35,z);
    P.add(boxG(16.35,.32,10.3),trim,x,8.8,z);
    P.add(boxG(16.2,.25,10.2),wine,x,4.4,z);
    P.add(boxG(16.1,.22,10.1),trim,x,.32,z);
    for(const dx of [-6,0,6]) {
      // 上层法式窗，窗框、竖梃、窗台和百叶
      P.add(boxG(2.7,2.8,.16),dark,x+dx,6.5,z-5.04);
      P.add(boxG(2.3,2.4,.05),glass,x+dx,6.5,z-5.14);
      for(const dd of [-1.25,0,1.25]) P.add(boxG(.10,2.65,.16),trim,x+dx+dd,6.5,z-5.19);
      P.add(boxG(2.9,.14,.6),trim,x+dx,5.05,z-5.25);
      for(const s of [-1,1]) for(let k=0;k<7;k++) P.add(boxG(.65,.16,.10),wine,x+dx+s*1.65,5.35+k*.36,z-5.12,0,0,s*.08);
    }
    // 橱窗分格：左侧面包陈列，右侧真实玻璃门
    for(const dx of [-4.6,1.0]) {
      P.add(boxG(4.6,2.8,.12),wood,x+dx,2.4,z-5.1);
      P.add(boxG(4.25,2.4,.04),glass,x+dx,2.4,z-5.18);
      P.add(boxG(.09,2.5,.15),trim,x+dx,2.4,z-5.23);
      P.add(boxG(4.5,.13,.75),wood,x+dx,1.35,z-5.45);
    }
    P.add(boxG(2.1,3.15,.22),dark,x+5.3,1.75,z-5.12);
    P.add(boxG(1.65,2.65,.06),glass,x+5.3,1.85,z-5.26);
    P.add(boxG(.07,1.05,.07),trim,x+5.9,1.8,z-5.36);
    // 雨篷有坡度与垂边，不是几条漂浮色块
    for(let k=0;k<16;k++) {
      const xx=x-7.5+k;
      P.add(boxG(1,.10,2.15),k%2?cream:wine,xx,4.45,z-6.0,-.17,0,0);
      P.add(boxG(1,.38,.10),k%2?cream:wine,xx,4.08,z-7.05);
    }
    // 门口黑板、甜点托盘、法式壁灯
    P.add(boxG(1.5,1.6,.12),wood,x-8.4,.85,z-7,0,.12,0);
    P.add(boxG(1.25,1.35,.03),mat(0x24372e),x-8.4,.95,z-7.09);
    for(const dx of [-6.4,6.4]) {
      P.add(boxG(.08,.55,.4),wood,x+dx,3.75,z-5.25);
      P.add(sphereG(.22,12,8),mat(0xffd88a,{emissive:0xffb75a,emissiveIntensity:.65}),x+dx,3.7,z-5.62);
    }
    // 可颂形陈列：串成弯曲的小卷，近看不是方块
    const bread=mat(0xc88a3c,{roughness:.72}), crust=mat(0xf0bd66,{roughness:.64});
    for(let k=0;k<7;k++) {
      const bx=x-6.3+k*1.05;
      for(let j=0;j<5;j++) {const a=-1.1+j*.55;P.add(sphereG(.15,10,7),j%2?crust:bread,bx+Math.sin(a)*.33,1.64,z-5.57+Math.cos(a)*.2,0,0,0,1,.65,1);}
    }
    P.finish();I.add(P.group);
    board(I,['家里颂 · 巴黎面包房','法棍 / 可颂 / 合法防身用品'],7.5,1.5,137,5.05,19.85,0,{bg:'#71354b'});
    board(I,['今日特价','第二根半价 · 折断不退'],2.4,1.3,128.6,1.05,17.9,0,{bg:'#24372e',fg:'#f3ddbc'});
    I.col.add(129,145,20,30,8.8);
    this.buildStreetDetails();
  }

  buildStreetDetails() {
    const I=this.island,P=new Parts(new THREE.Group());
    const iron=mat(0x2d4245,{metalness:.55,roughness:.4}),wood=mat(0x9d6d4b,{roughness:.8});
    // 两张有板条的长椅和带顶罩路灯
    for(const [x,z] of [[119,15],[88,15]]) {
      for(let k=0;k<4;k++) P.add(boxG(3,.10,.16),wood,x,.65,z-.32+k*.18);
      for(const y of [1.02,1.26]) P.add(boxG(3,.16,.09),wood,x,y,z+.35);
      for(const dx of [-1.15,1.15]) {P.add(boxG(.09,.65,.09),iron,x+dx,.33,z);P.add(boxG(.09,.65,.09),iron,x+dx,.75,z+.35);}
    }
    for(const [x,z] of [[116,30],[92,28],[147,8],[60,-5]]) {
      P.add(cylG(.07,.13,4.8,10),iron,x,0,z);
      P.add(cylG(.25,.18,.2,10),iron,x,4.65,z);
      P.add(sphereG(.2,12,8),mat(0xffdc9b,{emissive:0xffb963,emissiveIntensity:.55}),x,4.9,z);
      P.add(coneG(.42,.26,8),iron,x,5.12,z);
    }
    P.group.name='巴黎街道家具';P.finish();I.add(P.group);
  }

  buildFountain() {
    const I = this.island, stone = mat(0xd8c8bd), water = mat(0x65c8de, { roughness: .2, metalness: .25 });
    cyl(I, 3.5, 3.5, .55, 105, .03, 26, stone, { col: true, seg: 32 });
    cyl(I, 3.1, 3.1, .08, 105, .58, 26, water, { seg: 32 });
    cyl(I, .45, .7, 2.1, 105, .6, 26, stone, { seg: 12 });
    cyl(I, 1.4, 1.4, .18, 105, 2.4, 26, stone, { seg: 24 });
    const dropGeo = new THREE.SphereGeometry(.07, 5, 4), dropMat = mat(0x94eaff, { emissive: 0x174455, emissiveIntensity: .3 });
    this.drops = new THREE.InstancedMesh(dropGeo, dropMat, 48); I.add(this.drops);
    this.dropSeeds = Array.from({ length: 48 }, (_, i) => ({ a: i * 2.39996, k: (i % 12) / 12 }));
  }

  buildFlowers() {
    const I = this.island, stem = mat(0x497444), petals = [mat(0xff85c0), mat(0xa997ff), mat(0x81baff)];
    this.flowers = [];
    for (const [x, z, w, d] of [[60, 24, 13, 2.4], [60, -32, 13, 2.4], [126, -15, 2.4, 12], [136, 24, 2.4, 5]]) {
      box(I, w, .45, d, x, .15, z, mat(0xb6a08c), { col: true });
      for (let i = 0; i < Math.max(w, d) * 1.5; i++) {
        const xx = x + (I.r() - .5) * (w - .5), zz = z + (I.r() - .5) * (d - .5), h = .65 + I.r() * .4;
        cyl(I, .025, .035, h, xx, .6, zz, stem, { seg: 4, cast: false });
        const f = new THREE.Mesh(new THREE.IcosahedronGeometry(.26 + I.r() * .12, 1), petals[i % 3]);
        f.position.set(xx, .6 + h, zz); I.add(f); this.flowers.push(f);
      }
    }
  }

  baguette(parent, x, y, z, scale = 1) {
    const g = new THREE.Group(), bread = mat(0xd99a48), cut = mat(0xffd98b);
    const loaf = new THREE.Mesh(new THREE.CapsuleGeometry(.11 * scale, .9 * scale, 3, 8), bread);
    loaf.rotation.z = .18; g.add(loaf);
    for (let i = -1; i <= 1; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(.15 * scale, .025, .13 * scale), cut); s.position.set(i * .018, i * .25 * scale, .09 * scale); s.rotation.z = -.5; g.add(s); }
    g.position.set(x, y, z); parent.add(g); return g;
  }

  fighter(x, z, name = '法棍斗士', duel = false) {
    const root = new THREE.Group(); this.island.add(root); root.position.set(x, .12, z);
    let model = null;
    try { model = genModel(['paris_duelist'], 1.8); } catch (e) { /* 未生成模型时使用纸片人 */ }
    const npc = new Cardboard(this.island, { root, name, color: '#e9b0cf', face: 'angry', h: 1.8 });
    if (model) root.add(model);
    else root.add(standee({ name, color: '#e9b0cf', face: 'angry', h: 1.8 }));
    const breadPivot = new THREE.Group(); breadPivot.position.set(.65, 1.05, .05); root.add(breadPivot);
    const bread = this.baguette(breadPivot, 0, .4, 0, 1.15); bread.rotation.z = -.35;
    const n = { root, model, npc, breadPivot, bread, home: V3(x, .12, z), name, hit: false, duel, phase: x * .17 + z };
    this.actors.push(n); return n;
  }

  buildDuel() {
    this.duelists = [this.fighter(102, 0, '法棍骑士·咸', true), this.fighter(106, 0, '法棍骑士·甜', true)];
    this.duelists.forEach((n, i) => { n.root.rotation.y = i ? -Math.PI / 2 : Math.PI / 2; });
    this.duelTime = 0; this.eating = false;
    const ring = new THREE.Mesh(new THREE.RingGeometry(3.5, 3.65, 48), new THREE.MeshBasicMaterial({ color: 0xffb1cc, transparent: true, opacity: .65, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(104, .15, 0); this.island.add(ring); this.duelRing = ring;
  }

  buildPeople() {
    const defs = [[81, 9, '排队画家', '#91bddd', 'calm'], [132, 27, '可颂品鉴师', '#ffd48b', 'grin'], [119, -10, '迷路游客', '#b4a5ec', 'wow'], [92, 10, '求婚练习者', '#e7a2b4', 'calm']];
    this.people = defs.map(([x, z, name, color, face]) => {
      const n = new Cardboard(this.island.scene, { name, color, face, h: 1.75 });
      n.root.position.set(x, 0, z); return n;
    });
  }

  interruptDuel(g) {
    this.duelTime = 0; this.eating = true;
    this.duelists.forEach((n, i) => { n.npc.say(i ? '被你打断了……那先吃一口。' : '暂停！法棍凉了就不脆了。', 5); n.bread.visible = true; });
    g.line(['决斗裁判', '比赛中断！双方一致同意：先当场把武器吃完。'], 4.5);
    g.ui.burst(['打到一半开始野餐', '武器正在消失', '巴黎式休战', '咬合力也是战斗力'], 5); g.laugh += 6;
  }

  startQuest(g, a) {
    this.endQuest(g, false, null);
    const pos = [[112, -6], [120, 5], [110, 10], [96, 8], [88, 2], [96, -7]];
    a.fighters = pos.map(([x, z], i) => this.fighter(x, z, `持法棍斗士 ${i + 1}`));
    this.temp.push(...a.fighters); this.questN = 0;
    a.fighters.forEach((n, i) => { n.npc.say(i % 2 ? '格挡！……等等，先咬一口。' : '我这根可是全麦的！', 4); });
  }

  updateQuest(g, dt, a) {
    const p = g.player;
    for (const n of a.fighters || []) {
      const fast = (p.mode === 'bike' && Math.abs(p.speed) > 4) ||
        (p.mode === 'foot' && (Math.hypot(p.vel.x, p.vel.z) > 4.5 || p.air));
      if (!n.hit && Math.hypot(p.pos.x - n.root.position.x, p.pos.z - n.root.position.z) < 1.7 && fast) {
        n.npc.knock(p.pos, p.mode === 'bike' ? p.vel : p.vel.clone().multiplyScalar(2.5));
        n.hit = true; this.questN++; g.audio.boing(); g.pipe.shake = .35;
        n.npc.say('我的法棍！落地还能吃！', 4);
        g.ui.danmaku(`法棍出局 ${this.questN}/6`, true); g.laugh += 3;
      }
    }
    let next = null, best = Infinity;
    for (const n of a.fighters || []) if (!n.hit) {
      const d = n.root.position.distanceToSquared(p.pos);
      if (d < best) { best = d; next = n; }
    }
    if (next) a.nav = { pos: next.root.position, label: `${next.name} · ${this.questN}/6` };
    return { note: next ? `撞飞法棍斗士 ${this.questN}/6` : '6 位骑士都去隔壁野餐了', win: this.questN >= 6 };
  }

  endQuest(g, win, a) {
    for (const n of this.temp) { this.island.scene.remove(n.root); this.island.root.remove(n.root); n.root.removeFromParent(); }
    this.actors = this.actors.filter(n => !this.temp.includes(n)); this.temp.length = 0;
    if (a) { a.fighters = []; a.nav = null; }
  }

  testStep(g) {
    const a = g.districts.active;
    if (!a || a.d !== this) return;
    const n = (a.fighters || []).find(n => !n.hit); if (!n) return;
    const q = n.root.position, p = g.player;
    if (this._tgt !== n || Math.abs(p.pos.z - q.z) > 1 || p.speed < 1) {
      this._tgt = n; g.dev.tp(q.x - 7, q.z, Math.PI / 2);
    }
    g.dev.ride(q.x + 3, q.z);
  }

  update(g, dt, here) {
    if (here) this.gags.update(g, g.player);
    this.t += dt; this.duelTime += dt;
    for (const n of this.duelists) {
      n.npc.tickBubble(dt);
      if (this.eating && this.duelTime < 8) {
        // 打断后立刻把法棍送嘴边，每一口都真的变短。
        n.breadPivot.position.set(.18, 1.55 + Math.sin(this.duelTime * 8) * .05, .42);
        n.breadPivot.rotation.z = 1.2;
        n.bread.scale.y = Math.max(.12, 1 - this.duelTime / 8);
      } else {
        n.bread.visible = true; n.bread.scale.y = 1;
        n.breadPivot.position.set(.65, 1.05, .05);
        n.breadPivot.rotation.z = Math.sin(this.t * 4 + n.phase) * .7;
      }
      n.root.position.y = .12 + Math.abs(Math.sin(this.t * 3 + n.phase)) * .035;
    }
    this.duelRing.material.opacity = this.eating && this.duelTime < 8 ? .25 : .65;
    for (const n of this.actors) if (!n.duel) {
      n.npc.tickBubble(dt); n.breadPivot.rotation.z = Math.sin(this.t * 2 + n.phase) * .18;
      if (!n.npc.physics(dt, this.island) && n.root.position.distanceTo(n.home) > .6)
        n.npc.walkTo(dt, n.home.x, n.home.z, 2.5, this.island);
    }
    for (let i = 0; i < this.people.length; i++) {
      const n = this.people[i]; n.tickBubble(dt); n.physics(dt, this.island);
      if (here && (n.lineT = (n.lineT || i * 2) - dt) < 0) {
        n.say(['这里空气都是黄油味', '我的可颂必须每边对称', '前面是在决斗还是开饭？', '铁塔今天也没有加班'][i]); n.lineT = 12;
      }
    }
    if (this.drops) {
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = V3(1, 1, 1);
      for (let i = 0; i < this.dropSeeds.length; i++) {
        const d = this.dropSeeds[i], k = (d.k + this.t * .45) % 1, r = .3 + k * 2.4;
        m.compose(V3(105 + Math.cos(d.a) * r, 2.55 + Math.sin(k * Math.PI) * 1.5 - k * 2, 26 + Math.sin(d.a) * r), q, s);
        this.drops.setMatrixAt(i, m);
      }
      this.drops.instanceMatrix.needsUpdate = true;
    }
  }
}
