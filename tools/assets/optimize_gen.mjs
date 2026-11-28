// 将 Lux3D 高模压为网页可运行 GLB；原文件保留在 assets/models/原始/gen。
// 用法：node tools/assets/optimize_gen.mjs [文件名...]（在项目根目录执行；不带参数则处理 assets/models/gen 下全部 .glb）
import { NodeIO } from '../lux3d/node_modules/@gltf-transform/core/dist/index.js';
import { ALL_EXTENSIONS } from '../lux3d/node_modules/@gltf-transform/extensions/dist/index.js';
import { dedup, weld, simplify, prune, textureCompress } from '../lux3d/node_modules/@gltf-transform/functions/dist/index.js';
import { MeshoptSimplifier } from '../lux3d/node_modules/meshoptimizer/meshopt_simplifier.js';
import sharp from '../lux3d/node_modules/sharp/dist/index.mjs';
import { readdirSync, mkdirSync, existsSync, copyFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
await MeshoptSimplifier.ready;
const dir = resolve('assets/models/gen'), orig = resolve('assets/models/原始/gen');
mkdirSync(orig, { recursive: true });
const files = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync(dir).filter((x) => x.endsWith('.glb'));
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const name of files) {
  const p = resolve(dir, name.endsWith('.glb') ? name : name + '.glb');
  if (!existsSync(p)) continue;
  const base = p.split('/').pop(), backup = resolve(orig, base);
  if (!existsSync(backup)) copyFileSync(p, backup);
  console.log('优化', base, '原大小', Math.round(statSync(backup).size / 1048576), 'MB');
  const doc = await io.read(backup);
  let tris = 0; for (const m of doc.getRoot().listMeshes()) for (const pr of m.listPrimitives()) tris += (pr.getIndices()?.getCount() || 0) / 3;
  await doc.transform(dedup(), weld(), simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, 14000 / Math.max(1, tris)), error: 0.01 }), prune());
  await doc.transform(textureCompress({ encoder: sharp, targetFormat: 'jpeg', resize: [1024, 1024], quality: 83, slots: /^(?!normalTexture|occlusionTexture).*$/ }));
  await io.write(p, doc);
  let after = 0; for (const m of doc.getRoot().listMeshes()) for (const pr of m.listPrimitives()) after += (pr.getIndices()?.getCount() || 0) / 3;
  console.log('完成', base, Math.round(tris), '→', Math.round(after), '面；', statSync(p).size, 'bytes');
}
