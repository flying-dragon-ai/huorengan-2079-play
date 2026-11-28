// 迁移预演：把 src/ 按四层映射复制到 .layertest/，改写说明符，再跑分层守卫。
// 不碰 git、不碰真实 src/，用来在动手前确认映射与改写规则正确。
// 用法：node tools/migrate/dryrun.mjs && node .layertest/tools/ci/check-layers.mjs
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import { join, dirname, relative, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const DST = join(ROOT, '.layertest');
const posix = (p) => p.split(sep).join('/');

const RULES = [
  [/^src\/main\.js$/, 'src/app/main.js'],
  [/^src\/core\/(config|paths|math|util)\.js$/, 'src/shared/$1.js'],
  [/^src\/core\/input\.js$/, 'src/infrastructure/input/input.js'],
  [/^src\/data\/(.+)$/, 'src/shared/data/$1'],
  [/^src\/gfx\/(.+)$/, 'src/infrastructure/render/$1'],
  [/^src\/audio\/(.+)$/, 'src/infrastructure/audio/$1'],
  [/^src\/world\/(.+)$/, 'src/domain/world/$1'],
  [/^src\/actors\/(.+)$/, 'src/domain/actors/$1'],
  [/^src\/game\/(.+)$/, 'src/domain/game/$1'],
  [/^src\/viewer\/(.+)$/, 'src/app/viewer/$1'],
];
const mv = (f) => {
  for (const [re, to] of RULES) if (re.test(f)) return f.replace(re, to);
  return f;
};

const files = [];
(function walk(d) {
  for (const e of readdirSync(join(ROOT, d), { withFileTypes: true })) {
    const rel = posix(join(d, e.name));
    if (e.isDirectory()) walk(rel);
    else if (e.name.endsWith('.js')) files.push(rel);
  }
})('src');

const o2n = new Map(files.map((f) => [f, mv(f)]));
const SPEC = /\b(from\s+|import\s*\(\s*)(['"])(\.\.?\/[^'"]+)\2/g;

rmSync(DST, { recursive: true, force: true });
for (const of of files) {
  const nf = o2n.get(of);
  const text = readFileSync(join(ROOT, of), 'utf8');
  const out = text.replace(SPEC, (whole, lead, q, spec) => {
    const ot = posix(normalize(join(dirname(of), spec)));
    const nt = o2n.get(ot);
    if (!nt) return whole;
    let rel = posix(relative(dirname(nf), nt));
    if (!rel.startsWith('.')) rel = './' + rel;
    return lead + q + rel + q;
  });
  const dest = join(DST, nf);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, out, 'utf8');
}
mkdirSync(join(DST, 'tools/ci'), { recursive: true });
copyFileSync(join(ROOT, 'tools/ci/check-layers.mjs'), join(DST, 'tools/ci/check-layers.mjs'));
console.log(`built ${files.length} files -> ${DST}`);
