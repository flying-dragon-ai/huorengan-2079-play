// 新手指引：左上角的指引框（一步一步教，做到了就打勾）、屏幕上的目的地标记、小地图导航线、H 操作说明
import * as THREE from 'three';
import { XR, ZR, BEACH_Z, ROAD_W } from '../core/config.js';

const $ = (id) => document.getElementById(id);
const K = (...keys) => keys.map((k) => `<kbd>${k}</kbd>`).join('');

// 每一步：when 什么时候出现，done 什么时候算完成，wait 最多等几秒就自动跳过（可选步骤）
const STEPS = [
  { id: 'dive', when: (g) => g.state === 'dive', done: (g) => g.player.mode !== 'dive',
    text: () => `按住 ${K('W', 'A', 'S', 'D')} 控制下落方向<br>落到<b>金色光柱</b>那里 · ${K('空格')} 开伞` },
  { id: 'walk', when: (g) => g.player.mode === 'foot', done: (g, s) => s.walked > 4, skipIf: (g) => g.player.mode === 'bike',
    text: () => `${K('W', 'A', 'S', 'D')} 走路 · 按住 ${K('Shift')} 跑` },
  { id: 'look', when: (g) => g.player.mode === 'foot', done: (g, s) => s.mouse > 260, wait: 7, autoWait: 2.5, skipIf: (g) => g.player.mode === 'bike',
    text: () => `先<b>点一下画面</b>，再<b>动鼠标</b>转镜头` },
  { id: 'jump', when: (g) => g.player.mode === 'foot', done: (g, s) => s.jumped, wait: 8, autoWait: 2.5, skipIf: (g) => g.player.mode === 'bike',
    text: () => `按 ${K('空格')} 跳 · 在空中再按一次，二段跳` },
  { id: 'mount', when: (g) => g.player.mode === 'foot' && g.phase === 'getbike', done: (g) => g.player.mode === 'bike',
    text: () => `跟着<b>金色光柱</b>找到小电驴<br>走到它旁边，按 ${K('E')} 骑上` },
  { id: 'ride', when: (g) => g.player.mode === 'bike', done: (g, s) => s.rode > 70,
    text: () => `${K('W')} 油门　${K('S')} 刹车　${K('A')}${K('D')} 转弯<br>按住 ${K('Shift')} 加速` },
  { id: 'nav', when: (g) => g.phase === 'pickup', done: (g) => g.phase !== 'pickup',
    text: () => `跟着<b>地上的金色箭头</b>走<br>屏幕上的 <b class="gold">◆</b> 就是咖啡店` },
  { id: 'map', when: (g) => g.phase === 'pickup' || g.phase === 'deliver', done: (g, s) => s.mapped, wait: 8, autoWait: 3,
    text: () => `迷路了？按 ${K('M')} 打开<b>全岛大地图</b><br>右边的<b>人生任务</b>写着下一步` },
  { id: 'stack', when: (g) => g.phase === 'pickup' || g.phase === 'deliver', done: (g, s) => s.stacked, wait: 9, autoWait: 4,
    text: () => `撞上<b>马路中间的梗角色</b><br>它会叠到你车上 · 转弯太急就<b>全甩飞</b>` },
  { id: 'race', when: (g) => g.phase === 'deliver', done: () => false, wait: 9,
    text: () => `把咖啡送到<b>海边的七大姑</b><br>袋鼠在抢单，别让它先到！` },
  { id: 'wanted', when: (g) => g.stars > 0, done: (g) => g.phase !== 'deliver', wait: 12,
    text: () => `闯祸会<b>被催星</b>，亲戚追上来了<br>骑远一点，就能<b>甩掉</b>他们` },
  { id: 'laugh', when: (g) => g.phase === 'night', done: (g) => g.phase !== 'night',
    text: () => `撞飞摊位、撞飞路人，都会<b>涨笑点</b><br>笑点满了，按 ${K('Q')} 捧腹大笑` },
  { id: 'q', when: (g) => g.phase === 'laughReady', done: (g) => g.phase !== 'laughReady',
    text: () => `笑点满了！按 ${K('Q')} <b>捧腹大笑</b>` },
  { id: 'free', when: (g) => g.phase === 'free', done: (g, s) => s.recruited, wait: 14,
    text: () => `自由闯荡！<b>下车</b>碰一下热梗路人<br>就能招他当队友（最多 3 个）` },
  { id: 'side', when: (g) => (g.phase === 'free' || g.phase === 'night') && g.districts && g.districts.navTarget(), done: (g) => !!(g.districts && g.districts.active), wait: 16,
    text: () => `每个街区都有<b>当地任务</b>：跟着 ◆ 找彩色光圈<br>站进去按 ${K('E')} 接任务，做完涨活人感` },
];

// ---------- 路网导航：十字路口连成图，最短路 ----------
const NODES = [];
const key = (x, z) => `${x},${z}`;
const adj = new Map();
function link(a, b) {
  const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
  adj.get(key(...a)).push([b, d]); adj.get(key(...b)).push([a, d]);
}
for (const x of XR) for (const z of ZR) { NODES.push([x, z]); adj.set(key(x, z), []); }
for (const x of [-150, 150]) { NODES.push([x, BEACH_Z]); adj.set(key(x, BEACH_Z), []); }
for (const x of XR) for (let i = 0; i + 1 < ZR.length; i++) link([x, ZR[i]], [x, ZR[i + 1]]);
for (const z of ZR) for (let i = 0; i + 1 < XR.length; i++) link([XR[i], z], [XR[i + 1], z]);
for (const x of [-150, 150]) link([x, ZR[ZR.length - 1]], [x, BEACH_Z]);
link([-150, BEACH_Z], [150, BEACH_Z]);
// 每条路段：两端点
const SEGS = [];
for (const [k, list] of adj) { const a = k.split(',').map(Number); for (const [b] of list) if (key(...a) < key(...b)) SEGS.push([a, b]); }

// 点到最近的路段上的投影点
export function nearestRoad(x, z) {
  let best = null, bd = Infinity;
  for (const [a, b] of SEGS) {
    const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L2));
    const px = a[0] + dx * t, pz = a[1] + dz * t, d = Math.hypot(x - px, z - pz);
    if (d < bd) { bd = d; best = { x: px, z: pz, a, b, d }; }
  }
  return best;
}

export function routeTo(fx, fz, tx, tz) {
  const s = nearestRoad(fx, fz), e = nearestRoad(tx, tz);
  // 同一条路段上：直接连
  const same = (s.a === e.a && s.b === e.b);
  if (same) return [[fx, fz], [s.x, s.z], [e.x, e.z], [tx, tz]];
  // 起点、终点连到各自路段的两头，再跑一遍 Dijkstra
  const dist = new Map(), prev = new Map(), open = new Set();
  const S = 'S', E = 'E';
  const nb = (k) => {
    if (k === S) return [[s.a, Math.hypot(s.x - s.a[0], s.z - s.a[1])], [s.b, Math.hypot(s.x - s.b[0], s.z - s.b[1])]];
    const out = (adj.get(k) || []).map(([n, d]) => [n, d]);
    const p = k.split(',').map(Number);
    if ((p[0] === e.a[0] && p[1] === e.a[1]) || (p[0] === e.b[0] && p[1] === e.b[1])) out.push([E, Math.hypot(e.x - p[0], e.z - p[1])]);
    return out;
  };
  dist.set(S, 0); open.add(S);
  while (open.size) {
    let u = null, ud = Infinity;
    for (const k of open) if (dist.get(k) < ud) { ud = dist.get(k); u = k; }
    open.delete(u);
    if (u === E) break;
    for (const [n, d] of nb(u)) {
      const k = n === E ? E : key(...n), nd = ud + d;
      if (nd < (dist.has(k) ? dist.get(k) : Infinity)) { dist.set(k, nd); prev.set(k, u); open.add(k); }
    }
  }
  const pts = [[tx, tz], [e.x, e.z]];
  let k = prev.get(E);
  while (k && k !== S) { pts.push(k.split(',').map(Number)); k = prev.get(k); }
  pts.push([s.x, s.z], [fx, fz]);
  return pts.reverse();
}

export class Guide {
  constructor(game) {
    this.g = game; this.box = $('guide'); this.txt = $('guide-txt'); this.step = $('guide-step');
    this.wp = $('wp'); this.wpLabel = $('wp-label'); this.wpDist = $('wp-dist'); this.wpArrow = $('wp-arrow');
    this.help = $('help'); this.helpGoal = $('help-goal');
    this.i = -1; this.cur = null; this.t = 0; this.doneT = 0; this.stats = { walked: 0, mouse: 0, jumped: false, rode: 0, recruited: false };
    this.finished = new Set(); this.route = null; this.routeT = 0; this.v = new THREE.Vector3();
    this.lastPos = null; this.stuckT = 0; this.stuckShown = 0;
  }

  // 每帧：统计玩家做了什么，推进指引
  update(dt) {
    const g = this.g, p = g.player, s = this.stats;
    if (this.lastPos && p.mode !== 'dive') {
      const d = Math.hypot(p.pos.x - this.lastPos.x, p.pos.z - this.lastPos.z);
      if (d < 5) { if (p.mode === 'foot') s.walked += d; if (p.mode === 'bike') s.rode += d; }
    }
    this.lastPos = p.pos.clone();
    s.mouse += Math.abs(g.input.mdx) + Math.abs(g.input.mdy);
    if (p.mode === 'foot' && p.jumps > 0) s.jumped = true; // 只算玩家自己按的跳（摔成饼后的回弹不算）

    if (this.doneT > 0) { // 刚完成：打勾停一下
      this.doneT -= dt;
      if (this.doneT <= 0) { this.box.classList.remove('on', 'done'); this.cur = null; }
      return;
    }
    if (this.cur) {
      this.t += dt;
      const wait = g.auto && this.cur.autoWait ? this.cur.autoWait : this.cur.wait;
      if (this.cur.done(g, s)) return this.complete(true);
      if ((wait && this.t > wait) || (this.cur.skipIf && this.cur.skipIf(g))) return this.complete(false);
      return;
    }
    const next = STEPS.find((st) => !this.finished.has(st.id) && st.when(g));
    if (next) {
      // 前面已经过时的步骤直接跳过
      if (next.done(g, s)) { this.finished.add(next.id); return; }
      this.cur = next; this.t = 0;
      this.txt.innerHTML = next.text();
      const n = STEPS.indexOf(next) + 1;
      this.step.textContent = `新手指引 ${n}/${STEPS.length}`;
      this.box.classList.remove('done'); this.box.classList.add('on');
      this.box.classList.remove('pop'); void this.box.offsetWidth; this.box.classList.add('pop');
      if (g.audio.ctx) g.audio.tone('sine', 880, 1320, 0.12, 0.12);
    }
  }

  complete(ok) {
    this.finished.add(this.cur.id);
    if (ok) { this.box.classList.add('done'); this.doneT = 0.9; if (this.g.audio.ctx) this.g.audio.coin(); }
    else { this.box.classList.remove('on'); this.cur = null; }
  }

  // ---------- 目的地标记：头顶上的 ◆，出屏幕就贴边并指方向 ----------
  marker(target, label, cam) {
    if (!target) { this.wp.classList.remove('on'); this.route = null; return; }
    const p = this.g.player.pos;
    const dist = Math.hypot(target.x - p.x, target.z - p.z);
    this.wp.classList.add('on');
    this.wpLabel.textContent = label;
    this.wpDist.textContent = `${Math.round(dist)} 米`;
    const v = this.v.set(target.x, (target.y || 0) + 4, target.z).project(cam);
    const W = innerWidth, H = innerHeight;
    let x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H;
    const behind = v.z > 1;
    if (behind) { x = W - x; y = H - y; }
    const mx = 70, my = 90;
    const inside = !behind && x > mx && x < W - mx && y > my && y < H - my;
    if (!inside) {
      // 从屏幕中心朝目标方向射出去，停在边框上
      let dx = x - W / 2, dy = y - H / 2;
      if (behind && Math.abs(dy) < 1) dy = 1;
      const k = Math.min((W / 2 - mx) / Math.max(1e-3, Math.abs(dx)), (H / 2 - my) / Math.max(1e-3, Math.abs(dy)));
      x = W / 2 + dx * k; y = H / 2 + dy * k;
      this.wpArrow.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
    }
    this.wp.classList.toggle('edge', !inside);
    this.wp.style.transform = `translate(${x}px, ${y}px)`;
  }

  // 导航线：每半秒重算一次
  navRoute(target, dt) {
    if (!target) { this.route = null; return null; }
    this.routeT -= dt;
    if (!this.route || this.routeT <= 0 || this.routeTarget !== target) {
      const p = this.g.player.pos;
      this.route = routeTo(p.x, p.z, target.x, target.z); this.routeT = 0.5; this.routeTarget = target;
    } else this.route[0] = [this.g.player.pos.x, this.g.player.pos.z];
    return this.route;
  }

  // 卡住了：想走却走不动，或者掉进海里
  stuck(dt, wantMove) {
    const p = this.g.player;
    const slow = p.mode === 'bike' ? Math.abs(p.speed) < 1.5 : Math.hypot(p.vel.x, p.vel.z) < 0.8;
    const wet = p.pos.y < -0.8;
    this.stuckT = (wantMove && slow) || wet ? this.stuckT + dt : 0;
    this.stuckShown -= dt;
    return this.stuckT > 3 && this.stuckShown <= 0 ? ((this.stuckShown = 12), true) : false;
  }

  toggleHelp(goal) {
    const on = !this.help.classList.contains('on');
    this.help.classList.toggle('on', on);
    this.helpGoal.innerHTML = goal ? `现在要做：<b>${goal}</b>` : '';
    return on;
  }
}

