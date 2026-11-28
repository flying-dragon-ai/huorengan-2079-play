// 精修共用构件：把装饰合并，少量 draw call 也能有真实轮廓
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export class Parts {
  constructor(group) { this.group = group; this.batches = new Map(); this.d = new THREE.Object3D(); }
  add(geo, material, x=0,y=0,z=0, rx=0,ry=0,rz=0, sx=1,sy=sx,sz=sx) {
    this.d.position.set(x,y,z); this.d.rotation.set(rx,ry,rz); this.d.scale.set(sx,sy,sz); this.d.updateMatrix();
    const g = geo.clone().applyMatrix4(this.d.matrix);
    // 装饰构件按纯色材质渲染；去掉用不到的 UV 与切线，避免合并时浪费显存
    if (material.isMeshStandardMaterial && !material.map && !material.normalMap && !material.roughnessMap && !material.emissiveMap) {
      for (const key of Object.keys(g.attributes)) if (!['position','normal'].includes(key)) g.deleteAttribute(key);
    }
    if (!this.batches.has(material)) this.batches.set(material, []);
    this.batches.get(material).push(g); return this;
  }
  beam(a, b, width, material, depth=width) {
    const d = b.clone().sub(a), mid = a.clone().add(b).multiplyScalar(.5);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), d.clone().normalize());
    const e = new THREE.Euler().setFromQuaternion(q);
    return this.add(new THREE.BoxGeometry(width,d.length(),depth), material, mid.x,mid.y,mid.z,e.x,e.y,e.z);
  }
  tube(points, radius, material, segments=24, radial=6) {
    const c = new THREE.CatmullRomCurve3(points);
    return this.add(new THREE.TubeGeometry(c,segments,radius,radial,false), material,0,0,0);
  }
  finish() {
    for (const [m, gs] of this.batches) {
      const g = mergeGeometries(gs, false);
      const mesh = new THREE.Mesh(g,m); mesh.castShadow = !m.isMeshBasicMaterial; mesh.receiveShadow = true;
      g.computeBoundingSphere(); this.group.add(mesh); gs.forEach(x=>x.dispose());
    }
    this.batches.clear();
  }
}

export function boxG(w,h,d) { return new THREE.BoxGeometry(w,h,d); }
export function cylG(rt,rb,h,seg=16) { return new THREE.CylinderGeometry(rt,rb,h,seg); }
export function sphereG(r,w=16,h=10) { return new THREE.SphereGeometry(r,w,h); }
export function torusG(r,t,rs=8,ts=64) { return new THREE.TorusGeometry(r,t,rs,ts); }
export function planeG(w,h) { return new THREE.PlaneGeometry(w,h); }
export function coneG(r,h,seg=8) { return new THREE.ConeGeometry(r,h,seg); }

// 冰屋逐层错缝砌块：不是一张半球贴皮
export function buildIglooBlocks(parts, x,y,z, s, iceA, iceB, mortar) {
  const r=3.55*s, H=3.6*s, rows=8;
  parts.add(new THREE.SphereGeometry(r*.985,32,16,0,Math.PI*2,0,Math.PI/2),mortar,x,y,z);
  for(let row=0;row<rows;row++){
    const y0=row*H/rows, y1=(row+1)*H/rows;
    const rr=Math.sqrt(Math.max(.02,r*r-y0*y0));
    const n=Math.max(6,Math.round(rr*6.5));
    for(let i=0;i<n;i++){
      const a=(i+(row%2)*.5)*Math.PI*2/n;
      if(z>0 && Math.abs(Math.atan2(Math.sin(a),Math.cos(a)))<.26 && y0<1.7*s) continue;
      const tang=rr*Math.PI*2/n*.96;
      const geo=new THREE.BoxGeometry(tang,H/rows*.88,.38*s);
      parts.add(geo,(row+i)%4?iceA:iceB,x+Math.sin(a)*rr,y+y0+H/rows*.48,z+Math.cos(a)*rr,0,a,0);
    }
  }
}

// 弯曲但连续的铁塔格构曲线
export function towerRadius(y) {
  if(y<10) return 7.2 - 3.5*Math.pow(y/10,.66);
  if(y<21) return 3.7 - 2.0*((y-10)/11);
  return 1.7*(1-(y-21)/13)+.16;
}
