// 袋鼠：抢单对手，会咬着玩家跑，抢到单就在七大姑旁边跳舞喝咖啡
import * as THREE from 'three';
import { getModel } from '../models.js';
import { clamp } from '../../core/util.js';
import { LINES } from '../../data/text.js';
import { Talker, follow } from './talker.js';

/**
 * 袋鼠——外卖抢单对手。active 时沿路径追玩家，抢到单后进 taunt 状态原地蹦跳喝咖啡。
 */
export class Kangaroo extends Talker {
  /** @param {THREE.Scene} scene 主场景 */
  constructor(scene) {
    super();
    this.root = new THREE.Group(); this.root.add((this.model = getModel('kangaroo')));
    scene.add(this.root); this.root.visible = false; this.yaw = 0; this.phase = 0; this.wp = 0; this.bubY = 2.9;
    this.lineT = 4;
  }
  /**
   * 开始抢单：显形、放到起点、沿路径跑。
   * @param {THREE.Vector3} pos 起点
   * @param {{x: number, z: number}[]} path 路径点
   * @returns {void}
   */
  start(pos, path) { this.root.visible = true; this.root.position.copy(pos); this.path = path; this.wp = 0; this.active = true; this.taunt = false; this.sprint = false; }
  // 抢单成功：在七大姑旁边跳舞嘲笑，当面喝掉咖啡
  /**
   * 抢单成功：在七大姑旁边跳舞嘲笑，当面喝掉咖啡。
   * @param {import('../../audio/audio.js').Audio} audio 音频
   * @returns {void}
   */
  startTaunt(audio) {
    this.active = false; this.taunt = true; this.tauntT = 0; this.lineI = 0;
    if (!this.cup) {
      this.cup = new THREE.Group();
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.42, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.06, 16), new THREE.MeshStandardMaterial({ color: 0x6a3a1a }));
      lid.position.y = 0.24; this.cup.add(c, lid);
      this.cup.position.set(0.45, 1.35, 0.35); this.root.add(this.cup);
    }
    this.cup.visible = true;
    this.say('这单是我的！略略略～'); audio.play('feidudu', { vol: 0.9 });
  }
  /** 嘲笑动画：蹦跳、扭身、仰头喝咖啡，隔几秒换一句台词。 @param {number} dt 帧间隔（秒） @returns {void} */
  updateTaunt(dt) {
    this.tauntT += dt;
    const t = this.tauntT, hop = Math.abs(Math.sin(t * 7));
    this.root.position.y = this.baseY + hop * 0.9;
    this.root.rotation.y = this.yaw + Math.sin(t * 3) * 0.9; // 扭来扭去
    this.model.scale.set(1, 0.85 + hop * 0.25, 1);
    this.cup.rotation.z = Math.min(2.2, t * 0.5) * (0.7 + 0.3 * Math.sin(t * 9)); // 越喝越仰头
    this.cup.position.y = 1.35 + Math.min(0.5, t * 0.12);
    if (t > 3 + this.lineI * 3.2 && this.lineI < 3) this.say(['咖啡真香～', '一杯八十，值！', '你的胆子真是肥嘟嘟的'][this.lineI++]);
  }
  /**
   * 每帧更新：追玩家（落后加速、领先放慢），蹦跳，撞摊位，随机喊话。
   * @param {number} dt 帧间隔（秒）
   * @param {import('../player.js').Player} player 玩家
   * @param {object} world 世界（heightAt / hitProps）
   * @returns {void}
   */
  update(dt, player, world) {
    this.tickBubble(dt);
    if (this.taunt) { this.updateTaunt(dt); return; }
    if (!this.active) return;
    // 始终和玩家咬着：落后就加速，领先就放慢
    const d = this.root.position.distanceTo(player.pos);
    const t = this.path[this.wp] || player.pos;
    const fx_ = t.x - this.root.position.x, fz_ = t.z - this.root.position.z;
    const behind = (player.pos.x - this.root.position.x) * fx_ + (player.pos.z - this.root.position.z) * fz_ > 0;
    const k = d < 6 ? 1.0 : behind ? 1.25 : 0.8;
    const sp = this.sprint ? 46 : clamp(Math.abs(player.speed) * k + (behind && d > 30 ? 12 : 0), 7, 36);
    const done = follow(this, this.path, sp, dt);
    this.phase += dt * sp * 0.45;
    const hop = Math.abs(Math.sin(this.phase));
    this.root.position.y = world.heightAt(this.root.position.x, this.root.position.z) + hop * 1.6;
    this.model.scale.set(1 / Math.sqrt(0.7 + hop * 0.5), 0.7 + hop * 0.5, 1 / Math.sqrt(0.7 + hop * 0.5));
    this.root.rotation.y = this.yaw;
    world.hitProps(this.root.position, 1, new THREE.Vector3(Math.sin(this.yaw) * sp, 0, Math.cos(this.yaw) * sp), 0.8);
    if ((this.lineT -= dt) <= 0 && d < 30) { this.lineT = 7 + Math.random() * 4; this.say(LINES.kangaroo[Math.floor(Math.random() * 3)][1]); }
    if (done) { this.baseY = world.heightAt(this.root.position.x, this.root.position.z); this.done = true; this.active = false; }
  }
  /** 到下一个路径点的距离。 @returns {number} 米 */
  distToWp() { const t = this.path[this.wp]; return t ? Math.hypot(t.x - this.root.position.x, t.z - this.root.position.z) : 0; }
}
