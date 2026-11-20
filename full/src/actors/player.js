// 奶蛙：步行、骑电驴、空降、摔成饼、捧腹大笑变大
import * as THREE from 'three';
import { getModel } from './models.js';
import { clamp, damp, angleDamp, lerp } from '../core/util.js';
import { groundH } from '../world/island.js';
import { CameraRig as CameraRigClass } from './camera-rig.js';

const G = 26;

/**
 * 玩家角色（奶蛙）。四种运动模式：foot 步行 / bike 骑电驴 / dive 空降 / splat 摔成饼。
 * 体型用一根弹簧（sq / sqv）做卡通挤压拉伸，动画走 AnimationMixer 的骨骼片段。
 */
export class Player {
  /**
   * @param {THREE.Scene} scene 主场景
   * @param {object} world 世界（需要 heightAt / col.resolve / hitProps / blast / pierTop）
   * @param {import('../audio/audio.js').Audio} audio 音频
   * @param {import('../gfx/fx.js').Particles} fx 粒子
   */
  constructor(scene, world, audio, fx) {
    this.world = world; this.audio = audio; this.fx = fx;
    this.root = new THREE.Group(); scene.add(this.root);
    this.model = getModel('naiwa'); this.root.add(this.model);
    this.model.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = false;
      o.material = o.material.clone();
      o.material.roughness = .62;
      if (o.morphTargetInfluences) o.morphTargetInfluences.fill(0);
    });
    this.bike = new THREE.Group(); this.bikeModel = getModel('ebike'); this.bike.add(this.bikeModel); scene.add(this.bike);
    this.bike.position.set(6, 0, 50); this.bike.rotation.y = -Math.PI / 2;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.yaw = 0; this.mode = 'none';
    this.speed = 0; this.vy = 0; this.air = false; this.jumps = 0;
    this.sq = 1; this.sqv = 0; this.scale = 1; this.scaleTarget = 1;
    this.phase = 0; this.flip = 0; this.lean = 0;
    this.splatT = 0; this.chaos = 0; this.events = [];
    this.lastGround = 0;
    this.initAnimation();
  }

  /** 建 AnimationMixer，并先播 idle。 @returns {void} */
  initAnimation() {
    this.actions = { idle: true, walk: true, run: true, bike: true, jump: true, laugh: true };
    this.mixer = new THREE.AnimationMixer(this.model);
    this.clips = this.model.animations || [];
    this.currentAction = null;
    this.playAnimation('idle');
    for (const c of this.clips) this.mixer.clipAction(c).stop();
  }

  /**
   * 切骨骼动画片段。
   * @param {'idle'|'walk'|'run'|'bike'|'jump'|'laugh'} name 动作名
   * @param {number} [fade] 淡入时长（秒），默认 0.18
   * @returns {void}
   */
  playAnimation(name, fade = .18) {
    if (!this.actions[name] || this.currentAction === name) return;
    this.currentAction = name; this.animBlend = 0;
    const clipName = ({ idle: 'Idle_Loop', walk: 'Walk_Loop', run: 'Jog_Fwd_Loop', bike: 'Driving_Loop', jump: 'Jump_Loop', laugh: 'Idle_Rail_Call' })[name];
    const clip = this.clips.find(c => c.name === clipName);
    if (!clip) return;
    const next = this.mixer.clipAction(clip);
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(.18).play();
    if (this.action) this.action.fadeOut(.18);
    this.action = next;
  }

  /** 按当前模式与速度挑动画并推进 mixer。 @param {number} dt 帧间隔（秒） @returns {void} */
  updateAnimation(dt) {
    let name = 'idle';
    if (this.mode === 'bike') name = 'bike';
    else if (this.air || this.mode === 'dive') name = 'jump';
    else if (this.mode === 'foot') {
      const sp = Math.hypot(this.vel.x, this.vel.z);
      if (sp > 7) name = 'run'; else if (sp > .6) name = 'walk';
    }
    this.playAnimation(this.actions[name] ? name : 'idle');
    this.mixer.update(dt);
  }

  /** 往事件队列里塞一条，外层每帧取走。 @param {object|string} e 事件 @returns {void} */
  emit(e) { this.events.push(e); }

  /**
   * 从空中开始空降。
   * @param {number} x 世界坐标 x
   * @param {number} y 世界坐标 y
   * @param {number} z 世界坐标 z
   * @returns {void}
   */
  startDive(x, y, z) {
    this.mode = 'dive'; this.pos.set(x, y, z); this.vel.set(0, -30, 0); this.root.visible = true;
  }

  /** 站在电驴旁边才能上车。 @returns {boolean} */
  canMount() { return this.mode === 'foot' && this.pos.distanceTo(this.bike.position) < 3.2; }
  /** 上车：切 bike 模式，位置对齐车身。 @returns {void} */
  mount() {
    this.mode = 'bike'; this.speed = 0; this.yaw = this.bike.rotation.y;
    this.currentAction = null;
    this.pos.copy(this.bike.position); this.audio.pop();
  }
  /** 下车：切 foot 模式，往车侧挪一点。 @returns {void} */
  dismount() {
    this.mode = 'foot'; this.pos.x += Math.cos(this.yaw) * 1.5; this.pos.z -= Math.sin(this.yaw) * 1.5; this.speed = 0;
  }

  /** 朝向单位向量。 @returns {THREE.Vector3} */
  heading() { return new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }

  /**
   * 脚下地面高度（含码头台面）。
   * @param {number} x 世界坐标 x
   * @param {number} z 世界坐标 z
   * @returns {number} 地面高度
   */
  groundAt(x, z) {
    let g = this.world.heightAt(x, z);
    if (Math.abs(x) < 3 && z > 250 && z < 360) g = Math.max(g, this.world.pierTop);
    return g;
  }

  /**
   * 每帧主更新：按模式分派，再跑体型弹簧、摆姿势、推动画。
   * @param {number} dt 帧间隔（秒）
   * @param {object} input 输入（axis() / down() / hit() / virt）
   * @param {number} camYaw 镜头朝向
   * @returns {void}
   */
  update(dt, input, camYaw) {
    const v = input.virt;
    if (this.mode === 'dive') this.updateDive(dt, input, camYaw, v);
    else if (this.mode === 'splat') this.updateSplat(dt);
    else if (this.mode === 'foot') this.updateFoot(dt, input, camYaw, v);
    else if (this.mode === 'bike') this.updateBike(dt, input, v);
    if (this.pancakeT > 0) {
      this.pancakeT -= dt; this.sq = 0.12; this.sqv = 0;
      if (this.pancakeT <= 0) { this.sq = 0.4; this.sqv = 20; this.audio.boing(); }
    }
    // 体型弹簧
    this.sqv += (1 - this.sq) * 180 * dt; this.sqv *= Math.exp(-9 * dt); this.sq += this.sqv * dt;
    this.scale = damp(this.scale, this.scaleTarget, 4, dt);
    this.pose(dt);
    this.updateAnimation(dt);
  }

  /**
   * 这一帧想往哪走：有虚拟摇杆就用摇杆，否则按镜头朝向把键盘轴转成世界方向。
   * @param {object} input 输入
   * @param {number} camYaw 镜头朝向
   * @param {{move?: number[], run?: boolean, jump?: boolean, slow?: boolean, target?: {x: number, z: number}}} v 虚拟输入
   * @returns {THREE.Vector3} 世界方向（长度 ≤ 1）
   */
  moveDir(input, camYaw, v) {
    if (v && v.move) return new THREE.Vector3(v.move[0], 0, v.move[1]);
    const [ax, ay] = input.axis();
    const f = new THREE.Vector3(Math.sin(camYaw), 0, Math.cos(camYaw));
    const r = new THREE.Vector3(-Math.cos(camYaw), 0, Math.sin(camYaw));
    const d = f.multiplyScalar(ay).addScaledVector(r, ax);
    if (d.lengthSq() > 1) d.normalize();
    return d;
  }

  /**
   * 空降：自由落体 + 空中微调，落地转 splat。
   * @param {number} dt 帧间隔（秒）
   * @param {object} input 输入
   * @param {number} camYaw 镜头朝向
   * @param {object} v 虚拟输入
   * @returns {void}
   */
  updateDive(dt, input, camYaw, v) {
    const d = this.moveDir(input, camYaw, v);
    this.vel.x = damp(this.vel.x, d.x * 26, 2, dt); this.vel.z = damp(this.vel.z, d.z * 26, 2, dt);
    this.vel.y = Math.max(this.vel.y - 12 * dt, -46);
    this.pos.addScaledVector(this.vel, dt);
    if (d.lengthSq() > 0.01) this.yaw = angleDamp(this.yaw, Math.atan2(d.x, d.z), 3, dt);
    this.audio.setWind(clamp(-this.vel.y / 46, 0, 1));
    const g = this.groundAt(this.pos.x, this.pos.z);
    if (this.pos.y <= g) {
      this.pos.y = g; this.mode = 'splat'; this.splatT = 0;
      this.audio.setWind(0); this.audio.splat();
      this.fx.puff(this.pos.clone().setY(g + 0.3), 60, new THREE.Color(1, 0.95, 0.85), 14);
      this.world.blast(this.pos, 14, 16);
      this.emit('splat');
    }
  }

  /** 摔成饼：压扁 1.6 秒再弹回 foot。 @param {number} dt 帧间隔（秒） @returns {void} */
  updateSplat(dt) {
    this.splatT += dt;
    if (this.splatT < 1.6) { this.sq = 0.08; this.sqv = 0; }
    else if (this.mode === 'splat') {
      this.sq = 0.3; this.sqv = 18; this.vy = 9; this.air = true; this.mode = 'foot'; this.audio.boing();
      this.emit('unsplat');
    }
  }

  /**
   * 步行：加速、转向、跳跃（二段跳带空翻）、积分。
   * @param {number} dt 帧间隔（秒）
   * @param {object} input 输入
   * @param {number} camYaw 镜头朝向
   * @param {object} v 虚拟输入
   * @returns {void}
   */
  updateFoot(dt, input, camYaw, v) {
    const d = this.moveDir(input, camYaw, v);
    const run = (v && v.run) || input.down('ShiftLeft') || input.down('ShiftRight');
    const top = (run ? 11 : 6.5) * (this.scale > 2 ? 2.2 : 1);
    this.vel.x = damp(this.vel.x, d.x * top, 10, dt); this.vel.z = damp(this.vel.z, d.z * top, 10, dt);
    if (d.lengthSq() > 0.01) this.yaw = angleDamp(this.yaw, Math.atan2(d.x, d.z), 12, dt);
    if (input.hit('Space') || (v && v.jump)) {
      if (!this.air) { this.vy = 9; this.air = true; this.jumps = 1; this.sq = 1.3; this.audio.tone('sine', 300, 700, 0.15, 0.2); }
      else if (this.jumps < 2) {
        this.vy = 8; this.jumps = 2; this.flip = Math.PI * 2;
        if (!this.audio.play('shanshen', { vol: 0.5 })) this.audio.tone('sine', 500, 1100, 0.15, 0.2); // 闪身步
      }
    }
    this.integrate(dt, 0.45);
    const sp = Math.hypot(this.vel.x, this.vel.z);
    this.phase += sp * dt * 1.6;
  }

  /**
   * 水平位移 + 重力 + 碰撞 + 岛屿边界。
   * @param {number} dt 帧间隔（秒）
   * @param {number} radius 碰撞半径（米）
   * @returns {object|null} 碰撞结果
   */
  integrate(dt, radius) {
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    const g = this.groundAt(this.pos.x, this.pos.z);
    if (this.air || this.pos.y > g + 0.05) {
      this.air = true; this.vy -= G * dt; this.pos.y += this.vy * dt;
      if (this.pos.y <= g) {
        this.pos.y = g; this.air = false;
        if (this.vy < -7) { this.sq = 0.6; this.audio.tone('sine', 140, 60, 0.15, 0.25); }
        this.vy = 0; this.jumps = 0;
      }
    } else this.pos.y = g;
    const hit = this.world.col.resolve(this.pos, radius * Math.max(1, this.scale * 0.6), this.pos.y);
    this.clampIsland();
    return hit;
  }

  /** 别跑出岛：半径超过 420 米就按比例拉回。 @returns {void} */
  clampIsland() {
    const r = Math.hypot(this.pos.x, this.pos.z), lim = 420;
    if (r > lim) { this.pos.x *= lim / r; this.pos.z *= lim / r; }
  }

  /**
   * 骑电驴：油门/转向/侧倾、跳台抛飞、撞墙、撞摊位、下海。
   * @param {number} dt 帧间隔（秒）
   * @param {object} input 输入
   * @param {object} v 虚拟输入（target 自动寻路）
   * @returns {void}
   */
  updateBike(dt, input, v) {
    let thr, steer, boost;
    if (v && v.target) {
      const dx = v.target.x - this.pos.x, dz = v.target.z - this.pos.z;
      const want = Math.atan2(dx, dz);
      let diff = ((want - this.yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      steer = clamp(diff * 2.2, -1, 1);
      thr = Math.abs(diff) > 1.0 && this.speed > 10 ? -0.3 : (v.slow ? 0.5 : 1);
      boost = false;
    } else {
      const [ax, ay] = input.axis();
      thr = ay; steer = -ax; boost = input.down('ShiftLeft') || input.down('ShiftRight');
    }
    const top = boost ? 30 : v && v.target ? 21 : 24;
    if (thr > 0) this.speed += (this.speed < top ? 15 : -8) * thr * dt;
    else if (thr < 0) this.speed += (this.speed > 0 ? -28 : -10) * -thr * dt;
    else this.speed = damp(this.speed, 0, 0.8, dt);
    this.speed = clamp(this.speed, -7, top);
    const grip = this.air ? 0.25 : 1;
    const turn = steer * clamp(Math.abs(this.speed) / 5, 0, 1) * lerp(2.3, 1.35, clamp(this.speed / 28, 0, 1)) * grip;
    this.yaw += turn * dt * Math.sign(this.speed || 1);
    // 侧向加速度：转弯太急，叠在车上的梗角色会被甩飞
    this.lateral = damp(this.lateral || 0, Math.abs(turn * this.speed), 8, dt);
    this.lean = damp(this.lean, -steer * clamp(this.speed / 20, 0, 1) * 0.45, 6, dt);
    const h = this.heading();
    this.vel.x = h.x * this.speed; this.vel.z = h.z * this.speed;

    // 竖直方向：跳台会把车抛起来
    const prevG = this.lastGround;
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    const g = this.groundAt(this.pos.x, this.pos.z);
    this.lastGround = g;
    if (this.air) {
      this.vy -= G * dt; this.pos.y += this.vy * dt;
      if (this.pos.y <= g) {
        this.pos.y = g; this.air = false;
        if (this.vy < -6) { this.sq = 0.55; this.audio.boing(); this.fx.puff(this.pos.clone(), 16); this.emit('land'); }
        this.vy = 0;
      }
    } else {
      const slopeV = (g - prevG) / Math.max(dt, 1e-3);
      if (g < this.pos.y - 0.25) { this.air = true; this.vy = clamp(this.rampV || 0, 0, 20) * 1.35; this.emit('air'); }
      else { this.pos.y = g; this.rampV = slopeV; }
    }
    if (!this.air && g <= prevG + 0.001 && g === 0) this.rampV = 0;

    // 撞墙
    const hit = this.world.col.resolve(this.pos, 0.8, this.pos.y);
    if (hit) {
      const into = -(hit.x * h.x + hit.y * h.z);
      if (into > 0.5 && Math.abs(this.speed) > 9) {
        this.audio.crash(); this.sq = 0.5; this.emit('crash');
        // 撞得狠：奶蛙在车上摔成一张饼，停 0.8 秒再弹回来
        if (Math.abs(this.speed) > 14) { this.pancakeT = 0.8; this.audio.splat(); this.emit('pancake'); }
        this.speed *= -0.25; this.chaos += 1;
      } else this.speed *= 1 - into * 0.08;
    }
    // 撞飞摊位
    const n = this.world.hitProps(this.pos, 1.1, this.vel, 1);
    if (n) { this.chaos += n; this.speed *= 0.94; this.audio.crash(); this.emit({ type: 'props', n }); }
    // 下海
    if (groundH(this.pos.x, this.pos.z) < -1.2 && !this.air) {
      this.speed *= Math.exp(-2 * dt);
      if (Math.random() < 0.3) this.fx.puff(this.pos.clone(), 3, new THREE.Color(0.8, 0.9, 1), 6);
    }
    this.clampIsland();
    this.bike.position.copy(this.pos); this.bike.rotation.set(0, this.yaw, 0);
    this.audio.setEngine(true, Math.abs(this.speed));
    this.phase += dt * 10;
  }

  /**
   * 摆姿势：位置、朝向、挤压拉伸、各模式的额外姿态。
   * @param {number} dt 帧间隔（秒）
   * @returns {void}
   */
  pose(dt) {
    const m = this.model, R = this.root;
    R.position.copy(this.pos);
    R.rotation.set(0, this.yaw, 0);
    m.position.set(0, 0, 0); m.rotation.set(0, 0, 0);
    let sx = 1, sy = this.sq, sz = 1;
    sx = sz = 1 / Math.sqrt(Math.max(0.15, this.sq));
    if (this.mode === 'dive') {
      m.rotation.x = Math.PI / 2 * 0.85; m.position.y = 0.6;
      m.rotation.z = Math.sin(performance.now() / 120) * 0.15;
    } else if (this.mode === 'splat') {
      sx = sz = 2.1; sy = this.sq;
    } else if (this.mode === 'foot') {
      const sp = Math.hypot(this.vel.x, this.vel.z);
      const k = clamp(sp / 6, 0, 1);
      m.position.y = Math.abs(Math.sin(this.phase * 3)) * 0.14 * k;
      m.rotation.z = Math.sin(this.phase * 3) * 0.1 * k;
      m.rotation.x = k * 0.12;
      if (this.flip > 0) { this.flip = Math.max(0, this.flip - dt * 12); m.rotation.x -= this.flip; m.position.y += 0.5; }
    } else if (this.mode === 'bike') {
      R.position.y += 0.55;
      R.position.addScaledVector(this.heading(), -0.3);
      m.rotation.x = 0.15; m.scale.setScalar(0.85);
      this.bike.rotation.z = this.lean;
      R.rotation.z = this.lean * 1.2;
      m.position.y = Math.sin(this.phase) * 0.03;
    }
    if (this.mode !== 'bike') m.scale.set(sx * this.scale, sy * this.scale, sz * this.scale);
    else m.scale.set(0.85 * sx, 0.85 * sy, 0.85 * sz);
    // 形变动画与整体卡通变形可叠加，不使用实时蒙皮

  }
}

/**
 * 第三人称镜头。类本体在 ./camera-rig.js，这里原样再导出（同一个类，不是副本），
 * 保证 `import { Player, CameraRig } from '../actors/player.js'` 继续可用。
 * @type {typeof import('./camera-rig.js').CameraRig}
 */
export const CameraRig = CameraRigClass;
