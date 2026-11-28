#!/usr/bin/env node
/**
 * 一次性迁移工具：把 `src/` 内的相对 import 说明符按四层分层映射重写。
 *
 * 设计要点：
 *  - **在 `git mv` 之前运行**，原地改写旧路径上的文件。git mv 之后历史仍然连续，
 *    因为 git 按内容相似度跟踪重命名，内容改动不影响 rename 检测。
 *  - 同时处理三种说明符：`from '...'`、`export ... from '...'`、JSDoc 里的 `import('...')`。
 *  - 只改相对说明符（`./` `../`），裸说明符（`three`、`three/addons/...`）原样保留。
 *  - 幂等：重复运行不会二次改写（改写后说明符已指向新位置，再算一次结果相同）。
 *
 * 用法：
 *   node tools/migrate/rewrite-imports.mjs --dry-run   # 只报告，不落盘
 *   node tools/migrate/rewrite-imports.mjs             # 实际改写
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, relative, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const DRY = process.argv.includes('--dry-run');

/** 统一成正斜杠，跨平台比较用。 */
const posix = (p) => p.split(sep).join('/');

/**
 * 旧路径 → 新路径的目录级规则。顺序敏感：先匹配先生效。
 * 每条规则作用在「相对仓库根、正斜杠分隔」的路径上。
 * @type {Array<[RegExp, string]>}
 */
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

/**
 * 把旧路径映射成新路径。未命中任何规则时原样返回。
 * @param {string} oldRel 相对仓库根、正斜杠分隔
 * @returns {string}
 */
function mapPath(oldRel) {
  for (const [re, to] of RULES) {
    if (re.test(oldRel)) return oldRel.replace(re, to);
  }
  return oldRel;
}

/** 递归收集 `src/` 下所有 .js 文件（相对仓库根、正斜杠）。 */
function collect(dir = 'src') {
  /** @type {string[]} */
  const out = [];
  for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const rel = posix(join(dir, e.name));
    if (e.isDirectory()) out.push(...collect(rel));
    else if (e.name.endsWith('.js')) out.push(rel);
  }
  return out;
}

const files = collect();
/** @type {Map<string,string>} 旧路径 → 新路径 */
const oldToNew = new Map(files.map((f) => [f, mapPath(f)]));

// 说明符匹配：`from '...'` / `import('...')`。捕获引号与说明符本体。
const SPEC_RE = /\b(from\s+|import\s*\(\s*)(['"])(\.\.?\/[^'"]+)\2/g;

/** @type {Array<{file:string, from:string, to:string}>} */
const changes = [];
/** @type {string[]} 无法解析的说明符（指向 src 之外或不存在） */
const unresolved = [];

for (const oldFile of files) {
  const newFile = oldToNew.get(oldFile);
  const abs = join(ROOT, oldFile);
  const text = readFileSync(abs, 'utf8');

  const next = text.replace(SPEC_RE, (whole, lead, quote, spec) => {
    // 说明符按「旧位置」解析出旧目标
    const oldTarget = posix(normalize(join(dirname(oldFile), spec)));
    const newTarget = oldToNew.get(oldTarget);
    if (!newTarget) {
      unresolved.push(`${oldFile}: ${spec}`);
      return whole;
    }
    // 按「新位置」算出新的相对说明符
    let rel = posix(relative(dirname(newFile), newTarget));
    if (!rel.startsWith('.')) rel = './' + rel;
    if (rel === spec) return whole;
    changes.push({ file: oldFile, from: spec, to: rel });
    return lead + quote + rel + quote;
  });

  if (next !== text && !DRY) writeFileSync(abs, next, 'utf8');
}

// ---------- 报告 ----------
const byPair = new Map();
for (const c of changes) {
  const k = `${c.from}  =>  ${c.to}`;
  byPair.set(k, (byPair.get(k) ?? 0) + 1);
}

console.log(`扫描 ${files.length} 个文件，需改写 ${changes.length} 处说明符。`);
for (const [k, n] of [...byPair].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(3)}x  ${k}`);
}
if (unresolved.length) {
  console.log(`\n未解析（指向 src 之外，已跳过）：${unresolved.length} 处`);
  for (const u of unresolved.slice(0, 20)) console.log('  ' + u);
}
console.log(DRY ? '\n[dry-run] 未写入任何文件。' : '\n已写入。');
