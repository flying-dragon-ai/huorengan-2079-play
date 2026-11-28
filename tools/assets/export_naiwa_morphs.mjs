// 用Three.js官方GLTFExporter导出标准形变动画，避免动画引用丢失
// 用法：node tools/assets/export_naiwa_morphs.mjs（在项目根目录执行，读写 assets/models/naiwa_morph_*.glb）
import * as THREE from '../../vendor/three/three.module.js';
import { GLTFLoader } from '../../vendor/three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from '../../vendor/three/addons/exporters/GLTFExporter.js';
import { readFileSync, writeFileSync } from 'node:fs';
if (typeof self === 'undefined') globalThis.self = globalThis;
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { return blob.arrayBuffer().then(b => { this.result = b; this.onloadend?.(); }); }
  readAsDataURL(blob) { return blob.arrayBuffer().then(b => { this.result = 'data:' + (blob.type || 'application/octet-stream') + ';base64,' + Buffer.from(b).toString('base64'); this.onloadend?.(); }); }
};
const loader=new GLTFLoader();
const group=new THREE.Group();
const clips=[];
// GLTFLoader输入为ArrayBuffer
// 浏览器/Node的GLTFLoader输入为ArrayBuffer
for(const [i,action] of ['idle','walk','run','jump','bike'].entries()){
 const b=readFileSync(`assets/models/naiwa_morph_${action}.glb`);
 const gltf=await loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
 let src;gltf.scene.traverse(o=>{if(o.isMesh&&o.morphTargetInfluences)src=o});
 if(i===0){group.add(gltf.scene);}
 const first=group.children[0];
 // 先统一为“相对Basis的偏移”，防止不同GLB导出器对shape key语义不同
 const base=gltf.scene;
 base.traverse(o=>{
  if(!o.isMesh||!o.morphTargetInfluences)return;
  const basePos=o.geometry.attributes.position;
  for(const attr of o.geometry.morphAttributes.position){
   for(let k=0;k<attr.count;k++){
    attr.setXYZ(k,attr.getX(k)-basePos.getX(k),attr.getY(k)-basePos.getY(k),attr.getZ(k)-basePos.getZ(k));
   }
  }
 });
 if(i>0){
  const target=group.children[0];
  target.traverse(o=>{
   if(!o.isMesh||!o.morphTargetInfluences)return;
   for(let k=0;k<src.morphTargetInfluences.length;k++){
    o.morphTargetInfluences.push(0);
    o.geometry.morphAttributes.position.push(src.geometry.morphAttributes.position[k].clone());
    o.geometry.morphAttributes.normal.push(src.geometry.morphAttributes.normal[k].clone());
   }
   o.morphTargetDictionary={};
   for(let a=0;a<5;a++)for(let f=0;f<5;f++)o.morphTargetDictionary[['idle','walk','run','jump','bike'][a]+'_'+f]=a*5+f;
  });
 }
 const tracks=[];
 const target=group.children[0].children[0];
 const times=[],values=[];
 for(let f=0;f<5;f++){times.push(f*.375);for(let a=0;a<25;a++)values.push(a===i*5+f?1:0)}
 tracks.push(new THREE.NumberKeyframeTrack(`${src.name}.morphTargetInfluences`,times,values));
 clips.push(new THREE.AnimationClip(action,1.5,tracks));
}
const exporter=new GLTFExporter();
const result=await exporter.parseAsync(group,{binary:true,animations:clips,trs:false,onlyVisible:false});
writeFileSync('assets/models/naiwa_baked.glb',Buffer.from(result));
console.log('exported',result.byteLength,'clips',clips.map(c=>c.name));
