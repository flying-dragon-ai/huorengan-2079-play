// 被催星：撞得越狠追的人越多，甩掉之后掉星；还有“活人感过高”警告。
// 全部从 game/game.js 原样搬出，逻辑一字未改。
import * as THREE from 'three';
import { Chaser } from '../actors/npc/index.js';
import { STAR_AT, KINDS } from '../data/quest-config.js';

/** 平面坐标转世界坐标点（与 data/quest-config.js 里的同名工具一致）。
 * @param {number} x
 * @param {number} z
 * @returns {THREE.Vector3} y 恒为 0
 */
const V = (x, z) => new THREE.Vector3(x, 0, z);

/**
 * 被催星：按 chaos 值放追人 NPC，甩掉超过 5 秒的掉星。
 * @param {import('./game.js').Game} game
 * @param {number} dt 帧间隔（秒）
 * @returns {void}
 */
export function updateWanted(game, dt) {
  if (game.reboot?.isMortgaged('bond')) {
    if (game.chasers.length) clearChasers(game);
    return;
  }
  if (game.phase !== 'deliver' && game.phase !== 'loop') return;
  const p = game.player;
  const want = STAR_AT.filter((s) => p.chaos >= s).length;
  while (game.stars < want) {
    const kind = KINDS[game.stars];
    const back = p.heading().multiplyScalar(-35);
    const c = new Chaser(game.world, kind, p.pos.clone().add(back).add(V((Math.random() - 0.5) * 8, 0)));
    game.chasers.push(c); game.stars++;
    game.maxStars = Math.max(game.maxStars || 0, game.stars);
    game.audio.tone('square', 880, 440, 0.4, 0.15);
    game.ui.danmaku(`被催 ${game.stars} 星：${['妈妈', '班主任', '七大姑八大姨'][game.stars - 1]}出动`, true);
  }
  for (const c of game.chasers) {
    c.update(dt, p, game.island);
    c.nagCool = Math.max(0, (c.nagCool || 0) - dt);
    if (game.phase === 'loop' && !c.flying && c.nagCool <= 0 && c.root.position.distanceTo(p.pos) < 2.2) {
      c.nagCool = 4.5;
      if (game.anchors) game.anchors.timeLeft = Math.max(1, game.anchors.timeLeft - 3);
      p.speed *= 0.45;
      game.pipe.shake = 0.45;
      game.audio.crash();
      const q = c.lines[Math.floor(Math.random() * c.lines.length)];
      c.say(q);
      game.ui.danmaku(`被亲戚拦住问「${q}」耗时 -3s！`, true);
    }
  }
  const lost = game.chasers.find((c) => c.lost > 5);
  if (lost) {
    lost.remove(); game.chasers = game.chasers.filter((c) => c !== lost);
    game.stars--; p.chaos = game.stars ? STAR_AT[game.stars - 1] : 0;
    game.ui.danmaku('甩掉了一个！', true);
  }
  game.ui.setStars(game.stars);
}

/**
 * 清空所有追人 NPC，星数归零。
 * @param {import('./game.js').Game} game
 * @returns {void}
 */
export function clearChasers(game) {
  game.chasers.forEach((c) => c.remove()); game.chasers = []; game.stars = 0; game.ui.setStars(0);
}

// ---------- 活人感过高 ----------
/**
 * 活人感过高警告：开太快或者飞太高。
 * @param {import('./game.js').Game} game
 * @param {string} why 触发原因，显示在弹窗里
 * @returns {void}
 */
export function warnAlive(game, why) {
  game.warnAt = game.time;
  game.ui.popup(`<h3>⚠ 检测到活人感过高</h3><p>${why}</p><p>请保持 AI 推荐的麻木状态</p>`, 'warn', 2.6);
  game.audio.tone('square', 880, 440, 0.25, 0.2); game.audio.tone('square', 880, 440, 0.25, 0.2, 0.3);
  game.audio.say('检测到活人感过高，请慢一点', { pitch: 0.8 });
  game.pipe.g.uCA.value = 3; game.tl.at(0.6, () => { game.pipe.g.uCA.value = 0.35; });
  game.ui.burst(['被 AI 抓到了', '活人感超标', '慢一点就是麻木', '我偏不'], 4);
}
