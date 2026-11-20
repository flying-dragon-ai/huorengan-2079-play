// 自动驾驶与角色事件：auto 模式的虚拟输入、袋鼠抢单、大奶蛙变身、上车、碰撞事件。
// 全部从 game/game.js 原样搬出，逻辑一字未改。
import * as THREE from 'three';
import { getModel } from '../actors/models.js';
import { angleDamp } from '../core/math.js';
import { LINES } from '../data/text.js';
import { ROUTE_CAFE } from '../data/quest-config.js';

/** 平面坐标转世界坐标点（与 data/quest-config.js 里的同名工具一致）。
 * @param {number} x
 * @param {number} z
 * @returns {THREE.Vector3} y 恒为 0
 */
const V = (x, z) => new THREE.Vector3(x, 0, z);

/**
 * auto 模式的虚拟输入：按阶段自己走、自己骑、自己按 E。
 * @param {import('./game.js').Game} game
 * @returns {{move?: number[], run?: boolean, interact?: boolean, target?: THREE.Vector3|null, slow?: boolean, laugh?: boolean}} 虚拟输入
 */
export function autoDrive(game) {
  const p = game.player, v = { };
  if (p.mode === 'dive') { const d = V(4, 36).sub(p.pos).setY(0); v.move = d.length() > 3 ? [d.x / d.length(), d.z / d.length()] : [0, 0]; }
  else if (p.mode === 'foot') {
    if (game.phase === 'getbike') { const d = p.bike.position.clone().sub(p.pos).setY(0); const l = d.length(); v.move = l > 1 ? [d.x / l, d.z / l] : [0, 0]; v.run = true; if (p.canMount()) v.interact = true; }
    else v.move = [0, 0];
    if (game.state === 'free') v.move = [0, 0];
  } else if (p.mode === 'bike') {
    const route = game.route;
    if (route && game.wp < route.length) {
      v.target = route[game.wp];
      if (p.pos.distanceTo(v.target.clone().setY(p.pos.y)) < 7) game.wp++;
      if (game.wp >= route.length) v.target = null;
    }
    if (!v.target) v.target = null;
    if (game.phase === 'laughReady' && !v.target) { v.target = null; v.laugh = true; }
    if (!v.target) { v.target = p.pos.clone().add(p.heading()); v.slow = true; p.speed *= 0.95; }
  }
  return v;
}

/**
 * 袋鼠抢单：快到七大姑那里时袋鼠冲刺，先到就跳舞、当面喝咖啡。
 * @param {import('./game.js').Game} game
 * @returns {void}
 */
export function updateKangaroo(game) {
  const k = game.kanga;
  if (game.phase !== 'deliver') return;
  if (k.active && !k.sprint && game.player.pos.distanceTo(game.island.auntSpot) < 75) {
    k.sprint = true; k.say('冲刺！我口袋大！'); game.ui.danmaku('袋鼠开始冲刺了！', true);
  }
  if (k.done && !k.taunt) {
    k.startTaunt(game.audio);
    game.ui.banner('袋鼠先到了！', '它正在当面喝你的咖啡'); game.ui.burst(['袋鼠赢了哈哈', '咖啡被喝了', '袋鼠在跳舞', '输给袋鼠了'], 6);
  }
}

// ---------- 大奶蛙：捧腹大笑变身 ----------
/**
 * 造大奶蛙：模型 + 身前补光，初始隐藏。
 * @param {import('./game.js').Game} game
 * @param {THREE.Scene} s 世界场景
 * @returns {void}
 */
export function makeBigFrog(game, s) {
  const g = new THREE.Group(), model = getModel('bigfrog');
  g.rotation.order = 'YXZ'; // 先转向镜头，再按自己的朝向前后摇
  g.add(model); g.visible = false; s.add(g);
  // 夜里也要看清大奶蛙：身前打一盏暖色补光。灯一直在场景里（亮度 0），
  // 不放进隐藏的组里，否则它一出现，场景灯数一变，所有材质都要重编译，会卡一下
  const lamp = new THREE.PointLight(0xffd9a0, 0, 45, 1.6);
  s.add(lamp);
  const bones = {}, rest = {};
  model.traverse((o) => { if (o.isBone) { const k = o.name.replace(/[^A-Za-z]/g, ''); bones[k] = o; rest[k] = o.quaternion.clone(); } });
  game.big = { g, lamp, bones, rest, t: 0, s: 0.01, target: 0, laugh: 0, yaw: 0, q: new THREE.Quaternion(), ax: { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) } };
}

/**
 * 笑得前仰后合：骨骼的转法照搬《奶蛙缝合版》，外面整个身子再前后摇。
 * @param {import('./game.js').Game} game
 * @param {number} dt 帧间隔（秒）
 * @returns {void}
 */
export function updateBigFrog(game, dt) {
  const B = game.big;
  if (!B || !B.g.visible) return;
  B.t += dt;
  const t = B.t, L = B.laugh;
  B.s += (B.target - B.s) * (1 - Math.exp(-(B.target > B.s ? 6 : 9) * dt));
  const pop = B.target > 0 ? 1 + Math.sin(Math.min(t, 0.6) * 10.5) * 0.12 * Math.max(0, 1 - t / 0.6) : 1;
  B.g.scale.setScalar(Math.max(0.01, B.s * pop));
  const turn = (name, axis, ang) => { const b = B.bones[name]; if (b) b.quaternion.copy(B.rest[name]).multiply(B.q.setFromAxisAngle(B.ax[axis], ang)); };
  const a = Math.sin(t * 15), b = Math.sin(t * 15 + 1.2);
  turn('Pelvis', 'z', L * a * 0.04);
  turn('Chest', 'z', L * (0.12 + a * 0.07)); B.bones.Chest && B.bones.Chest.quaternion.multiply(B.q.setFromAxisAngle(B.ax.x, L * Math.sin(t * 7) * 0.06));
  turn('Head', 'z', L * (0.3 + b * 0.15)); B.bones.Head && B.bones.Head.quaternion.multiply(B.q.setFromAxisAngle(B.ax.x, L * Math.sin(t * 5) * 0.08));
  turn('UpperArmL', 'z', L * a * 0.06); turn('UpperArmR', 'z', L * b * 0.06);
  B.g.rotation.x = Math.sin(t * 6.5) * 0.14 * L; B.g.rotation.z = Math.sin(t * 3.3) * 0.05 * L;
  B.g.rotation.y = angleDamp(B.g.rotation.y, B.yaw, 3, dt); // 慢慢转向镜头
  const k = Math.max(0.01, B.s);
  B.lamp.position.set(B.g.position.x + Math.sin(B.g.rotation.y) * 2.6 * k, B.g.position.y + 1.5 * k, B.g.position.z + Math.cos(B.g.rotation.y) * 2.6 * k);
  B.lamp.intensity = Math.min(1, B.s / 6) * 190 * (0.5 + game.env.night * 0.7);
  if (B.target === 0 && B.s < 0.03) { B.g.visible = false; B.lamp.intensity = 0; }
}

/**
 * 骑上小电驴：画质恢复、接单、设路线。
 * @param {import('./game.js').Game} game
 * @returns {void}
 */
export function onMount(game) {
  // 落地后马上就骑上也算（那时 phase 还没设成 getbike）
  if (game.phase === 'getbike' || (game.state === 'roam' && !game.phase)) {
    game.setMarker(null);
    game.upgrade();
    game.mounted = true;
    game.tl.at(0.6, () => game.ui.banner('画质恢复！', '活人感 +20%'));
    game.phase = 'order';
    game.ui.objective('');
    game.tl.at(4, () => {
      game.audio.ding(); game.ui.phoneMsg('妈妈', '外卖单：一杯八十的咖啡 → 海边七大姑');
      game.line(LINES.orderIn, 5);
      game.phase = 'pickup'; game.ui.objective('去魔都弄堂咖啡店取餐（西方明珠塔下）');
      game.setMarker(game.island.cafe); game.missionT = 150; game.missionStart = game.time;
      game.setRoute(ROUTE_CAFE);
    });
  }
}

/**
 * 玩家事件：摔成饼、起飞、撞墙、撞飞摊位、叠罗汉、全甩飞。
 * @param {import('./game.js').Game} game
 * @param {string|{type: string, n?: number, who?: string}} e 事件名或事件对象
 * @returns {void}
 */
export function onEvent(game, e) {
  if (e === 'splat') { game.state = 'roam'; game.goGray(); return; }
  if (e === 'unsplat') { game.ui.danmaku('弹回来了', true); return; }
  if (e === 'air') { if (Math.random() < 0.7) game.ui.danmaku(['起飞！', '电驴会飞', '物理引擎是认真的', '这一跳我给满分'][Math.floor(Math.random() * 4)], true); game.audio.whoosh(); return; }
  if (e === 'crash') { game.pipe.shake = 0.6; game.ui.danmaku('撞墙了哈哈哈'); return; }
  if (e.type === 'props') { game.pipe.shake = Math.max(game.pipe.shake, 0.35); if (Math.random() < 0.4) game.ui.danmaku(['摊位：我招谁惹谁了', '撞飞了哈哈', '城管在路上', '水果漫天飞'][Math.floor(Math.random() * 4)]); game.laugh += 4 * e.n; }
  if (e.type === 'ped') { game.ui.danmaku(`${e.who}：我做错了什么`, true); game.laugh += 6; }
  if (e.type === 'recruit') { game.laugh += 5; game.guide.stats.recruited = true; }
  if (e.type === 'stack') { game.laugh += 6; game.guide.stats.recruited = true; game.guide.stats.stacked = true; if (e.n === 3) game.ui.banner('叠罗汉 ×3！', '转弯慢点，不然全甩飞'); }
  if (e.type === 'fling') { game.laugh += 10; game.pipe.shake = 0.7; game.ui.banner('全甩飞了！', `${e.n} 个梗角色已起飞`); }
  if (e === 'pancake') { game.laugh += 8; game.pipe.shake = 0.9; game.ui.burst(['摔成饼了', '啪叽', '哈哈哈哈哈', '撞墙专业户', '又是一张饼'], 6); }
}
