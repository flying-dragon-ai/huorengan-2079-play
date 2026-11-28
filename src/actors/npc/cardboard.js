// 纸板角色的通用运动：会被撞飞，会爬起来
import * as THREE from 'three';
import { standee } from '../models.js';
import { angleDamp } from '../../core/util.js';
import { Talker } from './talker.js';

/**
 * 纸板立牌 NPC 基类。会被撞飞（knock + physics），会走（walkTo），会蹦。
 * 子类可以传 opts.root 用现成的 Group，否则按 opts 画一张立牌。
 */
export class Cardboard extends Talker {
  /**
   * @param {THREE.Scene} scene 主场景
   * @param {{root?: THREE.Group, name?: string, color?: string, face?: string, h?: number}} opts 立牌参数
   */
  constructor(scene, opts) {
    super();
    this.root = opts.root || standee(opts); scene.add(this.root);
    this.vel = new THREE.Vector3(); this.spin = new THREE.Vector3(); this.flying = false; this.yaw = 0; this.phase = Math.random() * 6;
    this.bubY = 2.4;
  }
  /**
   * 被撞飞：给一个往外加往上的初速度，并随机自旋。
   * @param {THREE.Vector3} from 撞击点
   * @param {THREE.Vector3} vel 撞击者速度
   * @returns {boolean} 已经在飞就返回 false
   */
  knock(from, vel) {
    if (this.flying) return false;
    const dx = this.root.position.x - from.x, dz = this.root.position.z - from.z, d = Math.hypot(dx, dz) + 0.01;
    const sp = Math.max(8, Math.hypot(vel.x, vel.z));
    this.vel.set((dx / d) * sp * 0.5 + vel.x * 0.6, 8 + sp * 0.4, (dz / d) * sp * 0.5 + vel.z * 0.6);
    this.spin.set((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16);
    this.flying = true; return true;
  }
  /**
   * 飞行中的物理：重力、落地反弹、停下来复位。
   * @param {number} dt 帧间隔（秒）
   * @param {object} world 世界（heightAt）
   * @returns {boolean} 这一帧是否在飞（true 时调用方应跳过其它逻辑）
   */
  physics(dt, world) {
    if (!this.flying) return false;
    const p = this.root.position;
    this.vel.y -= 22 * dt; p.addScaledVector(this.vel, dt);
    this.root.rotation.x += this.spin.x * dt; this.root.rotation.z += this.spin.z * dt; this.root.rotation.y += this.spin.y * dt;
    const g = world.heightAt(p.x, p.z);
    if (p.y < g) {
      p.y = g;
      if (this.vel.y < -4) { this.vel.y *= -0.4; this.vel.x *= 0.6; this.vel.z *= 0.6; }
      else { this.flying = false; this.vel.set(0, 0, 0); this.root.rotation.set(0, this.yaw, 0); }
    }
    return true;
  }
  /**
   * 朝目标点走，带碰撞与上下颠。
   * @param {number} dt 帧间隔（秒）
   * @param {number} x 目标 x
   * @param {number} z 目标 z
   * @param {number} speed 速度（米/秒）
   * @param {object} world 世界（heightAt / col.resolve）
   * @returns {number} 到目标的距离（米）
   */
  walkTo(dt, x, z, speed, world) {
    const p = this.root.position, dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
    if (d > 0.5) {
      const s = Math.min(d, speed * dt);
      p.x += (dx / d) * s; p.z += (dz / d) * s;
      this.yaw = angleDamp(this.yaw, Math.atan2(dx, dz), 8, dt);
      world.col.resolve(p, 0.4, 0);
    }
    this.phase += dt * speed * 1.2;
    p.y = world.heightAt(p.x, p.z) + Math.abs(Math.sin(this.phase)) * (this.bounce ?? 0.35);
    this.root.rotation.set(0, this.yaw, Math.sin(this.phase) * 0.12 * (this.bounce == null ? 1 : 0.4));
    return d;
  }
}
