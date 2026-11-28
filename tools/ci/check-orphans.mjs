#!/usr/bin/env node
/**
 * 孤儿检测（零依赖，CI 门禁）。
 *
 * 做两件事：
 *  1. **JS 可达性**：从 HTML 入口（`<script type="module" src>`）出发做 DFS，
 *     找出没有任何 import 路径能到达的 `src/` 文件。
 *  2. **资产引用**：把 `src/` 里出现的文件名 / MODEL_CONF 的 file 字段 /
 *     `assets/models/gen/manifest.json` 的登记项汇总，找出从未被引用的资产。
 *
 * 已知的合法例外（资产管线中间产物等）写在 `tools/ci/orphans.baseline.json`，
 * 命中基线的条目不报错。新增孤儿会失败，逼你二选一：删掉，或显式加进基线。
 *
 * 用法：
 *   node tools/ci/check-orphans.mjs
 *   node tools/ci/check-orphans.mjs --json
 *   node tools/ci/check-orphans.mjs --update-baseline   # 把当前结果写成新基线
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, normalize, relative, sep, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const BASELINE = join(ROOT, 'tools/ci/orphans.baseline.json');
const JSON_OUT = process.argv.includes('--json');
const UPDATE = process.argv.includes('--update-baseline');
const posix = (p) => p.split(sep).join('/');
const rel = (p) => posix(relative(ROOT, p));

/**
 * 递归收集文件（跳过 node_modules / .git）。
 * 过滤器收到的是**相对仓库根的 posix 路径**，不是绝对路径：
 * 绝对路径在 Linux 上永远含 '/'，会让「只要根目录的 HTML」这类判断恒为假
 * （之前传绝对路径，CI 上一个 HTML 入口都找不到，63 个 JS 全被判孤儿）。
 */
function walk(dir, filter = () => true) {
  const out = [];
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return out;
  (function rec(d) {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === '.git') continue;
        rec(p);
      } else if (filter(rel(p))) out.push(rel(p));
    }
  })(abs);
  return out;
}

// ---------- 1. JS 可达性 ----------
const jsFiles = walk('src', (p) => p.endsWith('.js'));
const jsSet = new Set(jsFiles);
const SPEC = /\b(?:from\s+|import\s*\(\s*)(['"])(\.\.?\/[^'"]+)\1/g;

/** @type {Map<string,string[]>} */
const graph = new Map();
for (const f of jsFiles) {
  const text = readFileSync(join(ROOT, f), 'utf8');
  /** @type {string[]} */
  const deps = [];
  let m;
  SPEC.lastIndex = 0;
  while ((m = SPEC.exec(text))) {
    const t = posix(normalize(join(dirname(f), m[2])));
    if (jsSet.has(t)) deps.push(t);
  }
  graph.set(f, deps);
}

/** 从 HTML 抓入口。 */
const entries = [];
for (const html of walk('.', (p) => p.endsWith('.html') && !p.includes('/'))) {
  const text = readFileSync(join(ROOT, html), 'utf8');
  const re = /<script[^>]+type="module"[^>]+src="([^"]+)"/g;
  let m;
  while ((m = re.exec(text))) {
    const p = posix(normalize(m[1].replace(/^\.\//, '')));
    if (jsSet.has(p)) entries.push(p);
  }
}

const reachable = new Set();
/** @param {string} n */
function dfs(n) {
  if (reachable.has(n)) return;
  reachable.add(n);
  for (const d of graph.get(n) ?? []) dfs(d);
}
for (const e of entries) dfs(e);

const orphanJs = jsFiles.filter((f) => !reachable.has(f)).sort();

// ---------- 2. 资产引用 ----------
// 引用来源：src/ 全部 JS + 根目录 HTML（HTML 里也有 <img src> 和 importmap）
const htmlFiles = walk('.', (p) => p.endsWith('.html') && !p.includes('/'));
const srcText = [...jsFiles, ...htmlFiles].map((f) => readFileSync(join(ROOT, f), 'utf8')).join('\n');

// 只审计「属于仓库」的资产：tracked + untracked-but-not-ignored。
// gitignored 的（如 assets/models/source/ 的本地存档、管线中间产物）不参与审计。
const repoFiles = new Set(
  execFileSync('git', ['ls-files', '-co', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .map(posix),
);
const assetFiles = walk('assets', (p) => !p.endsWith('.md')).filter((f) => repoFiles.has(f));

// 模型：直接 import MODEL_CONF 做精确解析。
// 关键——模型「名字」不等于「文件名」：getModel('naiwa') 经 MODEL_CONF 解析到
// file:'naiwa_animated'，实际加载的是 naiwa_animated.glb，不是 naiwa.glb。
// 用字符串匹配会把 naiwa.glb 误判成"在用"（'naiwa' 是 'naiwa_animated' 的前缀）。
const { MODEL_CONF } = await import(
  pathToFileURL(join(ROOT, 'src/data/model-registry.js')).href
);
/** MODEL_CONF 里真正会被加载的模型文件名（不含 .glb）。 */
const loadedModelStems = new Set(
  Object.entries(MODEL_CONF).map(([key, conf]) => conf.file || key),
);

const used = new Set();
for (const f of assetFiles) {
  const name = basename(f);
  const stem = name.replace(/\.[^.]+$/, '');
  const sub = posix(dirname(f)).replace(/^assets\//, '');

  if (name.endsWith('.glb')) {
    // 模型：只认 MODEL_CONF 解析结果（gen/ 与 memes/ 用相对路径登记）
    if (loadedModelStems.has(stem) || loadedModelStems.has(`${sub.replace(/^models\//, '')}/${stem}`)) {
      used.add(f);
    }
  } else if (srcText.includes(name) || srcText.includes(`${sub}/${name}`)) {
    // 音频 / 图片 / manifest.json：按字面文件名或相对路径在 src + HTML 里找
    used.add(f);
  }
}

// manifest.json 登记的 gen 模型
const manifestPath = join(ROOT, 'assets/models/gen/manifest.json');
if (existsSync(manifestPath)) {
  const man = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const items = Array.isArray(man) ? man : man.gen || man.items || man.models || man.assets || [];
  for (const it of items) {
    const f = typeof it === 'string' ? it : it.file || it.path || it.glb || it.url;
    if (!f) continue;
    const p = posix(normalize(join('assets/models/gen', basename(String(f)))));
    if (assetFiles.includes(p)) used.add(p);
  }
}

const orphanAssets = assetFiles.filter((f) => !used.has(f)).sort();

// ---------- 3. 基线比对 ----------
/** @type {{js: string[], assets: string[]}} */
const baseline = existsSync(BASELINE)
  ? JSON.parse(readFileSync(BASELINE, 'utf8'))
  : { js: [], assets: [] };

if (UPDATE) {
  writeFileSync(BASELINE, JSON.stringify({ js: orphanJs, assets: orphanAssets }, null, 2) + '\n', 'utf8');
  console.log(`基线已更新：${BASELINE}`);
  console.log(`  js=${orphanJs.length}  assets=${orphanAssets.length}`);
  process.exit(0);
}

const knownJs = new Set(baseline.js ?? []);
const knownAssets = new Set(baseline.assets ?? []);
const newJs = orphanJs.filter((f) => !knownJs.has(f));
const newAssets = orphanAssets.filter((f) => !knownAssets.has(f));
const staleJs = [...knownJs].filter((f) => !orphanJs.includes(f));
const staleAssets = [...knownAssets].filter((f) => !orphanAssets.includes(f));

// ---------- 输出 ----------
const problems = newJs.length + newAssets.length;
if (JSON_OUT) {
  console.log(JSON.stringify({ entries, orphanJs, orphanAssets, newJs, newAssets, staleJs, staleAssets }, null, 2));
} else {
  console.log(`入口：${entries.join(', ') || '(none)'}`);
  console.log(`扫描 ${jsFiles.length} 个 JS、${assetFiles.length} 个资产。`);
  console.log(`孤儿 JS ${orphanJs.length}（基线内 ${orphanJs.length - newJs.length}）`);
  console.log(`未引用资产 ${orphanAssets.length}（基线内 ${orphanAssets.length - newAssets.length}）`);
  if (newJs.length) {
    console.error(`\n✗ 新增孤儿 JS ${newJs.length} 个：`);
    for (const f of newJs) console.error('  ' + f);
  }
  if (newAssets.length) {
    console.error(`\n✗ 新增未引用资产 ${newAssets.length} 个：`);
    for (const f of newAssets) console.error('  ' + f);
  }
  if (staleJs.length || staleAssets.length) {
    console.log(`\n提示：基线里有 ${staleJs.length + staleAssets.length} 条已失效（文件已删或已被引用），可以清理：`);
    for (const f of [...staleJs, ...staleAssets]) console.log('  ' + f);
  }
  if (!problems) console.log('\n✓ 没有新增孤儿。');
}

process.exit(problems ? 1 : 0);
