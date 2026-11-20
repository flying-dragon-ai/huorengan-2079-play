// DOM / THREE 相关的工具。纯数学部分已搬到 core/math.js，这里再整体转出去，
// 老的 `import { clamp } from '../core/util.js'` 写法继续有效。
import * as THREE from 'three';

export * from './math.js';

/**
 * 建一个离屏 canvas 并取 2D 上下文。
 * @param {number} w 宽（像素）
 * @param {number} h 高（像素）
 * @returns {[HTMLCanvasElement, CanvasRenderingContext2D]} [canvas, ctx]
 */
export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

/**
 * 把 canvas 包成可平铺的 THREE 贴图。
 * @param {HTMLCanvasElement} c 源 canvas
 * @param {{ srgb?: boolean, repeat?: number }} [opts] srgb：是否按 sRGB 解释颜色；repeat：UV 重复次数
 * @returns {THREE.CanvasTexture} 贴图对象
 */
export function canvasTex(c, { srgb = true, repeat = 1 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  return t;
}

/**
 * 简单的事件/计时：按延迟排队回调，每帧推进。
 */
export class Timeline {
  constructor() { this.items = []; this.t = 0; }

  /**
   * 排一个延迟回调。
   * @param {number} delay 相对当前时刻的延迟（秒）
   * @param {() => void} fn 到点执行的回调
   * @returns {void}
   */
  at(delay, fn) { this.items.push({ t: this.t + delay, fn }); }

  /**
   * 推进时间并执行所有到点的回调。
   * @param {number} dt 帧间隔（秒）
   * @returns {void}
   */
  update(dt) {
    this.t += dt;
    const due = this.items.filter((i) => i.t <= this.t);
    this.items = this.items.filter((i) => i.t > this.t);
    due.forEach((i) => i.fn());
  }

  /**
   * 清空所有排队回调（不重置已流逝的时间）。
   * @returns {void}
   */
  clear() { this.items = []; }
}
