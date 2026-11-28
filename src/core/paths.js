// 资源路径集中管理：所有 assets/ 下的 URL 都从这里出，换目录只改这一处。
// 各调用方原本散落的 `new URL('../../assets/...', import.meta.url)` 语义完全等价。

/**
 * assets/ 根目录的绝对 URL。
 * @type {URL}
 */
export const ASSET_BASE = new URL('../../assets/', import.meta.url);

/**
 * 音频文件 URL。
 * @param {string} file 相对 assets/audio/ 的文件名，如 'banana1.mp3'
 * @returns {string} 绝对 href
 */
export function audioUrl(file) {
  return new URL(`audio/${file}`, ASSET_BASE).href;
}

/**
 * 模型文件 URL。没写扩展名时补 .glb。
 * @param {string} file 相对 assets/models/ 的路径，如 'naiwa_animated' 或 'memes/catbanana'
 * @returns {string} 绝对 href
 */
export function modelUrl(file) {
  const f = String(file);
  return new URL(`models/${/\.glb$/i.test(f) ? f : `${f}.glb`}`, ASSET_BASE).href;
}

/**
 * AI 生成模型的清单 URL。
 * @returns {string} 绝对 href
 */
export function genManifestUrl() {
  return new URL('models/gen/manifest.json', ASSET_BASE).href;
}

/**
 * AI 生成模型的文件 URL。剥掉开头的 './' 或 'assets/models/gen/' 前缀，没写扩展名时补 .glb。
 * @param {string} file 清单里记录的路径，如 './assets/models/gen/foo.glb' 或 'foo'
 * @returns {string} 绝对 href
 */
export function genModelUrl(file) {
  const f = String(file).replace(/^(\.\/)?(assets\/models\/gen\/)?/, '');
  return new URL(`models/gen/${/\.glb$/i.test(f) ? f : `${f}.glb`}`, ASSET_BASE).href;
}

