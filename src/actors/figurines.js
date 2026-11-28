// 单文件版的小手办。每个角色用顶点颜色合成一个网格，供队友和合唱团重复使用。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const paint = new THREE.MeshStandardMaterial({vertexColors:true, roughness:.56});
const ball = new THREE.SphereGeometry(1,16,12);
const cube = new THREE.BoxGeometry(1,1,1);
const cone = new THREE.ConeGeometry(1,1,12);
const tube = new THREE.CylinderGeometry(1,1,1,14);
const round = new THREE.CylinderGeometry(1,1,1,20).rotateX(Math.PI/2);
const skin = {
  catbanana:0xffdb49,catoiia:0xb4845e,buding:0xd39c68,daodun:0xc58b54,opossum:0x93879b,rabbit:0xe5c7c1,
  gugugaga:0x3c4d60,penguin:0x374354,agentpenguin:0x2f3943,duck:0xffd353,fantasy:0x9bc6ba,
  minotaur:0x86675b,xiaoxing:0xffc683,whalemaid:0x72b2c5,wukong:0xe7c677,frogknight:0x9faebc,frogschool:0x94c6b0,
};

export function figurine(kind) {
  const pieces=[], pose=new THREE.Object3D();
  function part(source,color,x,y,z,sx,sy,sz,roll=0) {
    pose.position.set(x,y,z); pose.scale.set(sx,sy,sz); pose.rotation.z=roll; pose.updateMatrix();
    const g=source.clone().applyMatrix4(pose.matrix), c=new THREE.Color(color);
    const colors=new Float32Array(g.attributes.position.count*3);
    for (let i=0;i<colors.length;i+=3) c.toArray(colors,i);
    g.setAttribute('color',new THREE.BufferAttribute(colors,3)); pieces.push(g);
  }
  const body=skin[kind], pale=0xffe9c5, dark=0x24232e;
  const bird=['gugugaga','penguin','agentpenguin','duck','fantasy'].includes(kind);
  const frog=['wukong','frogknight','frogschool'].includes(kind);
  part(ball,body,0,.59,0,.43,.54,.37);
  part(ball,pale,0,.54,.22,.34,.39,.17);
  part(ball,body,0,1.05,.03,frog?.5:.44,.36,.36);
  for(const s of [-1,1]) {
    part(ball,bird?0xf3a34b:body,s*.23,.105,.09,.2,.11,.26);
    part(ball,body,s*.4,.63,0,.13,.26,.15,s*.34);
    const ey=frog?1.31:1.12;
    if(frog) part(ball,body,s*.25,ey,0.11,.19,.18,.19);
    part(ball,0xfffcf1,s*.17,ey,.32,.105,.115,.063);
    part(ball,dark,s*.17,ey,.375,.053,.077,.027);
    part(ball,0xffffff,s*.17-.018,ey+.025,.396,.018,.017,.011);
    if (!bird && !frog && kind!=='whalemaid' && kind!=='xiaoxing') {
      if(kind==='rabbit') part(ball,body,s*.19,1.48,0,.12,.36,.10,-s*.16);
      else part(cone,kind==='minotaur'?pale:body,s*.29,1.4,0,.14,.32,.12,-s*.18);
    }
  }
  if (bird) part(ball,0xef9b38,0,1.01,.37,.16,.07,.13);
  else if (!frog) part(ball,kind==='opossum'?0xf298a9:dark,0,1.00,.38,.078,.055,.045);
  if(kind==='daodun' || kind==='frogknight') {
    part(round,0xb87e36,-.48,.6,.18,.27,.32,.08);
    part(round,0x65939f,-.48,.6,.23,.22,.26,.05);
    part(cube,0xbcdae4,.52,.81,.1,.078,.74,.08,-.16);
    part(cube,0xd69d4f,.50,.55,.1,.26,.07,.12);
  } else if(kind==='catbanana') {
    part(cone,0xf6c53a,0,1.48,-.02,.22,.44,.17,-.43);
    part(ball,0xfff1d3,0,1.04,.27,.30,.22,.072);
    for (const s of [-1,1]) part(ball,0x77cbeb,s*.23,.95,.35,.047,.085,.03);
  } else if(kind==='catoiia' || kind==='buding') {
    for(const s of [-1,0,1]) part(ball,0x765744,s*.115,1.32,.21,.029,.08,.02,s*.2);
    part(ball,body,.37,.67,-.25,.12,.31,.12,-.45);
  } else if(kind==='penguin' || kind==='agentpenguin') {
    part(tube,0x574c49,0,1.39,0,.38,.07,.32); part(ball,0x766358,0,1.42,0,.28,.17,.24);
    if(kind==='agentpenguin') part(cube,dark,0,1.14,.37,.55,.12,.05);
  } else if(kind==='duck' || kind==='fantasy') {
    part(ball,0xe17e38,.43,.47,.23,.19,.19,.19); part(cube,0x494151,.43,.48,.398,.30,.025,.014);
    if(kind==='fantasy') part(cone,0xb28dcc,0,1.57,0,.27,.48,.23,-.14);
  } else if(kind==='frogschool' || kind==='wukong') {
    if(kind==='frogschool') { part(cube,0x436477,0,.71,-.34,.54,.49,.26); part(cone,0xcb5252,0,.82,.34,.14,.2,.05,Math.PI); }
    else { part(tube,0xe7b849,0,1.28,.04,.43,.09,.34); part(tube,0xc57540,.52,.82,.1,.045,1.60,.045,-.1); }
  } else if(kind==='whalemaid') {
    part(ball,0xfff3dd,0,.65,.30,.27,.3,.08);
    for(const s of [-1,1]) part(ball,body,s*.25,1.46,-.04,.3,.1,.12,s*.4);
  } else if(kind==='xiaoxing') {
    for(let i=0;i<5;i++) {const a=i*Math.PI*2/5; part(cone,0xffbd49,.33*Math.sin(-a),1.13+.33*Math.cos(a),.02,.15,.34,.10,a);}
  }
  const mesh=new THREE.Mesh(mergeGeometries(pieces),paint);
  pieces.forEach(g=>g.dispose()); return mesh;
}
