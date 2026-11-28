// 画质：360P 灰盒、升级回全特效、辉光与烟花、天空的云。
// 全部从 game/game.js 原样搬出，逻辑一字未改。
import * as THREE from 'three';
import { makeCanvas } from '../core/util.js';
import { lerp, smooth } from '../core/math.js';
import { LINES } from '../data/text.js';

// ---------- 360P 灰盒 ----------
/**
 * 摔成饼：切 360P 省算力模式，画面降级。
 * @param {import('./game.js').Game} game
 * @returns {void}
 */
export function goGray(game) {
  const g = game.pipe.g; g.uLow.value = 1; g.uReveal.value = 0;
  game.pipe.bloom.strength = 0;
  game.ui.setQuality('画质：360P 省算力模式', true);
  game.line(LINES.splat[0], 4.5);
  game.ui.objective('骑上小电驴（找金色光柱，靠近按 E）');
  // 已经骑上了就不再催（那时 phase 已变成 order）
  game.tl.at(5, () => { if (game.phase) return; game.line(LINES.splat[1], 3.5); game.phase = 'getbike'; });
  game.ui.burst(['摔成饼了哈哈哈', '360P 是认真的吗', '我的眼睛', '活人感 3%'], 6);
  game.pipe.shake = 1.2;
}

/**
 * 骑上电驴：画质升级回全特效。
 * @param {import('./game.js').Game} game
 * @returns {void}
 */
export function upgrade(game) {
  game.upT = 0.001; game.audio.upgrade();
  game.meter = Math.max(game.meter, 20); game.ui.setMeter(game.meter);
  game.ui.setQuality('画质：全特效');
  game.line(LINES.upgrade, 4);
  game.ui.burst(['卧槽画质', '这是同一个游戏？', '3A 大作', '活过来了'], 6);
}

/**
 * 画质过渡：升级时的揭示动画、夜间辉光、自由模式的海上烟花。
 * @param {import('./game.js').Game} game
 * @param {number} dt 帧间隔（秒）
 * @returns {void}
 */
export function updateGrade(game, dt) {
  const g = game.pipe.g;
  if (game.upT > 0) {
    game.upT += dt;
    g.uReveal.value = smooth(0, 2.4, game.upT) * 1.8;
    game.pipe.bloom.strength = 0.35 * smooth(0.5, 2.4, game.upT);
    if (game.upT > 2.5) { g.uLow.value = 0; game.upT = 0; }
  }
  // 夜里辉光更强
  if (!g.uLow.value) game.pipe.bloom.strength = game.state === 'hall' || game.state === 'title' ? 0.3 : lerp(0.3, 0.6, game.env.night);
  if (game.state === 'free' && !game.districtTrip && Math.random() < dt * 1.5) {
    game.fx.firework(new THREE.Vector3((Math.random() - 0.5) * 300, 70 + Math.random() * 80, 300 + Math.random() * 120));
  }
}

/**
 * 天空的云：一张画布贴图，70 个精灵撒在岛周围。
 * @param {import('./game.js').Game} game
 * @param {THREE.Scene} s 世界场景
 * @returns {void}
 */
export function clouds(game, s) {
  const [c, x] = makeCanvas(256, 256);
  for (let i = 0; i < 30; i++) {
    const gx = 60 + Math.random() * 136, gy = 70 + Math.random() * 116, r = 30 + Math.random() * 50;
    const gr = x.createRadialGradient(gx, gy, 0, gx, gy, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 256, 256);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  game.cloudMat = new THREE.SpriteMaterial({ map: t, color: 0xffe2c4, transparent: true, opacity: 0.55, depthWrite: false, fog: false });
  for (let i = 0; i < 70; i++) {
    const sp = new THREE.Sprite(game.cloudMat);
    const a = Math.random() * Math.PI * 2, r = Math.random() * 380;
    sp.position.set(Math.cos(a) * r, 230 + Math.random() * 90, Math.sin(a) * r);
    if (Math.hypot(sp.position.x + 30, sp.position.z + 40) < 90) sp.position.x += 180;
    sp.scale.setScalar(70 + Math.random() * 90);
    s.add(sp);
  }
}
