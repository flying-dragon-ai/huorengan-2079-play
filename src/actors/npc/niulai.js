// 牛来：沿路径冲撞，撞飞摊位
import * as THREE from 'three';
import { getModel } from '../models.js';
import { LINES } from '../../data/text.js';
import { Talker, follow } from './talker.js';

/**
 * 牛来——冲撞型 NPC。charge() 之后沿路径高速冲，撞飞沿途摊位；没在冲就原地晃。
 */
export class Niulai extends Talker {
  /** @param {THREE.Scene} scene 主场景 */
  constructor(scene) {
    super();
    this.root = new THREE.Group(); this.root.add((this.model = getModel('niulai')));
    scene.add(this.root); this.yaw = 0; this.phase = 0; this.wp = 0; this.bubY = 2.4;
    this.root.position.set(-14, 0, 30); this.charging = null; this.idleT = 0;
  }
  /**
   * 开始冲撞。
   * @param {{x: number, z: number}[]} path 路径点
   * @param {number} [speed] 速度（米/秒），默认 22
   * @returns {void}
   */
  charge(path, speed = 22) { this.charging = { path, speed }; this.wp = 0; this.say(LINES.niulai[1]); }
  /**
   * 每帧更新：冲撞时沿路径推进并撞摊位，否则原地小幅摇摆。
   * @param {number} dt 帧间隔（秒）
   * @param {object} world 世界（heightAt / hitProps）
   * @param {import('../../gfx/fx.js').Particles} fx 粒子
   * @returns {void}
   */
  update(dt, world, fx) {
    this.tickBubble(dt);
    if (this.charging) {
      const done = follow(this, this.charging.path, this.charging.speed, dt);
      this.phase += dt * 16;
      world.hitProps(this.root.position, 2, new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)).multiplyScalar(this.charging.speed), 1.5);
      if (Math.random() < 0.4) fx.puff(this.root.position.clone(), 2, new THREE.Color(0.8, 0.7, 0.55), 3);
      if (done) this.charging = null;
    } else {
      this.idleT += dt; this.phase += dt * 3;
      this.yaw += Math.sin(this.idleT * 0.3) * dt * 0.5;
    }
    this.root.position.y = world.heightAt(this.root.position.x, this.root.position.z) + Math.abs(Math.sin(this.phase)) * (this.charging ? 0.35 : 0.04);
    this.root.rotation.set(this.charging ? 0.08 : 0, this.yaw, Math.sin(this.phase) * 0.05);
  }
}
