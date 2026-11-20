// 常用街区细节：入口橱窗、空调、雨棚、落水管、路面与街边构件
import * as THREE from 'three';
import { Parts, boxG, cylG, sphereG, torusG } from './detail.js';
import { mat } from './kit.js';

export function buildStreetRefinements(island) {
  const P=new Parts(new THREE.Group());
  const dark=mat(0x273239,{metalness:.55,roughness:.44});
  const steel=mat(0x869196,{metalness:.65,roughness:.37});
  const stone=mat(0xc5bcae,{roughness:.87});
  const rubber=mat(0x333332,{roughness:.92});
  // 广场铺装的铜色嵌线、雨水篦子，细节不在光里而在地面
  for(const z of [-29,29]) for(let x=-24;x<=24;x+=3) {
    P.add(boxG(1.5,.025,.12),mat(0xb08e5e,{metalness:.4,roughness:.55}),x,.07,z);
    if(x%6===0) for(let k=0;k<6;k++)P.add(boxG(.08,.035,.85),dark,x-.5+k*.18,.07,z+1.5);
  }
  // 公共近景构件应放在南侧人行道，避免嵌进北侧楼体
  for(const x of [68,84,100,116,132]) {
    const z=-87.2;
    P.add(boxG(5.8,.18,1.25),mat(0xd3d8d5),x,3.9,z);
    P.add(boxG(5.6,.14,.12),mat(0x41aa8b),x,3.72,z-.65);
    for(const dx of [-2.5,-.85,.85,2.5])P.add(boxG(.08,3.0,.1),steel,x+dx,1.8,z-.12);
    P.add(boxG(5.4,.12,.18),dark,x,.35,z-.1);
    P.add(boxG(5.7,.18,1.3),stone,x,.12,z-.45);
    // 门侧海报与饮品箱
    P.add(boxG(.72,1.1,.14),mat(0xe2d6b0),x+2.1,1.7,z-.24);
    P.add(boxG(.65,.72,.65),mat(0x4a86ad),x-3.6,.4,z-.45);
  }
  // 沿街空调外机、金属背网、落水管和固定卡箍
  for(const x of [63,78,96,114,130,140]) {
    const z=-87.2,y=5.6+(Math.round(x)%3);
    P.add(boxG(1.1,.65,.4),mat(0xc3c6bf,{roughness:.65}),x,y,z);
    for(let k=0;k<6;k++)P.add(boxG(.055,.44,.025),dark,x-.37+k*.15,y,z-.22);
    P.add(boxG(1.25,.08,.55),steel,x,y-.4,z);
    P.add(cylG(.055,.055,4.4,8),steel,x+.75,y-4.4,z);
    for(let j=0;j<3;j++)P.add(boxG(.24,.055,.18),dark,x+.75,y-j*1.2-.5,z);
  }
  // 东京湿路黄色停车线、排水盖
  for(const x of [62,78,96,114,130]) {
    P.add(boxG(6,.025,.12),mat(0xd3a84c),x,.08,-97.6);
    for(let k=0;k<8;k++)P.add(boxG(.05,.035,.7),dark,x-.4+k*.12,.075,-92.5);
  }
  // 广场临街店面空调与圆灯
  for(const x of [-30,30]) for(const z of [-10,2,14]) {
    P.add(boxG(.5,.55,1.1),steel,x,4.8,z);
    P.add(boxG(.06,.3,.8),dark,x+(x<0?.27:-.27),4.8,z);
  }
  P.group.name='街区近景细节';P.finish();island.add(P.group);
}
