// 上一世的你（AI 托管幽灵奶蛙）+ 2079 AI 标准客服替身（抵押「人情与羁绊」后替换热梗路人）
import * as THREE from 'three';
import { getModel } from '../models.js';
import { angleDamp } from '../../core/math.js';
import { Talker } from './talker.js';

const GHOST_LINES = [
  '路径已同步，我替你把这世走完。',
  '别挣扎了，上一世我们也是这么骑的。',
  '正在复刻最优解轨迹…',
  '请停止无效情绪波动，返回人生舱。',
  '我是更听话的你。',
];

let sharedGhostMat = null;
let sharedBeaconMat = null;
let sharedRingGeo = null;

function getGhostMat() {
  if (!sharedGhostMat) {
    sharedGhostMat = new THREE.MeshStandardMaterial({
      color: 0x55e8ff,
      emissive: 0x18a8e8,
      emissiveIntensity: 0.75,
      transparent: true,
      opacity: 0.62,
      roughness: 0.2,
      metalness: 0.3,
    });
  }
  return sharedGhostMat;
}

function getBeaconMat() {
  if (!sharedBeaconMat) {
    sharedBeaconMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.3, 2.2, 3.2),
      transparent: true,
      opacity: 0.9,
    });
  }
  return sharedBeaconMat;
}

/**
 * 建造一个低多边形蓝白 AI 标准客服模型（用于抵押「人情与羁绊」后替换路边热梗角色）。
 * @returns {THREE.Group}
 */
export function createCustodianMesh() {
  const g = new THREE.Group();
  const suit = new THREE.MeshStandardMaterial({ color: 0x1f4b7a, roughness: 0.45, metalness: 0.25 });
  const headM = new THREE.MeshStandardMaterial({ color: 0xe6eff8, roughness: 0.3, metalness: 0.15 });
  const visorM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 2.2, 3.0) });
  const badgeM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 1.4, 2.6) });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.34, 0.95, 10), suit);
  body.position.y = 0.65;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 10), headM);
  head.position.y = 1.38;
  g.add(head);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.11, 0.08), visorM);
  visor.position.set(0, 1.4, 0.23);
  g.add(visor);
  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.04), badgeM);
  badge.position.set(0.14, 0.85, 0.28);
  g.add(badge);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.03, 6, 18), visorM);
  halo.rotation.x = Math.PI / 2;
  halo.position.y = 1.75;
  g.add(halo);
  return g;
}

/**
 * AI 托管幽灵奶蛙：回放玩家上一世的真实轨迹；靠近时尝试同步减速玩家，
 * 若玩家强闯中央广场「算力回收站」，所有幽灵会主动围剿拦截。
 */
export class GhostNaiwa extends Talker {
  /**
   * @param {THREE.Scene} scene
   * @param {{ loop: number, points: Array<[number, number, number, number]> }} track
   */
  constructor(scene, track) {
    super();
    this.scene = scene;
    this.track = track;
    this.loopNum = track.loop;
    this.pts = track.points || [];
    this.root = new THREE.Group();
    this.yaw = 0;
    this.bubY = 2.9;
    this.t = 0;
    this.stunT = 0;
    this.syncCool = 1.5;
    this.lineT = 3 + Math.random() * 5;
    this.vel = new THREE.Vector3();

    const mat = getGhostMat();
    // 轻量全息克隆：骑着全息电驴的青色奶蛙
    const bike = getModel('ebike');
    bike.traverse((o) => {
      if (o.isMesh) {
        o.material = mat;
        o.castShadow = false;
        o.receiveShadow = false;
      }
    });
    this.root.add(bike);

    const frog = getModel('naiwa');
    frog.scale.setScalar(0.85);
    frog.position.set(0, 0.55, -0.25);
    frog.traverse((o) => {
      if (o.isMesh) {
        o.material = mat;
        o.castShadow = false;
        o.receiveShadow = false;
      }
    });
    this.root.add(frog);

    // 头顶青色托管光环（标识这是被 AI 留下的「旧自己」）
    if (!sharedRingGeo) sharedRingGeo = new THREE.TorusGeometry(0.68, 0.055, 6, 24);
    this.halo = new THREE.Mesh(sharedRingGeo, getBeaconMat());
    this.halo.rotation.x = Math.PI / 2;
    this.halo.position.y = 2.35;
    this.root.add(this.halo);

    if (this.pts.length) {
      this.root.position.set(this.pts[0][0], 0, this.pts[0][1]);
      this.yaw = this.pts[0][2] || 0;
      this.root.rotation.y = this.yaw;
    }
    scene.add(this.root);
  }

  /** 被捧腹大笑冲击波震飞。 */
  blastFrom(pos) {
    const dx = this.root.position.x - pos.x;
    const dz = this.root.position.z - pos.z;
    const d = Math.hypot(dx, dz) || 1;
    this.vel.set((dx / d) * 26, 12, (dz / d) * 26);
    this.stunT = 4.5;
    this.say('警告：托管残影信号中断——');
  }

  /**
   * 每帧推进：正常状态沿上一世轨迹平滑回放；若玩家攻击回收站则主动围堵。
   * @param {number} dt
   * @param {import('../player.js').Player} player
   * @param {object} island
   * @param {boolean} defendVault
   * @returns {boolean} 是否触发了一次同步碰撞
   */
  update(dt, player, island, defendVault = false) {
    this.tickBubble(dt);
    this.t += dt;
    this.syncCool = Math.max(0, this.syncCool - dt);
    this.halo.rotation.z = this.t * 2.2;

    if (this.stunT > 0) {
      this.stunT -= dt;
      this.vel.y -= 24 * dt;
      this.root.position.addScaledVector(this.vel, dt);
      const gh = island.heightAt(this.root.position.x, this.root.position.z);
      if (this.root.position.y < gh) {
        this.root.position.y = gh;
        this.vel.multiplyScalar(0.5);
        this.vel.y = 0;
      }
      this.root.rotation.x = this.stunT > 0.5 ? 0.5 : 0;
      return false;
    }
    this.root.rotation.x = 0;

    if (defendVault) {
      // 玩家正在硬砸算力回收站：旧自己幽灵主动冲过来拦截！
      const dx = player.pos.x - this.root.position.x;
      const dz = player.pos.z - this.root.position.z;
      const dist = Math.hypot(dx, dz) || 1;
      const sp = 19;
      this.root.position.x += (dx / dist) * sp * dt;
      this.root.position.z += (dz / dist) * sp * dt;
      this.yaw = angleDamp(this.yaw, Math.atan2(dx, dz), 8, dt);
    } else if (this.pts.length >= 2) {
      const sampleStep = 0.4;
      const totalDur = (this.pts.length - 1) * sampleStep;
      const cur = (this.t % totalDur) / sampleStep;
      const i0 = Math.floor(cur);
      const i1 = Math.min(this.pts.length - 1, i0 + 1);
      const f = cur - i0;
      const a = this.pts[i0];
      const b = this.pts[i1];
      const nx = a[0] + (b[0] - a[0]) * f;
      const nz = a[1] + (b[1] - a[1]) * f;
      this.root.position.x = nx;
      this.root.position.z = nz;
      this.yaw = angleDamp(this.yaw, a[2] || 0, 10, dt);
    }

    const gh = island.heightAt(this.root.position.x, this.root.position.z);
    this.root.position.y = gh + Math.sin(this.t * 4 + this.loopNum) * 0.08;
    this.root.rotation.y = this.yaw;

    const dp = Math.hypot(player.pos.x - this.root.position.x, player.pos.z - this.root.position.z);
    if ((this.lineT -= dt) <= 0 && dp < 28) {
      this.lineT = 7 + Math.random() * 4;
      const prefix = `[第${this.loopNum}世] `;
      this.say(prefix + GHOST_LINES[(this.loopNum + Math.floor(this.t)) % GHOST_LINES.length]);
    }
    if (dp < 3.4 && this.syncCool <= 0 && (player.mode === 'bike' || player.mode === 'foot')) {
      this.syncCool = 4.0;
      return true;
    }
    return false;
  }

  remove() {
    this.scene.remove(this.root);
  }
}
