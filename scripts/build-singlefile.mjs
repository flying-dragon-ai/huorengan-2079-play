#!/usr/bin/env node
/**
 * 把标准版游戏打成可离线双击的单文件 HTML：`dist/活人感2079.html`。
 *
 * 复刻原 `tools/build_portable.py` 的行为：
 *  - esbuild 打包 `src/main.js`，alias three / three/addons 指向 vendored r187
 *  - **只用 `--minify-whitespace --minify-syntax`，禁用标识符重命名**：
 *    在 vendor/three 的体积下 esbuild 的 identifier mangling 会卡死（历史根因）
 *  - 转义 `</script`，避免内联脚本提前闭合
 *  - 音频与 GIF 以 base64 内嵌；`data-models="procedural"` 让运行时走代码画模型
 *  - 原子写：先写临时文件再 rename
 */
import { build } from 'esbuild';
import { readFile, writeFile, rename, mkdir, readdir, stat, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const TARGET = join(ROOT, 'dist', '活人感2079.html');
const ENTRY = join(ROOT, 'src', 'main.js');
const HTML = join(ROOT, 'index.html');
const AUDIO_DIR = join(ROOT, 'assets', 'audio');
const GIF = join(ROOT, 'assets', 'img', 'naiwa-belly-laugh.gif');
const CREDITS = join(ROOT, 'assets', '来源.md');

/** @param {string} file */
const b64 = async (file) => (await readFile(file)).toString('base64');

/**
 * @param {string} entry
 * @param {string} absWorkingDir
 */
async function bundle(entry, absWorkingDir) {
  const result = await build({
    entryPoints: [entry],
    absWorkingDir,
    bundle: true,
    write: false,
    format: 'esm',
    charset: 'utf8',
    target: 'es2022',
    legalComments: 'inline',
    // 注意：不要打开 minifyIdentifiers。见文件头注释。
    minifyWhitespace: true,
    minifySyntax: true,
    minifyIdentifiers: false,
    alias: {
      'three/addons': join(ROOT, 'vendor', 'three', 'addons'),
      three: join(ROOT, 'vendor', 'three', 'three.module.js'),
    },
    logLevel: 'warning',
  });
  return result.outputFiles[0].text;
}

/** 原子写：同目录临时文件 + rename。 @param {string} target @param {string} text */
async function atomicWrite(target, text) {
  await mkdir(join(target, '..'), { recursive: true });
  const tmp = target + '.tmp-' + process.pid;
  await writeFile(tmp, text, 'utf8');
  try {
    await rename(tmp, target);
  } catch (err) {
    await unlink(tmp).catch(() => {});
    throw err;
  }
}

async function main() {
  const started = Date.now();
  let code = await bundle(ENTRY, ROOT);
  code = code.replace(/<\/script/gi, '<\/script');

  let html = await readFile(HTML, 'utf8');
  html = html.replace('<html lang="zh-CN">', '<html lang="zh-CN" data-models="procedural">');
  html = html.replace(/<script type="importmap">[\s\S]*?<\/script>/, '');

  // GIF 内嵌
  html = html.replace('./assets/img/' + 'naiwa-belly-laugh.gif', 'data:image/gif;base64,' + (await b64(GIF)));

  // 音效库
  /** @type {Record<string,string>} */
  const sound = {};
  for (const name of (await readdir(AUDIO_DIR)).sort()) {
    if (!/\.(wav|mp3)$/i.test(name)) continue;
    sound[name] = await b64(join(AUDIO_DIR, name));
  }
  const bank = '<script id="sound-bank" type="application/json">' + JSON.stringify(sound) + '</script>';

  // 素材权利说明以注释形式保留
  const credits = (await readFile(CREDITS, 'utf8')).replace(/-->/g, '');
  const inject =
    '<!-- 原项目素材记录\n' + credits + '\n-->\n' + bank + '\n<script type="module">\n' + code + '\n</script>';

  const marker = /<script type="module" src="\.\/(?:src|app)\/main\.js"><\/script>/;
  if (!marker.test(html)) {
    throw new Error('index.html 里找不到入口标记：' + marker);
  }
  html = html.replace(marker, inject);

  await atomicWrite(TARGET, html);
  const size = (await stat(TARGET)).size;
  console.log(`${TARGET} (${size.toLocaleString('en-US')} bytes, ${Date.now() - started} ms)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
