#!/usr/bin/env node
/**
 * 把观景版（`src/viewer/`）打成单文件 HTML：`dist/地球村-自由浏览.html`。
 *
 * 复刻原 `browser/build.py`：Three.js 内嵌，不引用任何外部资源。
 * 与标准版一致，禁用标识符重命名（见 build-singlefile.mjs 注释）。
 */
import { build } from 'esbuild';
import { readFile, writeFile, rename, mkdir, stat, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const TARGET = join(ROOT, 'dist', '地球村-自由浏览.html');
const ENTRY = join(ROOT, 'src', 'viewer', 'main.js');
const HTML = join(ROOT, 'viewer.html');
const MARKER = /<script type="module" src="\.\/(?:src|app)\/viewer\/main\.js"><\/script>/;

/** @param {string} target @param {string} text */
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
  const result = await build({
    entryPoints: [ENTRY],
    absWorkingDir: ROOT,
    bundle: true,
    write: false,
    format: 'esm',
    charset: 'utf8',
    target: 'es2022',
    legalComments: 'inline',
    minifyWhitespace: true,
    minifySyntax: true,
    minifyIdentifiers: false,
    alias: {
      'three/addons': join(ROOT, 'vendor', 'three', 'addons'),
      three: join(ROOT, 'vendor', 'three', 'three.module.js'),
    },
    logLevel: 'warning',
  });
  const code = result.outputFiles[0].text.replace(/<\/script/gi, '<\/script');

  let html = await readFile(HTML, 'utf8');
  html = html.replace(/<script type="importmap">[\s\S]*?<\/script>/, '');
  if (!MARKER.test(html)) throw new Error('viewer.html 里找不到入口标记：' + MARKER);
  html = html.replace(MARKER, '<script type="module">\n' + code + '\n</script>');

  await atomicWrite(TARGET, html);
  const size = (await stat(TARGET)).size;
  console.log(`${TARGET} (${size.toLocaleString('en-US')} bytes, ${Date.now() - started} ms)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
