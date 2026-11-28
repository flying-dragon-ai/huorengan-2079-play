#!/usr/bin/env node
/**
 * 把本仓的发布物同步到公开试玩仓 `flying-dragon-ai/huorengan-2079-play`（GitHub Pages）。
 *
 * 目标仓结构（Pages 源分支 = main，路径 /）：
 *   index.html                   ← dist/活人感2079.html        标准版单文件（模型代码生成、音频内联）
 *   earth-village-viewer.html    ← dist/地球村-自由浏览.html   观景版单文件
 *   full/                        ← 本仓未打包的开发树：index.html + src/ + vendor/ + assets/
 *                                  真实 GLB 模型版，/full/ 入口
 *   README.md                    每次重写（带构建溯源）
 *   .nojekyll
 *
 * 用法：
 *   node scripts/sync-play.mjs                # 真跑：同步 + 提交 + 推送
 *   node scripts/sync-play.mjs --dry-run      # 只改工作副本并列出差异，不提交不推送
 *   node scripts/sync-play.mjs --no-full      # 只同步两份单文件，不动 full/
 *   node scripts/sync-play.mjs --no-source    # 不镜像源码快照分支（source-code）
 *   node scripts/sync-play.mjs --allow-dirty  # 放行带未提交改动的工作区（默认拒绝，见下）
 *
 * 环境变量：
 *   PLAY_REPO_TOKEN   推送用的令牌（CI 由 secret 注入）。缺省时退回本机 git 凭据。
 *   PLAY_REPO         目标仓（默认 flying-dragon-ai/huorengan-2079-play）
 *   PLAY_BRANCH       目标分支（默认 main）
 *   GITHUB_SHA        写入提交信息与 README 的构建溯源
 *
 * 为什么 full/ 要整棵镜像：它没打包，浏览器直接加载 `./src/main.js` + importmap 指向
 * `./vendor/three/`，所以 src/ vendor/ assets/ 三者必须与 index.html 同一版本，
 * 任何一部分落后都会在运行时炸在加载阶段。因此每次全量 rm -rf 后重铺，不留增量残留。
 */
import { execFileSync } from 'node:child_process';
import { writeFile, readFile, mkdir, rm, stat, cp, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const REPO = process.env.PLAY_REPO || 'flying-dragon-ai/huorengan-2079-play';
const BRANCH = process.env.PLAY_BRANCH || 'main';
// 源码快照分支：与 Pages 源分支分开，产物和源码不混在一条线上
const MIRROR = process.env.PLAY_SOURCE_BRANCH || 'source-code';
const WORK = join(ROOT, '.cache', 'play-repo');
const SHA = process.env.GITHUB_SHA || tryGit(['rev-parse', '--short', 'HEAD']) || 'local';
const STAMP = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const syncFull = !argv.includes('--no-full');
const syncSource = !argv.includes('--no-source');
// 默认只发布已提交的内容：本地跑时常带着没跑分的实验，直接拷过去就是把半成品发上公网
const allowDirty = argv.includes('--allow-dirty');

/** full/ 镜像的源——只放运行时真的会请求的东西 */
const FULL_TREES = [
  { from: 'src', to: 'full/src' },
  { from: 'vendor', to: 'full/vendor' },
  { from: 'assets/audio', to: 'full/assets/audio' },
  { from: 'assets/img', to: 'full/assets/img' },
  { from: 'assets/models', to: 'full/assets/models', skip: ['source'] },
];

const ARTIFACTS = [
  { from: 'dist/活人感2079.html', to: 'index.html', label: '标准版单文件' },
  { from: 'dist/地球村-自由浏览.html', to: 'earth-village-viewer.html', label: '观景版单文件' },
];

/**
 * 跑一条 git 命令。
 * @param {string[]} args 参数
 * @param {{ cwd?: string, env?: NodeJS.ProcessEnv, quiet?: boolean }} [opts] 选项
 * @returns {string} 标准输出（已去尾部空白）
 */
function tryGit(args, opts = {}) {
  try {
    const stdio = opts.quiet ? 'pipe' : ['ignore', 'pipe', 'pipe'];
    return execFileSync('git', args, {
      cwd: opts.cwd || ROOT,
      encoding: 'utf8',
      stdio,
      env: { ...process.env, ...opts.env },
    }).trim();
  } catch (e) {
    if (opts.quiet) return '';
    const detail = (e.stderr || e.stdout || '').toString().trim() || e.message;
    console.error('✗ git ' + args.join(' ') + '\n' + detail);
    process.exit(1);
  }
}

/**
 * 推送令牌走 GIT_CONFIG_* 进内存，不写进远端 URL，也不落到 .git/config。
 * @param {string} token 令牌
 * @param {Array<[string, string]>} [extra] 额外 git 配置（等价 -c key=value）
 * @returns {NodeJS.ProcessEnv} 追加给 git 的环境
 */
function gitEnv(token, extra = []) {
  // core.autocrlf：Git for Windows 的系统级配置默认是 true，克隆出来的工作区是 CRLF，
  // 而本仓提交的是 LF —— 不掐掉的话每次同步都先刷出几百条「行尾不一致」，
  // 再被 add 归一回原样，白白把真差异埋在噪音里。
  const pairs = [
    ['core.autocrlf', 'false'],
    ['core.eol', 'lf'],
  ];
  if (token) {
    // 令牌走 `-c` 等价的环境条目进内存：不写远端 URL，也不落 .git/config
    const basic = Buffer.from('x-access-token:' + token).toString('base64');
    pairs.push(['http.https://github.com/.extraheader', 'AUTHORIZATION: basic ' + basic]);
  }
  // 附加条目：镜像源码分支时要临时掐掉 LFS 过滤（见 mirrorSource）
  for (const pair of extra) pairs.push(pair);
  const env = { GIT_CONFIG_COUNT: String(pairs.length) };
  pairs.forEach(([k, v], i) => {
    env['GIT_CONFIG_KEY_' + i] = k;
    env['GIT_CONFIG_VALUE_' + i] = v;
  });
  return env;
}

/**
 * 递归复制目录，保持相对结构。
 * @param {string} from 源目录（相对 ROOT）
 * @param {string} to 目标目录（相对工作副本）
 * @param {string[]} skip 跳过的顶层子项
 * @returns {Promise<number>} 复制文件数
 */
async function copyTree(from, to, skip = []) {
  await cp(join(ROOT, from), join(WORK, to), {
    recursive: true,
    filter: (src) => {
      const rel = src
        .slice(join(ROOT, from).length + 1)
        .split('\\')
        .join('/');
      return !skip.some((s) => rel === s || rel.startsWith(s + '/'));
    },
  });
  return countFiles(join(WORK, to));
}

/**
 * 数一个目录下的文件数。
 * @param {string} dir 目录
 * @returns {Promise<number>} 文件数
 */
async function countFiles(dir) {
  let n = 0;
  for (const e of await readdir(dir, { withFileTypes: true })) {
    n += e.isDirectory() ? await countFiles(join(dir, e.name)) : 1;
  }
  return n;
}

/**
 * 取文件大小（字节）。
 * @param {string} file 路径
 * @returns {Promise<number>} 字节数
 */
const size = async (file) => (await stat(file)).size;

/**
 * 生成目标仓 README：入口、体积、构建溯源。
 * @param {Array<{ to: string, label: string, bytes: number }>} files 单文件产物
 * @param {number} fullFiles full/ 文件数
 * @returns {string} README 正文
 */
function readme(files, fullFiles) {
  const mb = (n) => (n / 1024 / 1024).toFixed(2) + ' MB';
  const kb = (n) => Math.round(n / 1024) + ' KB';
  const human = (n) => (n >= 1024 * 1024 ? mb(n) : kb(n));
  const entry = `https://flying-dragon-ai.github.io/${REPO.split('/')[1]}/`;
  return `# 活人感 2079 重制版 · 试玩

直接打开 **[$entry](${entry})** 就能玩（单文件版，模型由代码生成、音频已内联，不需要装任何东西、不需要联网）。

${files.map((f) => `- \`${f.to}\` —— ${f.label}（约 ${human(f.bytes)}）`).join('\n')}
- \`full/\` —— 完整版：真实 GLB 模型，未打包的开发树入口（${fullFiles} 个文件）→ [${entry}full/](${entry}full/)
  - 与两份单文件同一次构建，差在模型走 \`assets/models/*.glb\` 而不是代码生成的替身
  - 直接在浏览器打开需要经 HTTP 提供（模块 + GLB 请求），Pages 上开箱可用

源码：\`source-code\` 分支 —— 整棵源码快照（src / scripts / tools / tests / docs / vendor / assets），
二进制以实体字节存放、不走 LFS，可以直接浏览或 clone 下来跑。

构建溯源：源码仓私有仓库 \`flying-dragon-ai/huorengan-2079\` 的 \`${SHA}\`，同步于 ${STAMP}。
由 \`scripts/sync-play.mjs\` 在源码仓 CI 发布流程里自动生成，**不要手改本仓**——下次发布会整份覆盖。

> 素材授权尚未逐项核实，本页面仅供试玩。
`;
}

/**
 * 本仓受版本控制的文件清单（相对路径，`/` 分隔）。
 * 只镜像 git 跟踪的文件：node_modules / dist / .cache / assets/models/source 这些
 * 本来就不在版本控制里，一个都不该进快照。
 * @returns {string[]} 文件列表
 */
function trackedFiles() {
  return execFileSync('git', ['-C', ROOT, 'ls-files', '-z'], { maxBuffer: 256 * 1024 * 1024 })
    .toString('utf8')
    .split('\0')
    .filter(Boolean);
}

/**
 * 把整棵源码镜像到 PLAY 仓的 MIRROR 分支。
 *
 * 孤立分支：Pages 只认一条源分支（main），源码快照独立成枝，互不干扰，
 * 也便于整支删除或重建。
 *
 * LFS 必须关掉：本仓 `.gitattributes` 里 `*.glb` / `*.mp3` 走 `filter=lfs`，
 * 原样 add 进去的是 130 字节指针文本，下载下来打不开。而且 git-lfs 一旦装好，
 * `filter.lfs.process` 就优先于 clean/smudge，用 `-c filter.lfs.clean=cat` 根本掐不掉
 * （CI 上实测：探针文件索引里只剩 132 字节）。这里的做法是把镜像里的 `.gitattributes`
 * 剥掉 `filter=lfs` 行，让 git 无过滤原样收字节，再用最大的文件当探针断言
 * 索引体积 == 磁盘体积——对不上就中止，不留半成品。
 * @param {string} name 提交者名
 * @param {string} email 提交者邮箱
 * @returns {Promise<void>}
 */
async function mirrorSource(name, email) {
  const has = tryGit(['ls-remote', '--heads', 'origin', MIRROR], { cwd: WORK, env }).includes(MIRROR);
  if (has) {
    // 显式 refspec：命令行只给源名时 git 只写 FETCH_HEAD，不建 origin/<分支>，
    // 浅克隆下再 checkout origin/source-code 就会报 "is not a commit"（CI 实测）
    tryGit(['fetch', '--depth', '1', 'origin', `${MIRROR}:refs/remotes/origin/${MIRROR}`], { cwd: WORK, env });
    tryGit(['checkout', '-q', '-f', '-B', MIRROR, `origin/${MIRROR}`], { cwd: WORK, env });
  } else {
    console.log(`· 新建孤立分支 ${MIRROR}`);
    tryGit(['checkout', '-q', '-f', '--orphan', MIRROR], { cwd: WORK, env });
  }

  for (const e of await readdir(WORK, { withFileTypes: true })) {
    if (e.name !== '.git') await rm(join(WORK, e.name), { recursive: true, force: true });
  }

  const files = trackedFiles();
  let copied = 0;
  let probe = { rel: '', size: 0 };
  for (const rel of files) {
    const src = join(ROOT, rel);
    if (!existsSync(src)) continue;
    const dst = join(WORK, rel);
    await mkdir(dirname(dst), { recursive: true });
    await cp(src, dst, { force: true });
    copied++;
    const bytes = await size(dst);
    if (bytes > probe.size) probe = { rel, size: bytes };
  }
  // 剥掉 LFS 过滤：见函数头注释，process 过滤优先，只能从属性层面掐
  const gaPath = join(WORK, '.gitattributes');
  if (existsSync(gaPath)) {
    const kept = (await readFile(gaPath, 'utf8'))
      .split('\n')
      .filter((line) => !line.includes('filter=lfs'))
      .join('\n');
    const note = '# 本分支由 scripts/sync-play.mjs 自动镜像，不启用 Git LFS：二进制以实体字节存放。\n';
    await writeFile(gaPath, note + kept, 'utf8');
  }

  console.log(`· ${MIRROR}  ${copied} 个文件（最大 ${probe.rel} ${probe.size} bytes）`);

  tryGit(['add', '-A'], { cwd: WORK, env });
  if (probe.rel) {
    const staged = Number(tryGit(['cat-file', '-s', `:${probe.rel}`], { cwd: WORK, env }) || 0);
    if (staged !== probe.size) {
      console.error(`✗ LFS 过滤没掐干净：${probe.rel} 索引 ${staged} bytes ≠ 磁盘 ${probe.size} bytes，已中止`);
      process.exit(3);
    }
  }
  if (!tryGit(['status', '--porcelain'], { cwd: WORK, env })) {
    console.log(`· ${MIRROR} 无变化`);
    return;
  }
  tryGit(
    [
      '-c',
      `user.name=${name}`,
      '-c',
      `user.email=${email}`,
      'commit',
      '-q',
      '-m',
      `source: 同步源码仓 ${SHA}（${STAMP}）`,
      '-m',
      '整棵源码快照：src / scripts / tools / tests / docs / vendor / assets（不含 assets/models/source）。由 scripts/sync-play.mjs 自动镜像，勿手改。本分支不启用 LFS，二进制以实体字节存放。',
    ],
    { cwd: WORK, env }
  );
  tryGit(['push', 'origin', `HEAD:${MIRROR}`], { cwd: WORK, env });
  console.log(`· 已推送 ${REPO}#${MIRROR}`);
}

// ── 主流程 ────────────────────────────────────────────────────────────────
if (!allowDirty) {
  const wt = tryGit(['status', '--porcelain'], { quiet: true });
  if (wt) {
    const shown = wt
      .split('\n')
      .slice(0, 10)
      .map((l) => '  ' + l)
      .join('\n');
    console.error(
      '✗ 源码仓工作区有未提交改动，拒绝发布（会连带把半成品推上公网）：\n' +
        shown +
        '\n  先提交或 git stash，确属有意放行再加 --allow-dirty'
    );
    process.exit(4);
  }
}
for (const a of ARTIFACTS) {
  if (!existsSync(join(ROOT, a.from))) {
    console.error(`缺少构建产物 ${a.from} —— 先跑 npm run build && npm run build:viewer`);
    process.exit(2);
  }
}

await mkdir(dirname(WORK), { recursive: true });
const token = process.env.PLAY_REPO_TOKEN || '';
const env = gitEnv(token);
const url = `https://github.com/${REPO}.git`;

if (!existsSync(join(WORK, '.git'))) {
  console.log(`· 克隆 ${REPO} → .cache/play-repo`);
  await rm(WORK, { recursive: true, force: true });
  execFileSync('git', ['clone', '--depth', '1', '--branch', BRANCH, url, WORK], {
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
} else {
  console.log(`· 复用工作副本，拉取 ${BRANCH} 最新`);
  execFileSync('git', ['fetch', '--depth', '1', 'origin', BRANCH], {
    cwd: WORK,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  // 用 checkout -B 而不是 reset --hard：工作区可能停在别的分支（镜像源码后就是），
  // reset --hard 会把那条分支一起拽过来
  execFileSync('git', ['checkout', '-q', '-f', '-B', BRANCH, `origin/${BRANCH}`], {
    cwd: WORK,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
}

const published = [];
for (const a of ARTIFACTS) {
  await cp(join(ROOT, a.from), join(WORK, a.to));
  const bytes = await size(join(WORK, a.to));
  published.push({ ...a, bytes });
  console.log(`· ${a.to}  ${bytes} bytes  ← ${a.from}`);
}

let fullFiles = 0;
if (syncFull) {
  await rm(join(WORK, 'full'), { recursive: true, force: true });
  await mkdir(join(WORK, 'full'), { recursive: true });
  await cp(join(ROOT, 'index.html'), join(WORK, 'full/index.html'));
  for (const t of FULL_TREES) fullFiles += await copyTree(t.from, t.to, t.skip || []);
  fullFiles += 1;
  console.log(`· full/  ${fullFiles} 个文件（index.html + src + vendor + assets）`);
} else {
  fullFiles = existsSync(join(WORK, 'full')) ? await countFiles(join(WORK, 'full')) : 0;
  console.log('· full/  跳过（--no-full）');
}

await writeFile(join(WORK, 'README.md'), readme(published, fullFiles), 'utf8');
await writeFile(join(WORK, '.nojekyll'), '', 'utf8');

const dirty = tryGit(['status', '--porcelain'], { cwd: WORK, env });
if (!dirty) console.log('· main 无改动（产物与上次一致）');
if (dirty)
  console.log(
    '· 变更：\n' +
      dirty
        .split('\n')
        .slice(0, 20)
        .map((l) => '  ' + l)
        .join('\n') +
      (dirty.split('\n').length > 20 ? `\n  …共 ${dirty.split('\n').length} 项` : '')
  );

if (dryRun) {
  console.log(`· --dry-run：未提交、未推送（提交信息会是 "build: 同步源码仓 ${SHA}"）`);
  tryGit(['add', '-A'], { cwd: WORK, env });
  console.log(tryGit(['diff', '--cached', '--stat'], { cwd: WORK, env }) || '  （无差异）');
  if (syncSource) console.log(`· --dry-run：接下来会把 ${trackedFiles().length} 个受控文件镜像到 ${MIRROR} 分支`);
  process.exit(0);
}

const name = process.env.GIT_AUTHOR_NAME || 'huorengan-bot';
const email = process.env.GIT_AUTHOR_EMAIL || 'bot@users.noreply.github.com';
if (dirty) {
  tryGit(['add', '-A'], { cwd: WORK, env });
  tryGit(
    [
      '-c',
      `user.name=${name}`,
      '-c',
      `user.email=${email}`,
      'commit',
      '-q',
      '-m',
      `build: 同步源码仓 ${SHA}（${STAMP}）`,
    ],
    { cwd: WORK, env }
  );
  tryGit(['push', 'origin', `HEAD:${BRANCH}`], { cwd: WORK, env });
  console.log(`· 已推送 ${REPO}#${BRANCH}`);
}
if (syncSource) await mirrorSource(name, email);
