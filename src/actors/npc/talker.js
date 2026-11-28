// NPC 基类：头顶气泡说话，以及沿路径点前进的公共工具
import { bubble } from '../../gfx/fx.js';
import { angleDamp } from '../../core/util.js';

/**
 * 会说话的 NPC 基类。子类负责建 this.root（THREE.Group）并设 this.bubY（气泡高度）。
 */
export class Talker {
  /**
   * 冒一句话，2.8 秒后自动消失；同一时间只有一个气泡。
   * @param {string} text 台词
   * @returns {void}
   */
  say(text) {
    if (this.bub) this.root.remove(this.bub);
    this.bub = bubble(text); this.bub.position.y = this.bubY || 2.6; this.root.add(this.bub); this.bubT = 2.8;
  }
  /**
   * 气泡倒计时，到点摘掉。
   * @param {number} dt 帧间隔（秒）
   * @returns {void}
   */
  tickBubble(dt) {
    if (this.bub && (this.bubT -= dt) <= 0) { this.root.remove(this.bub); this.bub = null; }
  }
}

// 沿路径点前进
/**
 * 沿路径点前进：走到当前点 2.5 米内就换下一个点，边走边转向。
 * @param {{root: {position: {x: number, z: number}}, wp: number, yaw: number}} o 带 root / wp / yaw 的对象
 * @param {{x: number, z: number}[]} path 路径点
 * @param {number} speed 速度（米/秒）
 * @param {number} dt 帧间隔（秒）
 * @returns {boolean} 走完整条路径返回 true
 */
export function follow(o, path, speed, dt) {
  if (o.wp >= path.length) return true;
  const t = path[o.wp];
  const dx = t.x - o.root.position.x, dz = t.z - o.root.position.z, d = Math.hypot(dx, dz);
  if (d < 2.5) { o.wp++; return o.wp >= path.length; }
  const s = Math.min(d, speed * dt);
  o.root.position.x += (dx / d) * s; o.root.position.z += (dz / d) * s;
  o.yaw = angleDamp(o.yaw, Math.atan2(dx, dz), 6, dt);
  return false;
}
