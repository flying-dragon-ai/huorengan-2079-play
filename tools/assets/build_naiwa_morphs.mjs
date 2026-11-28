// 将Blender逐动作烘焙的形变目标合并到同一GLB，并添加morph weight动画
// 用法：node tools/assets/build_naiwa_morphs.mjs（在项目根目录执行，读写 assets/models/naiwa_morph_*.glb）
import { NodeIO } from '../lux3d/node_modules/@gltf-transform/core/dist/index.js';
import { ALL_EXTENSIONS } from '../lux3d/node_modules/@gltf-transform/extensions/dist/index.js';
import { readFileSync, writeFileSync } from 'node:fs';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
const names=['idle','walk','run','jump','bike'];
const doc=await io.read('assets/models/naiwa_morph_idle.glb');
const root=doc.getRoot(), meshes=root.listMeshes();
// 当前文件只有最后一个动作，重跑Blender每次输出各动作并在这里合并
const basePositions=meshes[0].listPrimitives()[0].getAttribute('POSITION').getArray();
const all=[];
for(const action of names){
 const d=await io.read(`assets/models/naiwa_morph_${action}.glb`);
 const src=d.getRoot().listMeshes()[0].listPrimitives()[0];
 const targets=src.listTargets();
 for(let i=0;i<targets.length;i++){
  const p=targets[i].getAttribute('POSITION');
  all.push({action,frame:i,array:p.getArray()});
 }
}
for(const mesh of meshes){
 for(const prim of mesh.listPrimitives()){
  const old=prim.listTargets();old.forEach(t=>prim.removeTarget(t));
  for(const t of all){
   const target=doc.createPrimitiveTarget().setAttribute('POSITION',doc.createAccessor().setType('VEC3').setArray(t.array));
   prim.addTarget(target);
  }
 }
 mesh.setExtras({targetNames:all.map(t=>`${t.action}_${t.frame}`)});
}
// 只创建有实际sampler的动画；不留空动画
for(const action of names){
 const times=[],weights=[],count=names.length*5;
 for(let f=0;f<5;f++){
  times.push(f/4*1.5);
  for(const t of all)weights.push(t.action===action&&t.frame===f?1:0);
 }
 const buffer=root.listBuffers()[0];
 const input=doc.createAccessor().setType('SCALAR').setArray(new Float32Array(times)).setBuffer(buffer);
 const output=doc.createAccessor().setType('SCALAR').setArray(new Float32Array(weights)).setBuffer(buffer);
 const channel=doc.createAnimationChannel().setTargetPath('weights');
 const node=root.listNodes().find(n=>n.getMesh()===meshes[0]);channel.setTargetNode(node);
 const sampler=doc.createAnimationSampler().setInput(input).setOutput(output).setInterpolation('LINEAR');
 channel.setSampler(sampler);
 doc.createAnimation().setName(action).addChannel(channel);
}
await io.write('assets/models/naiwa_baked.glb',doc);
console.log('morph targets',all.length,'animations',root.listAnimations().map(a=>a.getName()));
