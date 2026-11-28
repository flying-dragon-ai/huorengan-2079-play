// 无头 Chrome 试玩小工具（不用装任何包，Node 22+ 自带 WebSocket）
// 用法：import { open } from './cdp.mjs'; const b = await open(url); await b.key('KeyW','down'); await b.shot('a.jpg'); b.close();
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, sep } from 'node:path';
// Chrome 路径：CHROME_PATH 优先 → 平台常见绝对路径 → 扫 PATH。
// 必须认 Linux：GitHub Actions 的 browser-actions/setup-chrome 把 Chrome 装到
// /opt/hostedtoolcache/setup-chrome/chromium/stable/x64/chrome 并加进 PATH；
// 之前只有 Mac/Windows 的绝对路径，CI 上必然报「找不到 Chrome」。
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  // macOS
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  // Windows
  process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  // Linux
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/opt/hostedtoolcache/setup-chrome/chromium/stable/x64/chrome',
].filter(Boolean);

// 扫 PATH：CI 里 Chrome 通常以 google-chrome / chromium 出现在某个 PATH 目录下
for (const dir of (process.env.PATH || '').split(sep)) {
  if (!dir) continue;
  for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'chrome']) {
    CHROME_CANDIDATES.push(join(dir, name));
  }
}

const CHROME = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!CHROME) throw new Error('找不到 Chrome：设置 CHROME_PATH 指向 chrome 可执行文件');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const KEYS = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', KeyE: 'e', KeyQ: 'q', KeyR: 'r', KeyH: 'h', KeyM: 'm', KeyP: 'p', KeyT: 't', Space: ' ', Digit2: '2', ShiftLeft: 'Shift', Escape: 'Escape', Enter: 'Enter' };
const VK = { KeyW: 87, KeyA: 65, KeyS: 83, KeyD: 68, KeyE: 69, KeyQ: 81, KeyR: 82, KeyH: 72, KeyM: 77, KeyP: 80, KeyT: 84, Space: 32, Digit2: 50, ShiftLeft: 16, Escape: 27, Enter: 13 };

/**
 * `open()` 的可选参数。
 * @typedef {object} OpenOptions
 * @property {number} [port=9340] 远程调试端口。同一端口不能并发复用；profile 目录按端口区分。
 * @property {number} [w=1280] 窗口宽（CSS 像素）。
 * @property {number} [h=720] 窗口高（CSS 像素）。
 * @property {string} [profile] Chrome 的 user-data-dir，默认 `os.tmpdir()/hrg-cdp-<port>`。
 */

/**
 * `open()` 返回的浏览器句柄。
 * @typedef {object} Browser
 * @property {string[]} logs 累积日志：console 调用、未捕获异常、Log.entryAdded 的 error/warning。
 * @property {(method: string, params?: Record<string, unknown>) => Promise<any>} call 直接发一条 CDP 命令，返回 `result`。
 * @property {(ms: number) => Promise<void>} sleep 等待若干毫秒。
 * @property {(expr: string) => Promise<any>} js 在页面里求值并按值取回；求值抛错时记入 logs 并返回 `undefined`。
 * @property {(expr: string, ms?: number, every?: number) => Promise<boolean>} until 轮询表达式直到为真；超时返回 `false`。
 * @property {(x: number, y: number) => Promise<void>} click 在视口坐标处点一下左键。
 * @property {(code: string, kind?: 'down'|'up'|'press') => Promise<void>} key 派发按键，`code` 取 `KeyW` / `Space` / `Escape` 等。
 * @property {(code: string, ms: number) => Promise<void>} hold 按住某键若干毫秒后松开。
 * @property {(file: string) => Promise<string>} shot 截 JPEG（质量 78），自动建父目录，返回文件路径。
 * @property {() => string[]} errors 只取 `[EXC]` / `[EVAL-EXC]` / `[error]` 三类日志。
 * @property {() => void} close 关闭 WebSocket 并杀掉 Chrome 进程。
 */

/**
 * 拉起 headless Chrome，连上第一个 page target，导航到 `url`，返回操作句柄。
 * @param {string} url 首个导航地址。
 * @param {OpenOptions} [options] 端口、窗口尺寸、profile 目录。
 * @returns {Promise<Browser>} 浏览器句柄；用完必须 `close()`，否则 Chrome 进程会残留。
 */
export async function open(url, { port = 9340, w = 1280, h = 720, profile = join(tmpdir(), 'hrg-cdp-' + port) } = {}) {
  mkdirSync(profile, { recursive: true });
  const software = process.env.CDP_SOFTWARE === '1';
  const isLinux = process.platform === 'linux';
  // Linux（CI runner）没有 GPU，一律走 SwiftShader 软渲染；/dev/shm 太小还要关掉。
  const angle = software
    ? ['--use-angle=swiftshader']
    : { darwin: ['--use-angle=metal'], win32: ['--use-angle=d3d11'], linux: ['--use-angle=swiftshader'] }[process.platform] || [];
  const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, `--window-size=${w},${h}`,
    '--no-sandbox', ...(isLinux ? ['--disable-dev-shm-usage'] : []), ...angle, '--enable-gpu', '--ignore-gpu-blocklist', '--mute-audio', '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  let tabs;
  // 抓 Chrome 的 stderr：它启动失败时（比如 CI 上缺共享库）会把原因写在这里，
  // 之前 stdio:'ignore' 全吞了，只剩一句没头没脑的「连不上」。
  let chromeErr = '';
  proc.stderr?.on('data', (d) => { chromeErr += d.toString(); });
  let exited = null;
  proc.on('exit', (code, sig) => { exited = `Chrome 已退出（code=${code} signal=${sig}）`; });
  for (let i = 0; i < 150; i++) {
    if (exited) break;
    try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (tabs.some((t) => t.type === 'page')) break; } catch {} await sleep(150);
  }
  const page = tabs && tabs.find((t) => t.type === 'page');
  if (!page) {
    proc.kill();
    throw new Error(`连不上 Chrome DevTools（${exited || '超时'}）。Chrome 输出：\n${chromeErr.slice(-2000) || '(无 stderr)'}`);
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const wait = new Map(); const logs = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); return; }
    if (m.method === 'Runtime.consoleAPICalled') { const a = m.params; logs.push(`[${a.type}] ` + a.args.map((x) => x.value ?? x.description ?? '').join(' ')); }
    else if (m.method === 'Runtime.exceptionThrown') { const d = m.params.exceptionDetails; logs.push('[EXC] ' + (d.exception?.description || d.text)); }
    else if (m.method === 'Log.entryAdded') { const e = m.params.entry; if (e.level === 'error' || e.level === 'warning') logs.push(`[${e.level}] ${e.text} ${e.url || ''}`); }
  };
  const call = (method, params = {}) => new Promise((r) => { const my = ++id; wait.set(my, (m) => r(m.result || m)); ws.send(JSON.stringify({ id: my, method, params })); });
  await call('Runtime.enable'); await call('Log.enable'); await call('Page.enable');
  await call('Page.navigate', { url });
  const b = {
    logs, call, sleep,
    async js(expr) { const r = await call('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) { logs.push('[EVAL-EXC] ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text)); return undefined; } return r.result?.value; },
    async until(expr, ms = 60000, every = 200) { const t = Date.now(); while (Date.now() - t < ms) { if (await b.js(expr)) return true; await sleep(every); } return false; },
    async click(x, y) { for (const type of ['mousePressed', 'mouseReleased']) await call('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 }); },
    async key(code, kind = 'press') { for (const type of { down: ['keyDown'], up: ['keyUp'], press: ['keyDown', 'keyUp'] }[kind]) await call('Input.dispatchKeyEvent', { type, code, key: KEYS[code], windowsVirtualKeyCode: VK[code] }); },
    async hold(code, ms) { await b.key(code, 'down'); await sleep(ms); await b.key(code, 'up'); },
    async shot(file) { const r = await call('Page.captureScreenshot', { format: 'jpeg', quality: 78 }); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, Buffer.from(r.data, 'base64')); return file; },
    errors() { return logs.filter((l) => /^\[(EXC|EVAL-EXC|error)\]/.test(l)); },
    close() { try { ws.close(); } catch {} proc.kill(); },
  };
  return b;
}
