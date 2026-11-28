#!/usr/bin/env node
/**
 * 分层依赖守卫（零依赖，CI 与本地通用）。
 *
 * 校验 `src/` 的四层架构约束：
 *   app ─▶ domain ─▶ infrastructure ─▶ shared
 * 只允许向下依赖与同层依赖；反向依赖、跨层跳跃、以及任何循环依赖都判失败。
 *
 * 与 ESLint 的 `no-restricted-imports` 互补：ESLint 给编辑器即时反馈，
 * 本脚本做真实路径解析，是 CI 的权威门禁（ESLint 的 glob 匹配对相对路径不可靠）。
 *
 * 用法：
 *   node tools/ci/check-layers.mjs
 *   node tools/ci/check-layers.mjs --json
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const JSON_OUT = process.argv.includes('--json');
const posix = (p) => p.split(sep).join('/');

/** 分层顺序：索引越小越靠上。上层可依赖下层，反之禁止。 */
const LAYERS = ['app', 'domain', 'infrastructure', 'shared'];

/** 每层允许依赖的层（含自身）。 */
const ALLOWED = {
  app: ['app', 'domain', 'infrastructure', 'shared'],
  domain: ['domain', 'infrastructure', 'shared'],
  infrastructure: ['infrastructure', 'shared'],
  shared: ['shared'],
};

/** 递归收集 `src/` 下的 .js 文件（相对仓库根、正斜杠）。 */
function collect(dir = 'src') {
  /** @type {string[]} */
  const out = [];
  let entries;
  try {
    entries = readdirSync(join(ROOT, dir), { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const rel = posix(join(dir, e.name));
    if (e.isDirectory()) out.push(...collect(rel));
    else if (e.name.endsWith('.js')) out.push(rel);
  }
  return out;
}

/** 取路径的层名；不在四层内返回 null。 */
function layerOf(rel) {
  const seg = rel.split('/')[1];
  return LAYERS.includes(seg) ? seg : null;
}

const files = collect();
const fileSet = new Set(files);
/** @type {Map<string,string[]>} */
const graph = new Map();
/** @type {string[]} */
const errors = [];

// 说明符分两类：
//  - 运行时 `from '...'`（含 `export ... from`）—— 参与分层校验 + 循环检测
//  - JSDoc 类型引用 `import('...')` —— 只参与分层校验（类型引用不产生运行时环）
// 裸说明符（three、three/addons/...）不参与校验。
const RUNTIME_RE = /\bfrom\s+(['"])(\.\.?\/[^'"]+)\1/g;
const TYPE_RE = /\bimport\s*\(\s*(['"])(\.\.?\/[^'"]+)\1\s*\)/g;

/**
 * 解析一段源码里的相对说明符。
 * @param {string} text 源码
 * @param {string} file 该文件相对仓库根的路径
 * @param {RegExp} re 带全局标志的说明符正则
 * @returns {string[]} 解析后的目标路径
 */
function resolveSpecs(text, file, re) {
  /** @type {string[]} */
  const out = [];
  re.lastIndex = 0;
  let m;
  while ((m = re.exec(text))) {
    const target = posix(normalize(join(dirname(file), m[2])));
    if (!fileSet.has(target)) {
      errors.push(`${file}: 说明符 ${m[2]} 解析不到 src/ 内的文件`);
      continue;
    }
    out.push(target);
  }
  return out;
}

for (const file of files) {
  const from = layerOf(file);
  if (!from) {
    errors.push(`${file}: 不在 app/domain/infrastructure/shared 四层内`);
    continue;
  }
  const text = readFileSync(join(ROOT, file), 'utf8');
  const runtime = resolveSpecs(text, file, RUNTIME_RE);
  const types = resolveSpecs(text, file, TYPE_RE);

  for (const target of [...runtime, ...types]) {
    const to = layerOf(target);
    if (to && !ALLOWED[from].includes(to)) {
      errors.push(`${file}: ${from}/ 非法依赖 ${to}/ —— ${target}`);
    }
  }
  // 自引用（注释里引用自身路径）不算环
  graph.set(file, runtime.filter((t) => t !== file));
}

// ---------- 循环依赖检测（DFS 三色标记） ----------
/** @type {Map<string,0|1|2>} */
const color = new Map();
/** @type {string[]} */
const stack = [];
const cycles = new Set();

/** @param {string} node */
function dfs(node) {
  color.set(node, 1);
  stack.push(node);
  for (const next of graph.get(node) ?? []) {
    if (!graph.has(next)) continue;
    const c = color.get(next) ?? 0;
    if (c === 1) {
      const i = stack.indexOf(next);
      cycles.add([...stack.slice(i), next].join(' -> '));
    } else if (c === 0) {
      dfs(next);
    }
  }
  stack.pop();
  color.set(node, 2);
}

for (const node of graph.keys()) if (!color.get(node)) dfs(node);
for (const c of cycles) errors.push(`循环依赖: ${c}`);

// ---------- 输出 ----------
if (JSON_OUT) {
  console.log(JSON.stringify({ files: files.length, errors, cycles: [...cycles] }, null, 2));
} else {
  const counts = Object.fromEntries(LAYERS.map((l) => [l, files.filter((f) => layerOf(f) === l).length]));
  console.log(`扫描 ${files.length} 个文件：` + LAYERS.map((l) => `${l}=${counts[l]}`).join('  '));
  if (errors.length) {
    console.error(`\n✗ ${errors.length} 处违规：`);
    for (const e of errors) console.error('  ' + e);
  } else {
    console.log('✓ 分层约束与循环依赖检查通过。');
  }
}

process.exit(errors.length ? 1 : 0);
