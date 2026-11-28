// 纯数学工具：零依赖，不碰 DOM、不碰 THREE，任何层都能安全引入。
// 这里的实现从 core/util.js 原样搬出，逻辑一字未改。

/**
 * 把 v 夹在 [a, b] 区间内。
 * @param {number} v 输入值
 * @param {number} a 下界
 * @param {number} b 上界
 * @returns {number} 夹紧后的值
 */
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/**
 * 线性插值。
 * @param {number} a 起点
 * @param {number} b 终点
 * @param {number} t 插值系数，0 返回 a，1 返回 b
 * @returns {number} 插值结果
 */
export const lerp = (a, b, t) => a + (b - a) * t;

/**
 * 帧率无关的指数阻尼插值：不管 dt 多大，收敛速度一致。
 * @param {number} a 当前值
 * @param {number} b 目标值
 * @param {number} l 阻尼系数，越大越快
 * @param {number} dt 帧间隔（秒）
 * @returns {number} 阻尼后的新值
 */
export const damp = (a, b, l, dt) => lerp(a, b, 1 - Math.exp(-l * dt));

/**
 * 平滑阶跃（smoothstep）：x 在 [a, b] 内时返回 0→1 的 S 形过渡。
 * @param {number} a 区间起点
 * @param {number} b 区间终点
 * @param {number} x 采样位置
 * @returns {number} 0 到 1 之间的过渡值
 */
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/**
 * 角度阻尼插值：走最短弧，跨 ±π 不会绕远路。
 * @param {number} a 当前角度（弧度）
 * @param {number} b 目标角度（弧度）
 * @param {number} l 阻尼系数，越大越快
 * @param {number} dt 帧间隔（秒）
 * @returns {number} 阻尼后的新角度（弧度）
 */
export function angleDamp(a, b, l, dt) {
  const d = (((b - a + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + d * (1 - Math.exp(-l * dt));
}

/**
 * 可复现的伪随机数发生器（mulberry32）。
 * @param {number} [seed=1] 种子，同种子必得同序列
 * @returns {() => number} 每次调用返回 [0, 1) 的随机数
 */
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
