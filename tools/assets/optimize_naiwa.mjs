// 主角保留skin/joints/weights的glTF优化；不同于静态gen模型，不剥离骨骼
// 用法：node tools/assets/optimize_naiwa.mjs <源.glb> <目标.glb>
import { NodeIO } from '../lux3d/node_modules/@gltf-transform/core/dist/index.js';
import { ALL_EXTENSIONS } from '../lux3d/node_modules/@gltf-transform/extensions/dist/index.js';
import { dedup, weld, simplify, prune, textureCompress } from '../lux3d/node_modules/@gltf-transform/functions/dist/index.js';
import { MeshoptSimplifier } from '../lux3d/node_modules/meshoptimizer/meshopt_simplifier.js';
import sharp from '../lux3d/node_modules/sharp/dist/index.mjs';
import { statSync } from 'node:fs';
await MeshoptSimplifier.ready;
const [src,dst]=process.argv.slice(2);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc=await io.read(src);
let tris=0;for(const m of doc.getRoot().listMeshes())for(const p of m.listPrimitives())tris+=(p.getIndices()?.getCount()||0)/3;
console.log('原面数',tris,'skins',doc.getRoot().listSkins().length,'animations',doc.getRoot().listAnimations().length);
await doc.transform(dedup(),weld(),simplify({simplifier:MeshoptSimplifier,ratio:Math.min(1,60000/Math.max(1,tris)),error:.008}),prune({keepLeaves:true,keepAttributes:true}));
await doc.transform(textureCompress({encoder:sharp,targetFormat:'jpeg',resize:[1024,1024],quality:88,slots:/^(?!normalTexture|occlusionTexture).*$/}));
await io.write(dst,doc);
console.log('完成',dst,statSync(dst).size,'bytes','skins',doc.getRoot().listSkins().length,'animations',doc.getRoot().listAnimations().length);
