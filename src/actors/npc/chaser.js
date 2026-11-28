// 追兵：妈妈、班主任、七大姨，举着牌子追
import * as THREE from 'three';
import { makeCanvas, canvasTex, clamp } from '../../core/util.js';
import { LINES } from '../../data/text.js';
import { Cardboard } from './cardboard.js';

// 举牌：一块写着字的牌子，字可以换
function signBoard() {
  const [c, x] = makeCanvas(256, 128), tex = canvasTex(c);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  const g = new THREE.Group();
  // 正反两面各一块，这样从哪边看字都是正的
  const mat = new THREE.MeshBasicMaterial({ map: tex });
  for (const ry of [0, Math.PI]) {
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), mat);
    board.position.y = 0.9; board.rotation.y = ry; g.add(board);
  }
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1), new THREE.MeshStandardMaterial({ color: 0x7a5a3a }));
  stick.position.y = 0.3; g.add(stick);
  g.write = (t) => {
    x.fillStyle = '#fff8e8'; x.fillRect(0, 0, 256, 128); x.strokeStyle = '#d02020'; x.lineWidth = 10; x.strokeRect(5, 5, 246, 118);
    let s = 64; x.font = `900 ${s}px "PingFang SC"`;
    while (x.measureText(t).width > 230 && s > 24) { s -= 4; x.font = `900 ${s}px "PingFang SC"`; }
    x.fillStyle = '#c01818'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t, 128, 66);
    tex.needsUpdate = true;
  };
  return g;
}

/**
 * 追兵——举着牌子追玩家的纸板立牌。牌子越追越大，字隔几秒换一句。
 */
export class Chaser extends Cardboard {
  // custom：街区里的亲戚可以自定义 { name, color, face, lines }
  /**
   * @param {THREE.Scene} scene 主场景
   * @param {'mom'|'teacher'|'aunt'} kind 预设种类
   * @param {THREE.Vector3} pos 初始位置
   * @param {{name: string, color: string, face?: string, lines?: string[]}|null} [custom] 自定义外观与台词
   */
  constructor(scene, kind, pos, custom = null) {
    const conf = custom ? [custom.name, custom.color, custom.face || 'grin'] : { mom: ['妈妈', '#ff8fb1', 'grin'], teacher: ['班主任', '#8fb8ff', 'calm'], aunt: ['七大姨', '#ffb36b', 'star'] }[kind];
    super(scene, { name: conf[0], color: conf[1], face: conf[2], h: 2.0 });
    this.kind = kind; this.root.position.copy(pos); this.lost = 0; this.lineT = 1;
    this.lines = (custom && custom.lines) || LINES.chasers[kind];
    this.scene = scene;
    // 举着牌子追：牌子越追越大，字隔几秒换一句
    this.sign = signBoard(); this.sign.position.set(0.7, 1.9, 0.1); this.root.add(this.sign);
    this.age = 0; this.signT = 0; this.signI = Math.floor(Math.random() * 9);
    this.sign.write(this.lines[this.signI % this.lines.length]);
    this.bubY = 4.2;
  }
  /**
   * 每帧更新：牌子放大换字、追玩家、喊话、被车撞飞。
   * @param {number} dt 帧间隔（秒）
   * @param {import('../player.js').Player} player 玩家
   * @param {object} world 世界（heightAt / col.resolve）
   * @returns {void}
   */
  update(dt, player, world) {
    this.tickBubble(dt);
    this.age += dt;
    const k = Math.min(3.6, 1 + this.age * 0.12);
    this.sign.scale.setScalar(k); this.sign.rotation.z = Math.sin(this.age * 7) * 0.12;
    if ((this.signT -= dt) <= 0) { this.signT = 3; const l = this.lines; this.sign.write(l[++this.signI % l.length]); }
    if (this.physics(dt, world)) return;
    const ps = player.mode === 'bike' ? Math.abs(player.speed) : 8;
    const sp = clamp(ps * 0.9 + 3, 8, 23);
    const d = this.walkTo(dt, player.pos.x, player.pos.z, sp, world);
    if ((this.lineT -= dt) <= 0) { const l = this.lines; this.say(l[Math.floor(Math.random() * l.length)]); this.lineT = 3.5 + Math.random() * 2; }
    if (d < 1.6 && player.mode === 'bike' && Math.abs(player.speed) > 6) this.knock(player.pos, player.vel);
    this.lost = d > 75 ? this.lost + dt : 0;
  }
  /** 从场景里摘掉。 @returns {void} */
  remove() { this.scene.remove(this.root); }
}
