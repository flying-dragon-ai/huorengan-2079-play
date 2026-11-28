// 中央广场的水景、商铺和南门饰件。坐标与岛上喷泉、碰撞体共用。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeCanvas, canvasTex, rng } from '../../core/util.js';

const TAU = Math.PI * 2;
const continents = [
  [[-168,67],[-147,70],[-128,72],[-110,74],[-90,68],[-76,71],[-61,58],[-53,50],[-66,46],[-74,40],[-81,31],[-81,25],[-85,30],[-97,26],[-98,20],[-88,18],[-83,10],[-77,8],[-82,7],[-92,15],[-105,20],[-115,31],[-123,39],[-126,49],[-139,58],[-154,57],[-161,60]],
  [[-81,10],[-72,12],[-60,8],[-51,3],[-48,-2],[-35,-6],[-39,-18],[-49,-29],[-57,-37],[-68,-55],[-73,-50],[-74,-29],[-81,-5]],
  [[-53,60],[-42,65],[-22,74],[-21,82],[-45,84],[-62,80],[-67,72]],
  [[-10,36],[-10,43],[-1,44],[-5,49],[8,54],[6,58],[17,70],[31,71],[23,59],[42,68],[65,72],[98,77],[121,72],[144,70],[178,65],[169,59],[153,58],[159,51],[145,46],[137,49],[129,42],[122,39],[122,30],[114,22],[108,21],[106,10],[100,16],[102,3],[96,12],[94,20],[85,21],[77,8],[71,20],[60,25],[55,17],[44,12],[34,29],[29,36],[24,40],[23,35],[14,37],[9,44],[4,42],[-2,36]],
  [[-17,15],[-16,27],[-7,36],[4,37],[16,32],[30,31],[35,25],[43,12],[51,12],[47,2],[41,-6],[40,-17],[32,-27],[26,-34],[18,-35],[12,-19],[13,-9],[9,4],[0,5],[-8,5]],
  [[112,-22],[115,-34],[131,-32],[138,-36],[149,-38],[154,-28],[145,-15],[142,-11],[136,-14],[130,-12],[119,-18]],
  [[-8,51],[-4,58],[1,53]], [[130,32],[137,35],[142,45],[144,43],[140,35],[133,31]],
  [[47,-13],[50,-16],[46,-26],[44,-23]], [[94,5],[106,-6],[104,-6],[97,0]],
  [[109,-3],[114,7],[119,4],[117,-3]], [[131,-2],[142,-4],[151,-9],[142,-9]],
  [[166,-46],[173,-39],[178,-37],[174,-42]], [[-22,63],[-16,67],[-13,65]],
];

export function globeMaps() {
  const [color, c] = makeCanvas(1024, 512), [light, e] = makeCanvas(1024, 512);
  const rnd = rng(2079);
  const ocean = c.createLinearGradient(0, 0, 0, 512);
  ocean.addColorStop(0, '#41699a'); ocean.addColorStop(0.48, '#11477d'); ocean.addColorStop(1, '#09285d');
  c.fillStyle = ocean; c.fillRect(0, 0, 1024, 512);
  e.fillStyle = '#07162d'; e.fillRect(0, 0, 1024, 512);
  const land = new Path2D();
  for (const polygon of continents) {
    polygon.forEach(([lon, lat], i) => {
      const x = (lon + 180) * 1024 / 360, y = (90 - lat) * 512 / 180;
      if (!i) land.moveTo(x,y); else land.lineTo(x,y);
    });
    land.closePath();
  }
  c.fillStyle = '#87bb91'; c.fill(land); c.strokeStyle = '#ddedb2'; c.lineWidth = 2; c.stroke(land);
  e.fillStyle = '#174742'; e.fill(land); e.strokeStyle = '#9cebd2'; e.lineWidth = 1.8; e.stroke(land);
  c.save(); c.clip(land); e.save(); e.clip(land);
  for (let i = 0; i < 6500; i++) {
    const x = rnd()*1024, y = rnd()*512, w = 1+rnd()*5;
    c.fillStyle = i%2 ? '#b3c98f' : '#6daa8b'; c.fillRect(x,y,w,1);
    if (i%7 === 0) { e.fillStyle = '#ffe3a3'; e.fillRect(x,y,1.4,1.4); }
  }
  c.restore(); e.restore(); e.strokeStyle = '#477d9c'; e.lineWidth = 1;
  e.beginPath();
  for (let i=0;i<24;i++) { const x=i*1024/24; e.moveTo(x,0); e.lineTo(x,512); }
  for (let i=1;i<12;i++) { const y=i*512/12; e.moveTo(0,y); e.lineTo(1024,y); }
  e.stroke();
  return { map: canvasTex(color), emissiveMap: canvasTex(light) };
}

// 固定装饰按材质合并，灯泡、石块、柱子越多也不必逐件绘制。
function detailBatch(group) {
  const batches = new Map();
  const transform = new THREE.Object3D();
  return {
    put(geometry, material, x, y, z, yaw=0, roll=0) {
      transform.position.set(x,y,z); transform.rotation.set(0,yaw,roll); transform.updateMatrix();
      const piece = geometry.clone().applyMatrix4(transform.matrix);
      if (!batches.has(material)) batches.set(material, []);
      batches.get(material).push(piece);
    },
    finish() {
      for (const [material, pieces] of batches) {
        const geometry = mergeGeometries(pieces);
        const mesh = new THREE.Mesh(geometry,material);
        mesh.castShadow = !material.isMeshBasicMaterial; mesh.receiveShadow = true; group.add(mesh);
        pieces.forEach(p => p.dispose());
      }
    },
  };
}

function storefrontTexture() {
  const [canvas,c] = makeCanvas(256,256);
  const g=c.createLinearGradient(0,0,0,256);
  g.addColorStop(0,'#925e4e'); g.addColorStop(.45,'#efbe7c'); g.addColorStop(1,'#795846');
  c.fillStyle=g; c.fillRect(0,0,256,256);
  for (let row=0;row<3;row++) {
    const y=105+row*54;
    for (let i=0;i<9;i++) {
      const h=10+(i*7+row*5)%18;
      c.fillStyle=['#b87148','#f9d6a0','#737e76','#b25946'][(i+row)%4]; c.fillRect(7+i*28,y-h,15,h);
    }
    c.fillStyle='#705549'; c.fillRect(0,y,256,6);
  }
  c.fillStyle='#4b3934'; c.fillRect(0,0,9,256); c.fillRect(247,0,9,256); c.fillRect(123,0,8,256); c.fillRect(0,51,256,8);
  return canvasTex(canvas);
}

function buildArcades(batch) {
  const stone = new THREE.MeshStandardMaterial({color:0xf1d7b3,roughness:.72});
  const brass = new THREE.MeshStandardMaterial({color:0xcb8b4a,roughness:.36,metalness:.48});
  const frame = new THREE.MeshStandardMaterial({color:0x374e51,roughness:.62});
  const cloth = new THREE.MeshStandardMaterial({color:0xfcddad,roughness:.88,side:THREE.DoubleSide});
  const stripe = new THREE.MeshStandardMaterial({color:0xb35043,roughness:.85,side:THREE.DoubleSide});
  const glass = storefrontTexture();
  const shop = new THREE.MeshStandardMaterial({map:glass,emissiveMap:glass,emissive:0xffcb96,emissiveIntensity:.55,roughness:.28});
  const cornice = new THREE.BoxGeometry(5.3,.25,.6), jamb=new THREE.BoxGeometry(.24,3.6,.32);
  const pane = new THREE.PlaneGeometry(4.75,2.85), trim=new THREE.BoxGeometry(4.9,.16,.2);
  const awning = new THREE.BoxGeometry(.66,.12,1.55); awning.rotateX(.17);
  const fringe = new THREE.BoxGeometry(.66,.29,.1);
  // 两排橱窗朝向喷泉，留出四条主通道。
  for (const [x,z,yaw,count] of [[-29.65,15,Math.PI/2,3],[40.46,15,-Math.PI/2,3],[-30.65,-15,Math.PI/2,3]]) {
    const dx=Math.cos(yaw), dz=-Math.sin(yaw), nx=Math.sin(yaw), nz=Math.cos(yaw);
    for(let j=0;j<count;j++) {
      const cx=x+(j-1)*4.85*dx, cz=z+(j-1)*4.85*dz;
      const put=(geo,mat,lateral,y,out)=>batch.put(geo,mat,cx+lateral*dx+out*nx,y,cz+lateral*dz+out*nz,yaw);
      put(pane,shop,0,1.74,.03); put(jamb,stone,-2.43,1.8,.12); put(jamb,stone,2.43,1.8,.12);
      put(cornice,stone,0,3.62,.1); put(trim,brass,0,.28,.16); put(trim,frame,0,3.29,.12);
      for(let k=0;k<7;k++) {
        const m=k%2?cloth:stripe, lateral=(k-3)*.66;
        put(awning,m,lateral,3.16,.85); put(fringe,m,lateral,2.91,1.55);
      }
    }
  }
}

function buildGateway(batch) {
  const ivory = new THREE.MeshStandardMaterial({color:0xe7ceaa,roughness:.68});
  const bronze = new THREE.MeshStandardMaterial({color:0xc1985e,metalness:.48,roughness:.32});
  const lamp = new THREE.MeshBasicMaterial({color:new THREE.Color(2.1,1.13,.36)});
  const block=new THREE.BoxGeometry(1.20,1.75,2.42);
  for(let i=0;i<23;i++) {
    const a=(i+.5)*Math.PI/23;
    batch.put(block,i%4===3?bronze:ivory,8.65*Math.cos(a),10+8.65*Math.sin(a),41,0,a-Math.PI/2);
  }
  const plinth=new THREE.BoxGeometry(3.08,.35,3.08), collar=new THREE.BoxGeometry(2.83,.14,2.83);
  for(const x of [-8.6,8.6]) {
    for(const y of [.2,.64,2.25,8.1,9.63,10.24]) batch.put(y<1?plinth:collar,bronze,x,y,41);
    for(const z of [39.48,42.52]) {
      batch.put(new THREE.BoxGeometry(.72,1.35,.45),bronze,x,6.8,z);
      batch.put(new THREE.SphereGeometry(.38,12,8),lamp,x,7.15,z+Math.sign(z-41)*.26);
    }
  }
}

function buildFountain(group, batch) {
  const stone = new THREE.MeshStandardMaterial({color:0xe7d9bb,roughness:.43});
  const gold = new THREE.MeshStandardMaterial({color:0xe7a24e,metalness:.68,roughness:.32});
  const water = new THREE.MeshStandardMaterial({color:0x63c9df,emissive:0x3388a1,emissiveIntensity:.7,roughness:.18,metalness:.18});
  const rimGlow = new THREE.MeshBasicMaterial({color:new THREE.Color(.35,1.3,1.55)});
  const ring=(radius,thickness,mat,y) => {
    const g=new THREE.TorusGeometry(radius,thickness,8,96); g.rotateX(Math.PI/2); batch.put(g,mat,0,y,0);
  };
  ring(15.55,.10,gold,.87); ring(14.9,.05,rimGlow,.39); ring(5.2,.15,gold,2.4);
  batch.put(new THREE.CylinderGeometry(6.0,4.6,.55,64),stone,0,2.5,0);
  ring(5.96,.12,rimGlow,2.8);
  const jet=new THREE.CatmullRomCurve3(Array.from({length:13},(_,i)=>{
    const t=i/12;
    return new THREE.Vector3(0,.44+2.25*t+4.4*4*t*(1-t),14.45-8.65*t);
  }));
  const tube = new THREE.TubeGeometry(jet,22,.085,6,false);
  const nozzle = new THREE.CylinderGeometry(.18,.25,.32,12);
  for(let i=0;i<20;i++) {
    const a=TAU*i/20;
    batch.put(tube,water,0,0,0,a);
    batch.put(nozzle,gold,14.45*Math.sin(a),.56,14.45*Math.cos(a));
  }
  const count=320, coords=new Float32Array(count*3), rnd=rng(45);
  const drops=Array.from({length:count},(_,i)=>({a:TAU*(i%20)/20+(rnd()-.5)*.032,phase:rnd(),height:4.2+rnd()*.55}));
  const geometry=new THREE.BufferGeometry();
  const points=new THREE.BufferAttribute(coords,3).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position',points); geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,4,0),17);
  const spray=new THREE.Points(geometry,new THREE.PointsMaterial({size:.135,color:0xd0f6ff,transparent:true,opacity:.79,depthWrite:false}));
  group.add(spray);
  return t=>{
    for(let i=0;i<count;i++) {
      const d=drops[i], f=(t*.71+d.phase)%1, r=14.45-8.65*f;
      points.setXYZ(i,r*Math.sin(d.a),.47+2.25*f+d.height*4*f*(1-f),r*Math.cos(d.a));
    }
    points.needsUpdate=true;
  };
}

export function buildPlazaDetails(island) {
  const group=new THREE.Group(); group.name='中央广场 · 南门与水景';
  const batch=detailBatch(group);
  buildGateway(batch); buildArcades(batch); buildPromenade(batch, island);
  const animate=buildFountain(group,batch);
  batch.finish(); island.add(group);
  return animate;
}

export function buildNorthRoofs(island, shops) {
  const group = new THREE.Group(), batch = detailBatch(group);
  const copper = new THREE.MeshStandardMaterial({color:0x558785, metalness:.36, roughness:.49});
  const slate = new THREE.MeshStandardMaterial({color:0x67556a, roughness:.66});
  const terra = new THREE.MeshStandardMaterial({color:0xac6952, roughness:.72});
  const limestone = new THREE.MeshStandardMaterial({color:0xe4caad, roughness:.72});
  const clock = shops.reduce((a,b)=>Math.abs(a.x)<Math.abs(b.x)?a:b);
  for (const [i,s] of shops.entries()) {
    const depth=15, roof = new THREE.CylinderGeometry(.73,1,2.8,4);
    roof.rotateY(Math.PI/4); roof.scale(s.w*.75,1,depth*.75);
    batch.put(roof,[slate,copper,terra][i%3],s.x,s.h+1.4,s.z);
    batch.put(new THREE.BoxGeometry(s.w+.22,.38,depth+.32),limestone,s.x,s.h,s.z);
    for (const dx of [-.27,.27]) {
      const x=s.x+s.w*dx;
      batch.put(new THREE.BoxGeometry(1.8,1.8,2.8),limestone,x,s.h+1.1,s.z+depth*.40);
      batch.put(new THREE.ConeGeometry(1.65,.98,4),copper,x,s.h+2.39,s.z+depth*.40,Math.PI/4);
    }
  }
  const {x,z,h}=clock;
  const base=h+2;
  batch.put(new THREE.BoxGeometry(5,12,5),limestone,x,base+6,z);
  for(const y of [1,8.5,12]) batch.put(new THREE.BoxGeometry(5.5,.36,5.5),copper,x,base+y,z);
  const [canvas,c]=makeCanvas(192,192);
  c.fillStyle='#243b47';c.fillRect(0,0,192,192);c.beginPath();c.arc(96,96,86,0,TAU);
  c.fillStyle='#ffe9ac';c.fill();c.strokeStyle='#a78353';c.lineWidth=7;c.stroke();
  c.save();c.translate(96,96);c.strokeStyle='#4c4144';
  for(let i=0;i<12;i++){c.lineWidth=i%3===0?5:2;c.beginPath();c.moveTo(0,-75);c.lineTo(0,-63);c.stroke();c.rotate(TAU/12);}
  c.lineWidth=7;c.lineCap='round';c.beginPath();c.moveTo(-27,-32);c.lineTo(0,0);c.lineTo(39,-13);c.stroke();c.restore();
  const face=new THREE.MeshBasicMaterial({map:canvasTex(canvas),color:0xffe2a7});
  for(let i=0;i<4;i++){
    const a=i*TAU/4;
    batch.put(new THREE.PlaneGeometry(3.86,3.86),face,x+Math.sin(a)*2.51,base+10.15,z+Math.cos(a)*2.51,a);
  }
  batch.put(new THREE.ConeGeometry(4.15,6.6,4),copper,x,base+15.27,z,Math.PI/4);
  batch.put(new THREE.ConeGeometry(.22,3.6,12),copper,x,base+20.1,z);
  batch.finish();island.add(group);
}

// 岛外的两层山脊在远雾中分开，南边保留海面与结局烟花的视野。
export function buildDistantHills(island) {
  for (let band=0;band<2;band++) {
    const rand=rng(381+band),pos=[],colors=[],indices=[], segments=160;
    const base=band?640:940;
    for (let i=0;i<=segments;i++) {
      const a=(-126+i/segments*255)*Math.PI/180;
      const height=32+18*Math.sin(4*a+.6)+14*Math.sin(11*a+band)+12*Math.sin(25*a+band)+13*rand()+(band?0:40);
      for (let j=0;j<4;j++){
        const radius=base+j*24;pos.push(Math.sin(a)*radius,[-8,height*.39,height*.74,height][j],-Math.cos(a)*radius);
        const color=new THREE.Color((band?[0x59646d,0x6b777c,0x76818c,0x8c8b94]:[0x9294a8,0x9996a7,0xb3a5b7,0xbcb0bf])[j]);
        color.multiplyScalar(.91+rand()*.14);colors.push(color.r,color.g,color.b);
      }
      if(i>0) for(let j=0;j<3;j++){const n=i*4+j;indices.push(n-4,n,n-3,n,n+1,n-3);}
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);
    island.add(new THREE.Mesh(g,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide})));
  }
}

function buildPromenade(batch, island) {
  const wood=new THREE.MeshStandardMaterial({color:0x9e6849,roughness:.67});
  const iron=new THREE.MeshStandardMaterial({color:0x394a48,metalness:.48,roughness:.43});
  const copper=new THREE.MeshStandardMaterial({color:0xc48a56,metalness:.42,roughness:.45});
  const slat=new THREE.BoxGeometry(3.0,.12,.2), back=new THREE.BoxGeometry(3.0,.19,.09), leg=new THREE.BoxGeometry(.105,.94,.1);
  const lamp=new THREE.MeshBasicMaterial({color:new THREE.Color(1.6,1,.47)});
  for(let i=0;i<8;i++){
    const a=(i+.5)*TAU/8, yaw=Math.PI/2-a, c=Math.cos(yaw),s=Math.sin(yaw);
    const x=22*Math.cos(a),z=22*Math.sin(a);
    const put=(g,m,dx,y,dz)=>batch.put(g,m,x+c*dx+s*dz,y,z-s*dx+c*dz,yaw);
    for(let k=-1;k<=1;k++)put(slat,wood,0,.59,.22*k);
    for(const y of [.91,1.17])put(back,wood,0,y,.32);
    for(const dx of [-1.12,1.12]){
      put(leg,iron,dx,.61,.32);put(new THREE.BoxGeometry(.11,.5,.11),iron,dx,.28,-.26);
      put(new THREE.BoxGeometry(.09,.1,.68),iron,dx,.78,.02);
    }
    const lx=26*Math.cos(a),lz=26*Math.sin(a);
    batch.put(new THREE.CylinderGeometry(.27,.48,.6,8),iron,lx,.31,lz);
    batch.put(new THREE.CylinderGeometry(.14,.24,.45,8),copper,lx,1.05,lz);
    batch.put(new THREE.CylinderGeometry(.47,.29,.26,6),iron,lx,5.96,lz);
    batch.put(new THREE.ConeGeometry(.62,.36,6),iron,lx,6.75,lz);
    batch.put(new THREE.SphereGeometry(.12,10,8),copper,lx,6.98,lz);
    for(let k=0;k<6;k++){
      const b=k*TAU/6;batch.put(new THREE.CylinderGeometry(.025,.036,.56,5),iron,lx+.39*Math.cos(b),6.32,lz+.39*Math.sin(b));
    }
  }
  const cable=new THREE.MeshStandardMaterial({color:0x423c3d,roughness:.8});
  for(let i=0;i<8;i++) {
    const angle=(i+.5)*TAU/8,next=angle+TAU/8;
    const start=new THREE.Vector3(26*Math.cos(angle),6,26*Math.sin(angle));
    const end=new THREE.Vector3(26*Math.cos(next),6,26*Math.sin(next));
    const mid=start.clone().lerp(end,.5);mid.y-=1.4;
    const path=new THREE.CatmullRomCurve3([start,mid,end]);
    batch.put(new THREE.TubeGeometry(path,16,.028,5,false),cable,0,0,0);
  }
  // 两个街角的售货亭在环道之外；只给实物占地加碰撞。
  const cream = new THREE.MeshStandardMaterial({color:0xf2d3a2,roughness:.7});
  const green = new THREE.MeshStandardMaterial({color:0x438783,roughness:.58});
  const red = new THREE.MeshStandardMaterial({color:0xb85c52,roughness:.59});
  const menuTex=storefrontTexture();
  const shelf=new THREE.MeshStandardMaterial({map:menuTex,emissiveMap:menuTex,emissive:0xffc890,emissiveIntensity:.48});
  for(const [x,z,paint,label] of [[-22,-23,green,'花房'],[22,-23,red,'面包房']]) {
    const yaw=x<0?.4:-.4, c=Math.cos(yaw),s=Math.sin(yaw);
    const put=(g,m,dx,y,dz)=>batch.put(g,m,x+c*dx+s*dz,y,z-s*dx+c*dz,yaw);
    put(new THREE.BoxGeometry(5.9,.94,3.6),cream,0,.47,0);
    put(new THREE.BoxGeometry(6.4,.21,4.1),wood,0,1.03,0);
    for(const dx of [-2.85,2.85]) for(const dz of [-1.65,1.65])put(new THREE.CylinderGeometry(.1,.18,3.6,8),paint,dx,1.82,dz);
    put(new THREE.PlaneGeometry(5.65,2.24),shelf,0,2.12,-1.6);
    put(new THREE.BoxGeometry(6.6,.36,4.4),paint,0,3.75,0);
    const roof=new THREE.CylinderGeometry(.40,1,1.55,4);roof.rotateY(Math.PI/4);roof.scale(5,1,3.4);
    put(roof,paint,0,4.69,0);
    const [can,ctx]=makeCanvas(320,72);ctx.fillStyle='#253b3c';ctx.fillRect(0,0,320,72);
    ctx.strokeStyle='#caa469';ctx.strokeRect(5,5,310,62);ctx.fillStyle='#ffe7b5';ctx.font='600 40px "PingFang SC", sans-serif';ctx.textAlign='center';ctx.fillText(label,160,49);
    put(new THREE.PlaneGeometry(3.45,.78),new THREE.MeshBasicMaterial({map:canvasTex(can)}),0,3.77,2.23);
    for(const dx of [-2.45,2.45])put(new THREE.SphereGeometry(.20,12,8),lamp,dx,3.24,1.54);
    island.col.add(x-2.85,x+2.85,z-1.8,z+1.8,4.4);
  }
}
