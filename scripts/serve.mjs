#!/usr/bin/env node
/**
 * 零依赖跨平台静态服务。
 *
 * 替代 `python tools/serve.py`：clone 之后只需要 Node 就能跑游戏。
 * 默认 127.0.0.1:2079，全部响应 no-cache，避免改代码后浏览器吃旧缓存。
 *
 * 用法：
 *   node scripts/serve.mjs
 *   node scripts/serve.mjs --port 3000
 *   SERVE_PORT=3000 SERVE_HOST=0.0.0.0 node scripts/serve.mjs
 */
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const HOST = process.env.SERVE_HOST || '127.0.0.1';
// 端口优先级：--port N > SERVE_PORT > 2079。
// 刻意不读通用的 PORT 环境变量：本机 pi-web 全局设了 PORT=30141，
// 读它会让游戏服务抢到别的进程的端口上。
const argPort = (() => {
  const i = process.argv.indexOf('--port');
  return i !== -1 ? process.argv[i + 1] : null;
})();
const PORT = Number(argPort || process.env.SERVE_PORT || 2079);

/** @type {Record<string,string>} */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.pdf': 'application/pdf',
  '.wasm': 'application/wasm',
};

const NO_CACHE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};

/**
 * 把 URL 路径解析成磁盘路径，越界返回 null。
 * @param {string} urlPath
 * @returns {string|null}
 */
function toDiskPath(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  const full = resolve(join(ROOT, decoded));
  if (full !== ROOT && !full.startsWith(ROOT + sep)) return null;
  return full;
}

/**
 * @param {import('node:http').ServerResponse} res
 * @param {number} code
 * @param {string} body
 */
function sendText(res, code, body) {
  res.writeHead(code, { ...NO_CACHE, 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(body);
}

const server = createServer(async (req, res) => {
  const rawUrl = req.url || '/';
  const q = rawUrl.indexOf('?');
  const urlPath = q === -1 ? rawUrl : rawUrl.slice(0, q);

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendText(res, 405, 'Method Not Allowed');
    return;
  }

  let disk = toDiskPath(urlPath === '/' ? '/index.html' : urlPath);
  if (!disk) {
    sendText(res, 403, 'Forbidden');
    return;
  }

  let info = await stat(disk).catch(() => null);
  if (info && info.isDirectory()) {
    disk = join(disk, 'index.html');
    info = await stat(disk).catch(() => null);
  }
  if (!info || !info.isFile()) {
    sendText(res, 404, 'Not Found: ' + urlPath);
    return;
  }

  const type = MIME[extname(disk).toLowerCase()] || 'application/octet-stream';
  res.writeHead(200, {
    ...NO_CACHE,
    'Content-Type': type,
    'Content-Length': String(info.size),
    'Accept-Ranges': 'none',
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  const stream = createReadStream(disk);
  stream.on('error', () => res.destroy());
  stream.pipe(res);
});

server.on('error', (err) => {
  if (/** @type {any} */ (err).code === 'EADDRINUSE') {
    console.error(`端口 ${PORT} 已被占用。换一个：node scripts/serve.mjs --port 2080`);
  } else {
    console.error(err);
  }
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`活人感 2079 —— http://${HOST}:${PORT}/index.html`);
  console.log(`自动演示 —— http://${HOST}:${PORT}/index.html?auto=1`);
  console.log(`开发跳关 —— http://${HOST}:${PORT}/index.html?dev=1`);
  console.log(`观景版   —— http://${HOST}:${PORT}/viewer.html`);
  console.log('Ctrl+C 停止。');
});
