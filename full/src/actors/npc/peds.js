// 热梗路人：纸板立牌围着广场，3D 模型站在外卖路线两边，还有东京街的合唱团
import * as THREE from 'three';
import { getModel, hasModel, MODEL_CONF } from '../models.js';
import { angleDamp, clamp } from '../../core/util.js';
import { MEMES, MEME3D, MEME_SPOTS, CHOIR, ROAD_MEME } from '../../data/text.js';
import { Cardboard } from './cardboard.js';

// 3D 热梗路人：整个模型摆动（不用骨骼），靠近会叫、会做动作，被撞飞会喊
/**
 * 3D 热梗路人。整个模型摆动（不用骨骼），靠近会叫、会做动作，被撞飞会喊。
 * 模型自带骨骼动画（齐天大圣：idle / walk / attack）时改用 AnimationMixer 播。
 */
class Meme extends Cardboard {
  /**
   * @param {THREE.Scene} scene 主场景
   * @param {string} kind 模型名（MODEL_CONF / MEME3D 的键）
   */
  constructor(scene, kind) {
    const inner = new THREE.Group(), root = new THREE.Group(), model = getModel(kind);
    inner.add(model); root.add(inner);
    super(scene, { root });
    const m = MEME3D[kind];
    this.kind = kind; this.inner = inner; this.meme = { name: m.name, line: m.say, ...m };
    this.bubY = 2.3; this.emoteT = 0; this.cool = Math.random() * 4; this.deadT = 0; this.bounce = 0.05;
    // 模型自带骨骼动画（齐天大圣：idle / walk / attack）就用 AnimationMixer 播
    if (model.animations && model.animations.length) {
      this.mixer = new THREE.AnimationMixer(model); this.acts = {};
      for (const c of model.animations) this.acts[c.name] = this.mixer.clipAction(c);
      this.play('idle');
    }
  }
  /**
   * 切骨骼动画。
   * @param {string} name 片段名
   * @param {number} [fade] 淡入时长（秒），默认 0.25
   * @returns {void}
   */
  play(name, fade = 0.25) {
    const a = this.acts && this.acts[name];
    if (!a || this.curAct === a) return;
    a.reset().fadeIn(fade).play();
    if (this.curAct) this.curAct.fadeOut(fade);
    this.curAct = a;
  }
  // 靠近时：转身看奶蛙，做一个动作，放叫声
  /**
   * 靠近时：转身看奶蛙，做一个动作，放叫声。
   * @param {import('../../audio/audio.js').Audio} audio 音频
   * @returns {void}
   */
  emote(audio) {
    this.emoteT = 1.6; this.cool = 9 + Math.random() * 5;
    this.say(this.meme.say);
    if (this.meme.sfx) audio.play(this.meme.sfx[0], { vol: 0.55, meme: true });
    else if (this.meme.emote === 'anim') audio.whoosh(); // 大圣抡棒子
    else audio.pop();
  }
  /**
   * 摆姿势：按 meme.move 摆动，emoteT 期间做动作。
   * @param {number} dt 帧间隔（秒）
   * @param {number} t 全局时间（秒）
   * @returns {void}
   */
  pose(dt, t) {
    const m = this.meme, i = this.inner;
    i.position.set(0, 0, 0); i.rotation.set(0, 0, 0); i.scale.set(1, 1, 1);
    if (this.mixer) {
      this.play(this.emoteT > 0 && m.emote === 'anim' ? 'attack' : this.follow >= 0 ? 'walk' : 'idle');
      this.mixer.update(dt);
      return;
    }
    if (this.deadT > 0) { i.rotation.z = Math.PI / 2; i.position.y = 0.35; return; } // 负鼠装死
    if (m.move === 'waddle') { i.rotation.z = Math.sin(this.phase * 1.4) * 0.12; i.position.y = Math.abs(Math.sin(this.phase * 1.4)) * 0.05; }
    else if (m.move === 'hop') i.position.y = Math.abs(Math.sin(this.phase * 0.9)) * 0.22;
    else if (m.move === 'sway') { i.rotation.z = Math.sin(t * 2.2 + this.phase) * 0.14; i.scale.y = 1 + Math.sin(t * 4.4) * 0.04; }
    else i.scale.y = 1 + Math.sin(t * 2 + this.phase) * 0.025; // still：喘气
    if (this.emoteT > 0) {
      const k = this.emoteT, e = m.emote;
      if (e === 'spin') i.rotation.y = (1.6 - k) * 26; // OIIA 原地狂转
      else if (e === 'chop') i.rotation.x = Math.max(0, Math.sin((1.6 - k) * 9)) * 0.5; // 刀往前劈
      else if (e === 'elbow') i.rotation.y = Math.sin((1.6 - k) * 12) * 0.9; // 扭身肘击
      else if (e === 'cry') { i.rotation.z = Math.sin(t * 30) * 0.08; i.scale.y = 1 + Math.sin(t * 18) * 0.08; } // 哭到发抖
      else i.position.y += Math.abs(Math.sin((1.6 - k) * 7)) * 0.5;
    }
  }
}

/**
 * 路人管理器：纸板立牌 + 3D 热梗路人 + 合唱团。负责闲逛、跟队、叠罗汉、甩飞、合唱。
 */
export class Peds {
  /**
   * @param {THREE.Scene} scene 主场景
   * @param {object} world 世界（heightAt / col.resolve）
   */
  constructor(scene, world) {
    this.list = []; this.world = world;
    // 纸板立牌：围着中央广场
    MEMES.forEach((m, i) => {
      const a = (i / MEMES.length) * Math.PI * 2 + 0.3;
      const c = new Cardboard(scene, { name: m.name, color: m.color, face: m.face });
      c.meme = m; c.home = new THREE.Vector3(Math.cos(a) * 31, 0, Math.sin(a) * 31);
      this.list.push(c);
    });
    // 3D 热梗路人：在外卖路线两边；合唱团排在东京街
    this.choir = [];
    for (const [kind, x, z, choir] of [...MEME_SPOTS, ...CHOIR.map((s) => [...s, true])]) {
      if (!hasModel(kind)) continue;
      const c = new Meme(scene, kind);
      c.home = new THREE.Vector3(x, 0, z);
      if (ROAD_MEME.has(`${x},${z}`)) { c.meme.move = 'still'; c.onRoad = true; }
      if (choir) { c.meme.move = 'still'; this.choir.push(c); }
      this.list.push(c);
    }
    for (const c of this.list) {
      c.root.position.copy(c.home); c.target = c.home.clone(); c.wait = Math.random() * 3; c.follow = -1; c.stack = -1; c.nostack = 0;
      c.hgt = c instanceof Meme ? (MODEL_CONF[c.kind].h || 1.4) : 1.8;
      c.yaw = c.onRoad ? Math.PI / 2 : Math.random() * 6; c.root.rotation.y = c.yaw;
    }
    for (const c of this.choir) c.yaw = 0; // 合唱团面朝马路
    this.squad = []; this.stack = []; this.t = 0; this.choirT = -99; this.stackT = 0;
  }

  // 叠罗汉：骑车撞上去，它弹起来叠到电驴上
  /**
   * 叠罗汉：骑车撞上去，它弹起来叠到电驴上。
   * @param {Cardboard} c 被叠上去的路人
   * @param {import('../player.js').Player} player 玩家
   * @param {object} ui UI（danmaku）
   * @param {import('../../audio/audio.js').Audio} audio 音频
   * @returns {void}
   */
  addStack(c, player, ui, audio) {
    c.stack = this.stack.length; this.stack.push(c); this.stackT = 0;
    c.say(this.stack.length === 1 ? '带我一个！' : this.stack.length === 2 ? '再叠一个！' : '叠到顶了！');
    audio.boing(); if (c.meme.sfx) audio.play(c.meme.sfx[0], { vol: 0.5, meme: true });
    ui.danmaku(['叠罗汉开始了', '电驴超载了哈哈', '交警在路上', '这能过弯吗'][this.stack.length - 1] || '叠罗汉', true);
    player.emit({ type: 'stack', n: this.stack.length });
  }

  // 全甩飞：往外侧飞出去，落地后就在那里站着
  /**
   * 全甩飞：往外侧飞出去，落地后就在那里站着。
   * @param {import('../player.js').Player} player 玩家
   * @param {object} ui UI（burst）
   * @param {import('../../audio/audio.js').Audio} audio 音频
   * @param {string} why 甩飞原因（显示在弹幕里）
   * @returns {void}
   */
  fling(player, ui, audio, why) {
    if (!this.stack.length) return;
    const side = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw)).multiplyScalar(player.lean > 0 ? -1 : 1);
    for (const c of this.stack) {
      c.stack = -1; c.nostack = 3; c.reHome = true;
      const v = side.clone().multiplyScalar(10 + Math.random() * 8).addScaledVector(player.heading(), player.speed * 0.6);
      c.flying = false; c.knock(c.root.position.clone().sub(side), v);
      c.vel.y = 10 + Math.random() * 6;
      c.say(c instanceof Meme ? c.meme.hit : '啊——');
    }
    audio.crash(); audio.play('shanshen', { vol: 0.4 });
    ui.burst([why, `${this.stack.length} 个全甩飞了`, '物理引擎是认真的', '叠罗汉失败'], 4);
    player.emit({ type: 'fling', n: this.stack.length });
    this.stack = [];
  }

  // 合唱：刀盾狗和咕咕嘎嘎一起喊，越喊越快
  /**
   * 合唱：刀盾狗和咕咕嘎嘎一起喊，越喊越快。
   * @param {import('../../audio/audio.js').Audio} audio 音频
   * @param {object} ui UI（burst）
   * @returns {void}
   */
  sing(audio, ui) {
    this.choirT = this.t;
    const seq = ['daodun1', 'gugu1', 'daodun1', 'gugu1', 'daodun1', 'gugu1', 'daodun1', 'gugu1', 'oiia1'];
    let at = 0;
    seq.forEach((k, i) => {
      const rate = 1 + i * 0.14;
      audio.play(k, { vol: 0.55, rate, delay: at });
      setTimeout(() => this.choir.forEach((c, j) => { if ((j + i) % 2 === 0) { c.emoteT = 0.5; c.meme.emote = 'hop'; } }), at * 1000);
      at += Math.max(0.28, 0.75 - i * 0.07);
    });
    setTimeout(() => { this.choir.forEach((c) => { c.emoteT = 1.6; c.meme.emote = 'spin'; }); }, at * 1000);
    this.choir.forEach((c, j) => setTimeout(() => c.say(j % 2 ? '咕咕嘎嘎！' : '我的刀盾！'), j * 180));
    ui.burst(['合唱开始了', '我的刀盾咕咕嘎嘎', '越唱越快了', '这是什么乐队', '已经洗脑了'], 6);
  }
  /**
   * 每帧更新所有路人：叠罗汉、合唱、跟队、招募、闲逛。
   * @param {number} dt 帧间隔（秒）
   * @param {import('../player.js').Player} player 玩家
   * @param {object} ui UI（danmaku / burst）
   * @param {import('../../audio/audio.js').Audio} audio 音频
   * @param {import('../../gfx/fx.js').Particles} fx 粒子
   * @returns {void}
   */
  update(dt, player, ui, audio, fx) {
    this.t += dt; this.stackT += dt;
    // 叠罗汉：转弯太急、下车、不在电驴上了，全甩飞
    if (this.stack.length) {
      if (player.mode !== 'bike' || player.pancakeT > 0) this.fling(player, ui, audio, player.pancakeT > 0 ? '撞墙了全飞了' : '下车了全飞了');
      else if (this.stackT > 2 && (player.lateral || 0) > 26) this.fling(player, ui, audio, '转弯太急了！！');
    }
    // 合唱团：奶蛙骑过来就开唱
    if (this.choir.length > 1 && this.t - this.choirT > 30) {
      const c0 = this.choir[2] || this.choir[0];
      if (c0.root.position.distanceTo(player.pos) < 26) this.sing(audio, ui);
    }
    let stackY = 0;
    for (const c of this.list) {
      c.tickBubble(dt);
      const is3d = c instanceof Meme;
      if (is3d) { c.emoteT = Math.max(0, c.emoteT - dt); c.cool -= dt; c.deadT = Math.max(0, c.deadT - dt); }
      c.nostack = Math.max(0, c.nostack - dt);
      if (c.stack >= 0) {
        // 叠在电驴上：一个摞一个，跟着车身左右晃，越高晃得越厉害
        const i = c.stack, base = 1.7 + this.stack.slice(0, i).reduce((s, o) => s + o.hgt * 0.92, 0);
        const sway = player.lean * (1.2 + i * 0.9) + Math.sin(this.t * 7 + i) * 0.04 * (i + 1);
        const side = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
        c.root.position.copy(player.pos).addScaledVector(side, -Math.sin(sway) * base * 0.6).add(new THREE.Vector3(0, base + player.pos.y * 0 , 0));
        c.root.position.addScaledVector(player.heading(), -0.4);
        c.yaw = player.yaw; c.root.rotation.set(0, c.yaw, sway);
        if (is3d) c.pose(dt, this.t);
        stackY = base;
        continue;
      }
      if (c.physics(dt, this.world)) { if (!c.flying && is3d && c.meme.dead) c.deadT = 5; continue; }
      if (c.reHome) { c.reHome = false; c.home.copy(c.root.position).setY(0); c.target.copy(c.home); c.onRoad = false; }
      if (is3d) c.pose(dt, this.t);
      const dp = c.root.position.distanceTo(player.pos);
      if (player.mode === 'bike' && dp < 2.2 && Math.abs(player.speed) > 5 && c.follow < 0 && this.stack.length < 3 && c.nostack <= 0 && !player.air) {
        this.addStack(c, player, ui, audio);
        continue;
      }
      if (player.mode === 'bike' && dp < 1.7 && Math.abs(player.speed) > 5 && c.follow < 0) {
        if (c.knock(player.pos, player.vel)) {
          audio.boing(); c.say(is3d ? c.meme.hit : '啊——'); player.chaos += 1; player.emit({ type: 'ped', who: c.meme.name }); fx.puff(c.root.position.clone(), 10);
          if (is3d && c.meme.sfx) audio.play(c.meme.sfx[1], { vol: 0.7, meme: true });
        }
        continue;
      }
      if (c.deadT > 0) continue;
      // 奶蛙路过：转过来看，冒句话（同一时间只有一个在叫）
      if (is3d && c.follow < 0 && dp < 11 && c.cool <= 0 && this.t - (this.lastEmote || -9) > 2.2) {
        c.emote(audio); this.lastEmote = this.t;
      }
      if (is3d && c.follow < 0 && dp < 14) c.yaw = angleDamp(c.yaw, Math.atan2(player.pos.x - c.root.position.x, player.pos.z - c.root.position.z), 5, dt);
      if (c.follow >= 0) {
        // 跟队：排在奶蛙身后
        const back = player.heading().multiplyScalar(-(2.5 + c.follow * 1.8));
        const tx = player.pos.x + back.x + (c.follow - 1) * 1.2, tz = player.pos.z + back.z;
        const d = Math.hypot(tx - c.root.position.x, tz - c.root.position.z);
        if (d > 60) c.root.position.set(tx, player.pos.y, tz);
        c.walkTo(dt, tx, tz, clamp(d * 3, 4, 34), this.world);
        continue;
      }
      if (player.mode === 'foot' && dp < 2 && this.squad.length < 3) {
        c.follow = this.squad.length; this.squad.push(c);
        c.say(c.meme.line); audio.coin(); ui.danmaku(`招募：${c.meme.name}`, true);
        if (is3d && c.meme.sfx) audio.play(c.meme.sfx[0], { vol: 0.6, meme: true });
        player.emit({ type: 'recruit', who: c.meme.name });
        continue;
      }
      // 闲逛：3D 路人只在家门口两三米内走动，“still” 的不走
      if (c.wait > 0 || (is3d && c.meme.move === 'still')) {
        c.wait -= dt; c.root.position.y = this.world.heightAt(c.root.position.x, c.root.position.z);
        if (is3d) c.root.rotation.set(0, c.yaw, 0);
        continue;
      }
      const d = c.walkTo(dt, c.target.x, c.target.z, is3d ? 1.1 : 1.6, this.world);
      if (d < 0.6) {
        const r = is3d ? 3 : 10;
        c.wait = 1.5 + Math.random() * 3; c.target.set(c.home.x + (Math.random() - 0.5) * r, 0, c.home.z + (Math.random() - 0.5) * r * 0.6);
      }
    }
  }
  /**
   * 冲击波：半径内的路人全被炸飞。
   * @param {THREE.Vector3} pos 爆心
   * @param {number} radius 半径（米）
   * @returns {void}
   */
  blast(pos, radius) {
    for (const c of this.list) if (c.root.position.distanceTo(pos) < radius && c.follow < 0) c.knock(pos, new THREE.Vector3(0, 0, 0).add(c.root.position).sub(pos).setY(0).normalize().multiplyScalar(30));
  }
}
