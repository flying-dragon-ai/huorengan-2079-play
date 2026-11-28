// 第三人称镜头，鼠标控制；没碰鼠标时自动转到身后
import * as THREE from 'three';
import { clamp, damp, angleDamp, lerp } from '../core/util.js';
import { groundH } from '../world/island.js';

/**
 * 第三人称跟随镜头。鼠标拖动改朝向；一段时间没碰鼠标、且角色在移动时，自动转回角色身后。
 * 骑车时拉远、加大 FOV，体型变大（捧腹大笑）时整体拉远。
 */
export class CameraRig {
  /** @param {THREE.PerspectiveCamera} cam 被控制的相机 */
  constructor(cam) { this.cam = cam; this.yaw = 0; this.pitch = 0.28; this.pos = new THREE.Vector3(); this.look = new THREE.Vector3(); this.init = false; this.extra = 0; }

  /**
   * 每帧跟随。
   * @param {number} dt 帧间隔（秒）
   * @param {import('./player.js').Player} p 玩家
   * @param {{mdx: number, mdy: number, lastMouse: number}} input 鼠标增量与最后一次鼠标活动时间
   * @param {boolean} auto 是否强制自动回正
   * @returns {void}
   */
  update(dt, p, input, auto) {
    const now = performance.now() / 1000;
    this.yaw -= input.mdx * 0.0025; this.pitch = clamp(this.pitch + input.mdy * 0.002, -0.15, 1.2);
    const moving = p.mode === 'bike' ? Math.abs(p.speed) > 2 : Math.hypot(p.vel.x, p.vel.z) > 1;
    if ((auto || now - input.lastMouse > 1.5) && moving) {
      this.yaw = angleDamp(this.yaw, p.yaw, p.mode === 'bike' ? 3 : 1.5, dt);
      this.pitch = damp(this.pitch, p.mode === 'bike' ? 0.2 : 0.3, 1, dt);
    }
    const big = p.scale > 2 ? p.scale * 0.8 : 1;
    const dist = (p.mode === 'bike' ? 7 + Math.abs(p.speed) * 0.08 : 5.5) * big + this.extra;
    const tgt = p.pos.clone().add(new THREE.Vector3(0, (p.mode === 'bike' ? 1.6 : 1.4) * big, 0));
    const want = tgt.clone().add(new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch) * dist, Math.sin(this.pitch) * dist + 0.4, -Math.cos(this.yaw) * Math.cos(this.pitch) * dist));
    const gy = groundH(want.x, want.z) + 0.6;
    if (want.y < gy) want.y = gy;
    if (!this.init) { this.pos.copy(want); this.look.copy(tgt); this.init = true; }
    this.pos.lerp(want, 1 - Math.exp(-8 * dt));
    this.look.lerp(tgt.addScaledVector(p.heading(), p.mode === 'bike' ? 3 : 1), 1 - Math.exp(-12 * dt));
    this.cam.position.copy(this.pos); this.cam.lookAt(this.look);
    const fov = p.mode === 'bike' ? 60 + Math.abs(p.speed) * 0.5 : 58;
    this.cam.fov = damp(this.cam.fov, fov, 3, dt); this.cam.updateProjectionMatrix();
  }

  // 空降镜头：在玩家头顶后方往下看
  /**
   * 空降镜头：在玩家头顶后方往下看，越接近地面视线越往下压。
   * @param {number} dt 帧间隔（秒）
   * @param {import('./player.js').Player} p 玩家
   * @returns {void}
   */
  dive(dt, p) {
    const want = p.pos.clone().add(new THREE.Vector3(-Math.sin(p.yaw) * 6, 9, -Math.cos(p.yaw) * 6));
    if (!this.init) { this.pos.copy(want); this.init = true; }
    this.pos.lerp(want, 1 - Math.exp(-6 * dt));
    this.cam.position.copy(this.pos);
    const down = lerp(-1.5, -14, Math.min(1, Math.max(0, (330 - p.pos.y) / 220)));
    this.cam.lookAt(p.pos.clone().add(new THREE.Vector3(Math.sin(p.yaw) * 6, down, Math.cos(p.yaw) * 6)));
    this.cam.fov = damp(this.cam.fov, 78, 2, dt); this.cam.updateProjectionMatrix();
    this.yaw = p.yaw;
  }
}
