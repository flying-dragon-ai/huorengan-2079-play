// 冰岛温泉：极光、冰屋、火山地热，以及严格遵守打卡制度的企鹅
// 当地任务：75 秒跑完三处景点打卡，再回企鹅考勤机销假
import * as THREE from 'three';
import { mat, box, cyl, board, neon, drawTex, V3, Gags, flat } from './kit.js';
import { Parts, boxG, cylG, sphereG, torusG, planeG, buildIglooBlocks } from './detail.js';
import { genModel } from '../../actors/models.js';

const STATION = [-32, -163];
function makeMistTexture() {
  return drawTex(64,64,(x,w,h)=>{
    const g=x.createRadialGradient(32,32,0,32,32,31);
    g.addColorStop(0,'rgba(255,255,255,.75)');g.addColorStop(.35,'rgba(255,255,255,.4)');g.addColorStop(1,'rgba(255,255,255,0)');
    x.fillStyle=g;x.fillRect(0,0,w,h);
  });
}
const SITES = [
  { id: 'igloo', name: '冰屋前台', x: -28, z: -196, color: '#9cecff' },
  { id: 'spring', name: '温泉泡脚池', x: 16, z: -166, color: '#72edff' },
  { id: 'volcano', name: '火山观景台', x: 30, z: -196, color: '#ff9a66' },
];

export class Iceland {
  constructor(island) {
    this.island = island; this.id = 'iceland';
    this.name = '冰岛温泉'; this.tagline = '极光免费 · 温泉很烫 · 企鹅迟到扣鱼';
    this.color = '#72edff'; this.center = [0, -180]; this.bounds = [-43, 43, -217, -157];
    this.gags = new Gags(); this.penguins = []; this.steam = []; this.questBits = [];
    this.views = [
      ['aurora', '0,10,-153', '0,18,-197', 21],
      ['spring', '5,9,-157', '16,1,-177', 16],
      ['igloos', '-19,5,-191', '-28,2,-202', 21],
    ];
    this.buildGround(); this.buildAurora(); this.buildIgloos();
    this.buildSpring(); this.buildVolcano(); this.buildPenguins(); this.buildStation();
    this.quest = {
      title: '极光团建打卡', short: '三处打卡再销假', kind: '跑图', time: 75, gain: 12,
      at: V3(STATION[0], this.h(...STATION), STATION[1]),
      intro: ['企鹅主管', '75 秒内到冰屋、温泉、火山各打卡一次，再回考勤机！别装极夜看不见你，迟到扣 200 条鱼。'],
      goal: '75 秒内完成冰屋、温泉、火山 3 处打卡，再回企鹅考勤机',
      cheer: ['全勤蛙诞生', '三处打卡完成', '保住 200 条鱼', '极光已点赞'],
      start: (g, a) => this.startQuest(g, a),
      update: (g, dt, a) => this.updateQuest(g, dt, a),
      end: (g, win, a) => this.endQuest(g, win, a),
    };
    this.gags.add({ id: 'penguin_clock', x: -29, z: -164, r: 8, cool: 24, fire: (g) => {
      g.line(['企鹅主管', '迟到扣 200 条鱼！别问为什么，问就是北极狼制定的冰岛考勤制度。'], 4);
      g.ui.burst(['迟到扣200条鱼', '企鹅也要996', '北极狼隔空背锅', '鱼：我招谁了'], 5); g.laugh += 4;
    } });
    this.gags.add({ id: 'hot_spring', x: 16, z: -170, r: 10, cool: 28, fire: (g) => {
      g.ui.popup('<h3>蓝湖温泉 · 员工福利</h3><p>泡温泉免费，出水 ¥80</p><p>水温 42℃，KPI 100℃</p>', '', 3.2);
      g.audio.tone('sine', 520, 780, 0.5, 0.1); g.laugh += 3;
    } });
    this.gags.add({ id: 'volcano', x: 30, z: -198, r: 8, cool: 32, fire: (g) => {
      g.line(['火山广播', '本火山每 2079 年喷发一次，刚才那次是老板画的饼终于熟了。'], 4.5);
      g.ui.burst(['画饼喷发了', '这边建议加薪灭火', '熟饼也是饼'], 4); g.laugh += 3;
    } });
    this.gags.add({ id: 'igloo_wifi', x: -28, z: -199, r: 7, cool: 35, fire: (g) => {
      g.ui.popup('<h3>冰屋民宿</h3><p>全屋地暖：概念版，暂不制热</p><p>Wi-Fi 密码：bing-bu-bing（并不冰）</p>', 'warn', 3);
      g.laugh += 3;
    } });
    this.marks = SITES.map((s) => ({ x: s.x, z: s.z, color: s.color, r: 5, label: s.name }));
  }

  h(x, z) { return this.island.heightAt(x, z); }
  put(o, x, z, lift = 0) { o.position.set(x, this.h(x, z) + lift, z); this.island.add(o); return o; }

  buildGround() {
    const geo = new THREE.PlaneGeometry(86, 60, 43, 30); geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position, colors = [];
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i) - 187;
      p.setXYZ(i, x, this.h(x, z) + 0.035, z);
      const c = new THREE.Color().setHSL(0.56, 0.32, 0.36 + Math.sin(x * 0.4 + z) * 0.025);
      colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geo.computeVertexNormals();
    const snow = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0 }));
    snow.name='冰岛雪原';snow.receiveShadow = true; this.island.add(snow);
    // 用坡脚和漂雪衔接海岛原始沙地，杜绝一块矩形蓝板贴在黄沙上
    const apron=new THREE.Mesh(new THREE.PlaneGeometry(104,78,26,20).rotateX(-Math.PI/2),mat(0x738c96,{roughness:.96}));
    const ap=apron.geometry.attributes.position;
    for(let i=0;i<ap.count;i++) {
      const x=ap.getX(i),z=ap.getZ(i)-187;
      const edge=Math.min(1,Math.min(52-Math.abs(x),39-Math.abs(z+187))/7);
      ap.setXYZ(i,x,this.h(x,z)-.07+Math.max(0,edge)*.06,z);
    }
    apron.geometry.computeVertexNormals();apron.receiveShadow=true;this.island.add(apron);this.island.root.remove(snow);this.island.add(snow);
    const rockGeo = new THREE.IcosahedronGeometry(1, 0), transforms = [];
    for (let i = 0; i < 34; i++) {
      const x = -40 + this.island.r() * 80, z = -215 + this.island.r() * 9;
      transforms.push(new THREE.Matrix4().compose(V3(x, this.h(x, z) + 0.3, z), new THREE.Quaternion(), V3(0.5 + this.island.r(), 0.35, 0.7)));
    }
    const rocks = new THREE.InstancedMesh(rockGeo, mat(0xb9dce5, { roughness: 0.9, flatShading: true }), transforms.length);
    transforms.forEach((m, i) => rocks.setMatrixAt(i, m)); rocks.castShadow = true; this.island.add(rocks);
  }

  buildAurora() {
    this.auroras = [];
    for (let k = 0; k < 4; k++) {
      const n = 128, rows=12, pos = new Float32Array((n + 1) * (rows+1) * 3), col = new Float32Array(pos.length), idx = [];
      for (let i = 0; i <= n; i++) for(let j=0;j<=rows;j++) {
        const c = new THREE.Color().setHSL(0.38 + k * 0.085 + i / n * 0.07, 0.86, 0.52);
        const edge=Math.pow(Math.sin(i/n*Math.PI),.42);
        const fade=Math.sin(j/rows*Math.PI)*edge*(.48+.52*Math.sin(i*.37+j*.31+k)**2);
        const patch=.65+.35*Math.sin(i*.13+k*1.7)*Math.sin(i*.061-j*.17);
        const q=(i*(rows+1)+j)*3;col[q]=c.r*fade*patch;col[q+1]=c.g*fade*patch;col[q+2]=c.b*fade*patch;
        if(i<n&&j<rows){const a=i*(rows+1)+j,b=a+rows+1;idx.push(a,a+1,b,b,a+1,b+1);}
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setIndex(idx);
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.24, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
      mesh.frustumCulled = false; this.island.add(mesh); this.auroras.push({ mesh, n, rows, k });
    }
  }

  buildIgloos() {
    const I=this.island;
    for(const [x,z,s] of [[-28,-202,1.2],[-12,-207,.85],[-37,-184,.75]]) {
      const P=new Parts(new THREE.Group());
      const iceA=mat(0x94bdcb,{roughness:.42,metalness:.08}),iceB=mat(0xb5d7df,{roughness:.34,metalness:.10}),mortar=mat(0x5f899e,{roughness:.78});
      const y=this.h(x,z);
      buildIglooBlocks(P,x,y,z,s,iceA,iceB,mortar);
      // 拱形入口：一排逐渐降低的短冰拱与内凹暖光，不用整块方盒封口
      const front=z+3.25*s;
      for(const side of [-1,1]) for(let j=0;j<4;j++) P.add(boxG(.48*s,.46*s,1.7*s),iceA,x+side*.92*s,y+.23*s+j*.44*s,front);
      for(let j=0;j<5;j++) P.add(boxG(.45*s,.34*s,1.65*s),j%2?iceA:iceB,x+(j-2)*.42*s,y+1.95*s+Math.sin((j/4)*Math.PI)*.2*s,front);
      P.add(boxG(1.4*s,1.65*s,.08),mat(0x183344,{emissive:0x1e3c49,emissiveIntensity:.22}),x,y+.85*s,z+2.95*s);
      P.add(boxG(1.1*s,.65*s,.06),mat(0xd99b52,{emissive:0xf8a44c,emissiveIntensity:.7}),x,y+.65*s,z+2.90*s);
      // 门边积雪压顶、门牌、短冰台阶
      for(let j=0;j<3;j++) P.add(boxG((2.5-j*.35)*s,.12*s,(1.1-j*.22)*s),iceB,x,y+.05+j*.12*s,z+4.3*s+j*.24*s);
      P.finish();I.add(P.group);
      I.col.add(x-3.4*s,x+3.4*s,z-3.4*s,z+3.4*s,y+4*s);
    }
    board(I,['冰屋民宿 · 前台在冰上','地暖概念版 / 迟到照扣鱼'],7,1.8,-28,this.h(-28,-197)+3.2,-197,0,{bg:'#17445c',fg:'#cfffff'});
  }

  buildSpring() {
    const I=this.island,x=16,z=-177,y=this.h(x,z),P=new Parts(new THREE.Group());
    // 不规则火山岩岸与蓝绿色矿物沉积：轮廓、断面、深浅三层
    const N=96,rad=(a)=>6.7+1.05*Math.sin(a*2+.4)+.7*Math.sin(a*3-1)+.42*Math.sin(a*7)+.3*Math.cos(a*13);
    const vertices=[],indices=[],colors=[];
    for(let i=0;i<=N;i++) {
      const a=i/N*Math.PI*2,r=rad(a);
      for(const [rr,yy] of [[0,.19],[r-.4,.16],[r,.25],[r+.65,.35],[r+1.2,.15]]) {
        vertices.push(x+Math.cos(a)*rr,y+yy,z+Math.sin(a)*rr);
        const c=new THREE.Color(rr<r-2?0x287d91:rr<r-.4?0x60b9bb:rr<r+.4?0x86b6b2:rr<r+.9?0x84908b:0x485a60);
        colors.push(c.r,c.g,c.b);
      }
      if(i<N) for(let j=0;j<4;j++){const k=i*5+j;indices.push(k,k+5,k+1,k+1,k+5,k+6);}
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();
    const pool=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.42,metalness:.06,side:THREE.DoubleSide}));pool.receiveShadow=true;I.add(pool);
    const rockM=[mat(0x43515a,{roughness:.95,flatShading:true}),mat(0x61747a,{roughness:.88,flatShading:true}),mat(0x87928e,{roughness:.85,flatShading:true})];
    for(let i=0;i<36;i++) {
      const a=i/36*Math.PI*2,r=rad(a)+.25+I.r()*1.7,s=.32+I.r()*.9;
      P.add(new THREE.IcosahedronGeometry(s,1),rockM[i%3],x+Math.cos(a)*r,y+.05+I.r()*.22,z+Math.sin(a)*r,I.r()*.6,I.r()*5,I.r()*.4,1.0+I.r()*.9,.42+I.r()*.38,.7+I.r()*.6);
    }
    // 零散大岩与细砾打破完整石圈，不做等距项链
    for(const [dx,dz,s] of [[-9,3,1.5],[7,-6,1.25],[8,5,.7],[-7,-7,.9]]) P.add(new THREE.IcosahedronGeometry(s,1),rockM[0],x+dx,y+.2,z+dz,.2,I.r()*5,.1,1.6,.65,1.1);
    P.finish();I.add(P.group);this.water=pool;
    for(let i=0;i<4;i++) {
      const ripple=new THREE.Mesh(new THREE.RingGeometry(1.1+i*.6,1.13+i*.6,64),new THREE.MeshBasicMaterial({color:0xb6eeee,transparent:true,opacity:.23,side:THREE.DoubleSide}));
      ripple.rotation.x=-Math.PI/2;ripple.position.set(x-2+i*1.2,y+.29,z+(i%2?2:-1));I.add(ripple);this.steam.push({ripple,phase:i*1.6});
    }
    const n=84,pos=new Float32Array(n*3),seed=[];
    for(let i=0;i<n;i++)seed.push([I.r()*Math.PI*2,Math.sqrt(I.r())*6.4,I.r()*6]);
    const mg=new THREE.BufferGeometry();mg.setAttribute('position',new THREE.BufferAttribute(pos,3));
    const mist=new THREE.Points(mg,new THREE.PointsMaterial({color:0xe5ffff,size:.75,transparent:true,opacity:.17,depthWrite:false,map:makeMistTexture(),alphaTest:.015}));
    mist.position.set(x,y,z);I.add(mist);this.mist=mist;this.mistSeed=seed;
    board(I,['蓝湖温泉 · 泡脚区','免费入水 / 出水 ¥80'],5,1.5,23,y+3.1,-171,Math.PI,{bg:'#166575',fg:'#eaffff'});
  }

  buildVolcano() {
    const I = this.island, x = 30, z = -207, y = this.h(x, z);
    const mountain = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 10.5, 9, 12, 3, true), mat(0x403d43, { roughness: 0.94, flatShading: true, side: THREE.DoubleSide }));
    mountain.position.set(x, y + 4.5, z); mountain.castShadow = true; I.add(mountain);
    const lava = new THREE.Mesh(new THREE.CircleGeometry(2.4, 24), I.neonMat(new THREE.Color(2.8, 0.42, 0.08)));
    lava.rotation.x = -Math.PI / 2; lava.position.set(x, y + 8.8, z); I.add(lava); this.lava = lava;
    I.col.add(x - 9, x + 9, z - 9, z + 9, y + 9);
    const count = 36, pos = new Float32Array(count * 3), seed = [];
    for (let i = 0; i < count; i++) seed.push([I.r() * 6.28, I.r() * 2.2, I.r() * 8]);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const smoke = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffa06a, size: 0.65, transparent: true, opacity: 0.65, depthWrite: false }));
    smoke.position.set(x, y + 8.8, z); I.add(smoke); this.volcanoSmoke = smoke; this.volcanoSeed = seed;
    board(I, ['火山观景台', '喷发周期：2079 年（禁止催更）'], 6, 1.6, 30, this.h(30, -196) + 3.6, -196, 0, { bg: '#542b24', fg: '#ffd7a1' });
    for (const sx of [-3, 3]) cyl(I, 0.08, 0.1, 1.4, 30 + sx, this.h(30 + sx, -198), -198, mat(0x9aa6ad));
    box(I, 6, 0.1, 0.1, 30, this.h(30, -198) + 1.25, -198, mat(0x9aa6ad));
  }

  penguinModel() { return genModel(['iceland_penguin'], 1.5); }
  fallbackPenguin() {
    const g = new THREE.Group(), black = mat(0x172532, { roughness: 0.65 }), white = mat(0xf2f7f4), orange = mat(0xffa23c);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10), black); body.scale.set(0.85, 1.25, 0.72); body.position.y = 0.78; g.add(body);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.39, 14, 10), white); belly.scale.set(0.8, 1.2, 0.25); belly.position.set(0, 0.72, 0.42); g.add(belly);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 10), black); head.position.y = 1.45; g.add(head);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.42, 6), orange); beak.rotation.x = Math.PI / 2; beak.position.set(0, 1.42, 0.5); g.add(beak);
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), white); eye.position.set(s * 0.15, 1.57, 0.35); g.add(eye);
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), orange); foot.scale.set(1, 0.28, 1.5); foot.position.set(s * 0.25, 0.1, 0.13); g.add(foot);
      const wing = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.5, 3, 6), black); wing.position.set(s * 0.51, 0.9, 0); wing.rotation.z = s * -0.25; g.add(wing);
    }
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; }); return g;
  }

  buildPenguins() {
    const I = this.island;
    for (let i = 0; i < 7; i++) {
      const obj = this.penguinModel() || this.fallbackPenguin();
      const x = -27.8 + (i % 2) * 0.18, z = -163.8 + i * 2.05;
      obj.rotation.y = Math.PI; this.put(obj, x, z);
      this.penguins.push({ obj, x, z, phase: i * 0.83 });
    }
    const boss = this.penguinModel() || this.fallbackPenguin();
    this.put(boss, -35.6, -163.7); boss.rotation.y = Math.PI / 2;
    this.penguins.push({ obj: boss, x: -35.6, z: -163.7, phase: 1.2, boss: true });
  }

  buildStation() {
    const I = this.island, x = STATION[0], z = STATION[1], y = this.h(x, z);
    const steel = mat(0x6c8892, { metalness: 0.72, roughness: 0.28 });
    box(I, 1.5, 2.25, 0.9, x, y, z, steel, { col: true });
    const screen = box(I, 1.12, 0.78, 0.04, x, y + 1.15, z + 0.48, I.neonMat(new THREE.Color(0.3, 2.2, 2.8)), { cast: false });
    screen.rotation.x = -0.08;
    const scanner = box(I, 0.8, 0.16, 0.4, x, y + 0.78, z + 0.48, mat(0x192d37));
    const laser = box(I, 0.62, 0.025, 0.43, x, y + 0.95, z + 0.48, I.neonMat(new THREE.Color(3.0, 0.25, 0.18)), { cast: false });
    this.clockScreen = screen; this.clockLaser = laser;
    board(I, ['企鹅智能考勤机', '人脸无效 · 请出示鱼脸'], 5.8, 1.5, -32, y + 4.2, -163.5, 0, { bg: '#143b4b', fg: '#aef8ff' });
    neon(I, '迟到扣200条鱼', '#ff738d', 6.5, 1.3, -31.8, y + 5.7, -163.5, 0);
    const lineMat = mat(0xffdf6c, { emissive: 0x736218, emissiveIntensity: 0.35 });
    for (let i = 0; i < 7; i++) {
      const qz = -163.8 + i * 2.05;
      box(I, 2.1, 0.025, 0.06, -27.8, this.h(-27.8, qz) + 0.055, qz + 0.95, lineMat, { cast: false });
    }
    for (let i = 0; i < 5; i++) {
      const qz = -152.8 - i * 2.4;
      cyl(I, 0.055, 0.07, 1.0, -29.4, this.h(-29.4, qz), qz, steel);
      if (i < 4) box(I, 0.055, 0.055, 2.4, -29.4, this.h(-29.4, qz) + 0.85, qz + 1.2, lineMat);
    }
  }

  update(g, dt, inside) {
    const t = g.time;
    const near = Math.hypot(g.player.pos.x, g.player.pos.z + 187) < 115;
    const cold = (g.env?.coldMode || 0) > 0.5;
    for (const a of this.auroras) {
      a.mesh.visible = near && !cold;
      if (!a.mesh.visible) continue;
      const p = a.mesh.geometry.attributes.position;
      for (let i = 0; i <= a.n; i++) for (let j = 0; j <= a.rows; j++) {
        const u = i / a.n, v = j / a.rows, x = -43 + u * 86;
        const wave = Math.sin(u * 9 + t * .38 + a.k * 1.7);
        const z = -213 + a.k * 6 + Math.sin(u * 7 + t * .22 + a.k) * 4;
        const y = 22 + a.k * 3 + Math.sin(u * 8 + t * .35) * 2;
        const q = i * (a.rows + 1) + j;
        p.setXYZ(q, x, y + v * 8 + wave * (1.1 + v * 2.6), z + v * 1.6 + Math.sin(v * 3 + u * 17 + t * .4) * .2);
      }
      p.needsUpdate = true;
      a.mesh.material.opacity = 0.22 + Math.sin(t * 0.5 + a.k) * 0.04;
    }
    if (!near) return;
    if (this.water) {
      this.water.material.roughness = .39 + Math.sin(t * 1.7) * .035;
      for (const s of this.steam) {
        const q = (t * 0.3 + s.phase) % 3;
        s.ripple.scale.setScalar(0.5 + q * 0.7); s.ripple.material.opacity = 0.38 * (1 - q / 3);
      }
      const p = this.mist.geometry.attributes.position;
      this.mistSeed.forEach((s, i) => {
        const yy = (t * 0.55 + s[2]) % 6, drift = Math.sin(t * 0.4 + s[2]) * yy * 0.13;
        p.setXYZ(i, Math.cos(s[0]) * s[1] + drift, 0.35 + yy, Math.sin(s[0]) * s[1]);
      }); p.needsUpdate = true;
    }
    if (this.volcanoSmoke) {
      const p = this.volcanoSmoke.geometry.attributes.position;
      this.volcanoSeed.forEach((s, i) => {
        const yy = (t * 1.2 + s[2]) % 8, spread = s[1] + yy * 0.15;
        p.setXYZ(i, Math.cos(s[0]) * spread, yy, Math.sin(s[0]) * spread);
      }); p.needsUpdate = true;
      this.lava.material.color.setRGB(2.6 + Math.sin(t * 3) * 0.4, 0.42, 0.08);
    }
    for (const [i, q] of this.penguins.entries()) {
      const w = Math.sin(t * 2.4 + q.phase);
      q.obj.rotation.z = w * (q.boss ? 0.035 : 0.09);
      q.obj.position.x = q.x + (q.boss ? 0 : w * 0.06);
      q.obj.position.y = this.h(q.x, q.z) + Math.max(0, Math.sin(t * 2.4 + q.phase)) * 0.045;
      if (i === 0) q.obj.rotation.y = Math.PI + Math.sin(t * 0.9) * 0.14;
    }
    if (this.clockLaser) this.clockLaser.visible = Math.sin(t * 8) > -0.25;
    if (inside) this.gags.update(g, g.player);
  }

  startQuest(g, a) {
    this.endQuestBits(g);
    this.checks = SITES.map((s) => ({ ...s, done: false, ring: null, pos: V3(s.x, this.h(s.x, s.z), s.z) }));
    this.clockCount = 0; this.clocked = 0;
    for (const s of this.checks) {
      const ring = this.makeQuestRing(g.world, s.color, s.name);
      ring.g.position.copy(s.pos); s.ring = ring; this.questBits.push(ring);
    }
    g.ui.banner('极光团建开始', '冰屋、温泉、火山，三处都要打卡！');
  }

  // 城区只依赖公共 kit；临时光圈结构与其一致，但不给任务管理器新增依赖
  makeQuestRing(scene, color, label) {
    const group = new THREE.Group(), c = new THREE.Color(color);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.8, 0.13, 8, 48), new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(2.5) }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.22; group.add(ring);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 18, 24, 1, true), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.035, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.y = 9; group.add(beam); scene.add(group);
    return { g: group, ring, spin(dt, t) { ring.rotation.z += dt * 0.8; ring.scale.setScalar(1 + Math.sin(t * 4) * 0.07); } };
  }

  updateQuest(g, dt, a) {
    if (!this.checks) this.startQuest(g, a);
    const p = g.player;
    for (const s of this.checks) {
      if (s.done) continue;
      s.ring.spin(dt, g.time);
      if (flat(p.pos, s.pos) < 3.2) {
        s.done = true; this.clocked++; g.world.remove(s.ring.g); s.ring.g.visible = false;
        g.audio.coin(); g.ui.banner(`${s.name} ${this.clocked}/3`, this.clocked === 3 ? '快回企鹅考勤机销假！' : '打卡成功，鱼暂时保住了'); g.laugh += 2;
      }
    }
    let nav;
    if (this.clocked < 3) {
      let best = Infinity;
      for (const s of this.checks) if (!s.done) {
        const d = flat(p.pos, s.pos);
        if (d < best) { best = d; nav = { pos: s.pos, label: `${s.name} · 未打卡` }; }
      }
    } else {
      const station = V3(STATION[0], this.h(...STATION), STATION[1]);
      nav = { pos: station, label: '回考勤机销假' };
      if (flat(p.pos, station) < 4.4) {
        this.returned = true; g.audio.ding();
        return { note: '打卡 3/3 · 已销假 · 200条鱼保住', win: true };
      }
    }
    a.nav = nav;
    return { note: `景点打卡 ${this.clocked}/3${this.clocked === 3 ? ' · 返回考勤机' : ' · 200条鱼待保'}`, win: false };
  }

  endQuestBits(g) {
    for (const bit of this.questBits) g.world.remove(bit.g);
    this.questBits.length = 0;
  }

  endQuest(g, win, a) {
    const count = this.clocked || 0;
    this.endQuestBits(g);
    for (const s of this.checks || []) s.ring = null;
    this.checks = []; this.returned = false; a.nav = null;
    return win
      ? ['三处打卡 + 回机销假：全勤！', '保住 <b>200 条鱼</b>，极光为你开了年会', '企鹅主管：下次可以提前 0.01 秒到']
      : [`打卡 ${count}/3 · ${count === 3 ? '忘回考勤机，系统判定旷工' : '景点没打满'}`, '200 条鱼已划走（北极狼代为保管）', '极夜很长，考勤机也不会下班，再来一次吧'];
  }
}
