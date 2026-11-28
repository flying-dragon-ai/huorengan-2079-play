// 任务线：目的地光柱、地面箭头、导航目标、取餐 → 送咖啡 → 入夜 → 捧腹大笑 → 片尾，
// 以及右边的人生任务列表和 HUD 小地图。全部从 game/game.js 原样搬出，逻辑一字未改。
import * as THREE from 'three';
import { ROUTE_AUNT, ROUTE_NIGHT } from '../data/quest-config.js';
import { LINES } from '../data/text.js';
import { lerp, smooth } from '../core/math.js';
import { nearestRoad } from './guide.js';

/** 平面坐标转世界坐标点（与 data/quest-config.js 里的同名工具一致）。
 * @param {number} x
 * @param {number} z
 * @returns {THREE.Vector3} y 恒为 0
 */
const V = (x, z) => new THREE.Vector3(x, 0, z);

/**
 * 造一个金色光柱 + 地面光环，用来标目的地。
 * @param {import('./game.js').Game} game
 * @returns {THREE.Group} 光柱组，初始不可见
 */
export function makeMarker(game) {
  const g = new THREE.Group();
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 120, 32, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.1, 0.3), transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.y = 60; g.add(beam);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(4, 0.18, 8, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 2.6, 0.6) }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.3; g.add(ring);
  game.markerRing = ring; g.visible = false;
  return g;
}

/**
 * 把光柱挪到某个点上；传 null 就藏起来。
 * @param {import('./game.js').Game} game
 * @param {THREE.Vector3|null} p 目的地，null 表示隐藏
 * @returns {void}
 */
export function setMarker(game, p) {
  game.marker.visible = !!p; if (p) game.marker.position.copy(p).setY(game.island.heightAt(p.x, p.z));
}

/**
 * 换一条自动驾驶路线，路点从头开始。
 * @param {import('./game.js').Game} game
 * @param {THREE.Vector3[]} r 路线点
 * @returns {void}
 */
export function setRoute(game, r) {
  game.route = r; game.wp = 0;
}

/**
 * 右边的人生任务列表。
 * @param {import('./game.js').Game} game
 * @param {number} dt 帧间隔（秒）
 * @returns {void}
 */
export function updateQuests(game, dt) {
  const el = document.getElementById('quests');
  // 主重启循环期间隐藏旧版 13 行右侧长清单，仅在「自由闯荡」模式展示 8 大街区支线
  const show = game.state === 'free' && game.player.mode !== 'dive';
  el.style.display = show ? '' : 'none';
  if (!show || (game.questT = (game.questT || 0) - dt) > 0) return;
  game.questT = 0.25;
  const side = game.districts.questItems();
  const next = game.districts.active?.d || game.districts.nearestQuest();
  const cur = side.findIndex((q) => q.id && q.id === next?.id);
  let note = '';
  const nav = game.navTarget();
  if (nav) note = `还有 ${Math.round(Math.hypot(nav.pos.x - game.player.pos.x, nav.pos.z - game.player.pos.z))} 米`;
  game.ui.quests(side, cur, note, '街区支线任务');
}

/**
 * 地面上的发光箭头：沿着导航线往前铺，一直往前流动。
 * @param {import('./game.js').Game} game
 * @param {THREE.Scene} s 世界场景
 * @returns {void}
 */
export function makeArrows(game, s) {
  const sh = new THREE.Shape([[0, 0.9], [1.4, -0.5], [0.85, -0.5], [0, 0.3], [-0.85, -0.5], [-1.4, -0.5]].map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ShapeGeometry(sh); g.rotateX(Math.PI / 2);
  const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: true });
  game.arrows = new THREE.InstancedMesh(g, m, 14); game.arrows.frustumCulled = false; game.arrows.count = 0;
  for (let i = 0; i < 14; i++) game.arrows.setColorAt(i, new THREE.Color(0, 0, 0));
  s.add(game.arrows); game._m4 = new THREE.Matrix4(); game._q = new THREE.Quaternion(); game._up = new THREE.Vector3(0, 1, 0);
}

/**
 * 每帧把箭头实例摆到导航线上，颜色按距离衰减。
 * @param {import('./game.js').Game} game
 * @returns {void}
 */
export function updateArrows(game) {
  const A = game.arrows, r = game.navLine;
  if (!A) return;
  if (!r || r.length < 2 || (game.state !== 'roam' && game.state !== 'free') || game.player.mode === 'dive') { A.count = 0; return; }
  const off = (game.time * 9) % 6;
  let seg = 0, segStart = 0, n = 0;
  const lens = []; let total = 0;
  for (let i = 0; i + 1 < r.length; i++) { const l = Math.hypot(r[i + 1][0] - r[i][0], r[i + 1][1] - r[i][1]); lens.push(l); total += l; }
  const posV = (game._av ||= new THREE.Vector3());
  const scV = (game._as ||= new THREE.Vector3(1.3, 1, 1.3));
  const colV = (game._ac ||= new THREE.Color());
  for (let d = 5 + off; d < Math.min(total - 3, 88) && n < 14; d += 6) {
    while (seg < lens.length - 1 && d > segStart + lens[seg]) { segStart += lens[seg]; seg++; }
    const k = Math.min(1, (d - segStart) / Math.max(lens[seg], 1e-3)), a = r[seg], b = r[seg + 1];
    const x = a[0] + (b[0] - a[0]) * k, z = a[1] + (b[1] - a[1]) * k;
    game._q.setFromAxisAngle(game._up, Math.atan2(b[0] - a[0], b[1] - a[1]));
    posV.set(x, game.island.heightAt(x, z) + 0.15, z);
    game._m4.compose(posV, game._q, scV);
    A.setMatrixAt(n, game._m4);
    const f = Math.min(1, (d - 3) / 6) * (1 - d / 95);
    colV.setRGB(2.4 * f, 1.6 * f, 0.35 * f);
    A.setColorAt(n, colV); n++;
  }
  A.count = n; A.instanceMatrix.needsUpdate = true; if (A.instanceColor) A.instanceColor.needsUpdate = true;
}

/**
 * 现在该去哪：屏幕上的 ◆ 和小地图黄线都指向这里。
 * @param {import('./game.js').Game} game
 * @returns {{pos: THREE.Vector3, label: string}|null} 目的地，null 表示没有
 */
export function navTarget(game) {
  const p = game.player, ph = game.phase;
  if (game.state === 'dive' || ((ph === 'getbike' || (game.state === 'roam' && !ph)) && p.mode !== 'bike')) return { pos: p.bike.position, label: '小电驴' };
  if (ph === 'loop' && game.anchors) return game.anchors.navTarget();
  if (ph === 'pickup') return { pos: game.island.cafe, label: '咖啡店 · 取餐' };
  if (ph === 'deliver') return { pos: game.island.auntSpot, label: '七大姑 · 送咖啡' };
  return game.districts ? game.districts.navTarget() : null;
}

/**
 * 卡住了：奶蛙和小电驴一起回到最近的路上，车头朝着目的地。
 * @param {import('./game.js').Game} game
 * @returns {void}
 */
export function resetToRoad(game) {
  const p = game.player, r = nearestRoad(p.pos.x, p.pos.z);
  const dx = r.b[0] - r.a[0], dz = r.b[1] - r.a[1];
  let yaw = Math.atan2(dx, dz);
  const nav = game.navTarget();
  if (nav && (nav.pos.x - r.x) * dx + (nav.pos.z - r.z) * dz < 0) yaw += Math.PI; // 车头朝着目的地
  p.pos.set(r.x, game.island.heightAt(r.x, r.z), r.z);
  p.vel.set(0, 0, 0); p.speed = 0; p.vy = 0; p.air = false; p.yaw = yaw;
  if (p.mode === 'bike') p.bike.position.copy(p.pos);
  else { p.bike.position.set(r.x + Math.cos(yaw) * 2, p.pos.y, r.z - Math.sin(yaw) * 2); p.bike.rotation.set(0, yaw, 0); }
  game.rig.yaw = yaw; game.rig.init = false;
  game.fx.puff(p.pos.clone().setY(p.pos.y + 0.5), 24, new THREE.Color(0.7, 0.95, 1), 6);
  game.audio.pop(); game.ui.danmaku('传送回路上！', true);
}

/**
 * 主线状态机：取餐 → 送咖啡 → 入夜攒笑点 → 可以捧腹大笑。
 * @param {import('./game.js').Game} game
 * @param {number} dt 帧间隔（秒）
 * @returns {void}
 */
export function updateMission(game, dt) {
  const p = game.player;
  game.markerRing.rotation.z += dt;
  game.markerRing.scale.setScalar(1 + Math.sin(game.time * 4) * 0.08);
  if ((!game.phase || game.phase === 'getbike') && p.canMount()) game.ui.setHint('按 <b>E</b> 骑上小电驴');
  else if (game.phase !== 'laughReady') game.ui.setHint('');
  if (game.missionT != null && (game.phase === 'pickup' || game.phase === 'deliver')) {
    game.missionT -= dt; game.ui.setTimer(game.missionT);
  } else game.ui.setTimer(null);

  if (game.phase === 'pickup' && p.pos.distanceTo(game.island.cafe) < 8) {
    game.phase = 'deliver'; game.audio.coin();
    game.line(LINES.pickup, 3.5);
    game.ui.banner('取餐成功！', '一杯八十 · 多加冰，少加班');
    game.tl.at(2.2, () => game.startPPT());
    game.ui.objective('送到热带海滩，给七大姑');
    game.setMarker(game.island.auntSpot);
    game.setRoute(ROUTE_AUNT);
    game.kanga.start(game.island.cafe.clone().add(V(-4, 4)), ROUTE_AUNT);
    // 袋鼠的口头禅：老外口音的“你的胆子真是肥嘟嘟的！”（录音来自旧作）
    game.tl.at(1.6, () => {
      if (!game.audio.play('feidudu', { vol: 0.95 })) game.audio.say(LINES.kangarooCatch[1], { pitch: 1.5 });
      game.audio.play('feidudu2', { vol: 0.6, delay: 2.9 });
      game.kanga.say(LINES.kangarooCatch[1]); game.ui.say(...LINES.kangarooCatch, 3.4);
    });
    game.tl.at(6, () => game.line(LINES.kangaroo[0], 3));
    game.niuDone = false;
  }
  if (game.phase === 'deliver' && !game.niuDone && p.pos.x > 130 && p.pos.z > -40 && p.pos.z < 20) {
    game.niuDone = true;
    game.niu.root.position.set(150, 0, 140);
    game.niu.charge([V(150, 100), V(149, 20), V(160, -60), V(180, -80)], 26);
    game.line(LINES.niulai, 3);
  }
  if (game.niu.charging && p.mode === 'bike' && game.niu.root.position.distanceTo(p.pos) < 2.6 && !p.air) {
    p.air = true; p.vy = 15; p.speed *= 0.6; p.sq = 0.5; game.audio.boing(); game.pipe.shake = 0.8;
    game.ui.burst(['被牛顶飞了哈哈哈', '牛来了！！', '牛：不好意思'], 3);
    // 牛来撞完人自己先哭了（牛来哭喊妈妈的录音来自旧作《勇者奶蛙》）
    if (!game.niuCried) { game.niuCried = true; game.tl.at(0.5, () => { game.audio.play('cowmama', { vol: 0.8 }); game.niu.say(LINES.niulaiCry); }); }
  }
  if (game.phase === 'deliver' && p.pos.distanceTo(game.island.auntSpot) < 9) game.deliver();
  if (game.phase === 'night') {
    game.laugh += dt * 1.3;
    game.ui.setHint(`笑点 ${Math.min(100, Math.round(game.laugh))}%`);
    if (game.laugh >= 100 && game.time - game.nightStart > 30) { // 夜景至少骑 30 秒
      game.phase = 'laughReady'; game.line(LINES.laughReady, 4); game.audio.ding();
      game.ui.banner('笑点充满！', '按 Q 捧腹大笑');
      game.ui.objective('按 Q 捧腹大笑'); game.ui.setHint('按 <b>Q</b> 捧腹大笑');
    }
  }
}

/**
 * 把咖啡送到七大姑手里：结算、入夜、换夜景路线。
 * @param {import('./game.js').Game} game
 * @returns {void}
 */
export function deliver(game) {
  game.phase = 'night'; game.audio.coin(); game.setMarker(null); game.nightStart = game.time;
  const used = Math.round(game.time - game.missionStart);
  const props = game.island.props.filter((x) => x.flying || x.obj.position.distanceTo(x.home) > 1).length;
  const lost = game.kanga.taunt; // 袋鼠先到，咖啡已经被它喝了
  game.ui.result([`用时 ${used} 秒${game.missionT < 0 ? '（超时了，但七大姑不在乎）' : ''}`, lost ? '咖啡：被袋鼠当面喝掉了' : '咖啡：送到了，还是热的', `撞飞摊位 ${props} 个`, `最高被催 ${game.maxStars || 0} 星`, '<b>活人感 +40%</b>', '解锁：夜景 · 霓虹 · 捧腹大笑'], 6);
  game.line(lost ? ['七大姑', '咖啡呢？算了。你一个月挣多少？有对象了吗？'] : LINES.deliver, 5);
  if (lost) game.kanga.say('嗝——');
  game.fx.confetti(game.island.auntSpot.clone().setY(2), 200);
  game.meter = Math.max(game.meter, 60); game.ui.setMeter(game.meter);
  game.ui.objective('夜游地球村，笑点充满后按 Q');
  game.missionT = null;
  game.clearChasers();
  game.env.speed = 0.1;
  game.tl.at(22, () => { game.env.speed = 0; });
  game.tl.at(9, () => { game.audio.ding(); game.ui.phoneMsg('妈妈', '几点了还不回家？'); game.line(LINES.night, 4); });
  game.laugh = Math.max(game.laugh, 25);
  game.setRoute(ROUTE_NIGHT);
  game.ui.burst(['七大姑问工资了', '一杯八十送到了', '天黑了好美', '霓虹亮了！'], 5);
}

/**
 * 捧腹大笑：奶蛙变身大奶蛙，冲击波把整条街笑飞。
 * @param {import('./game.js').Game} game
 * @returns {void}
 */
export function bigLaugh(game) {
  const p = game.player;
  game.phase = 'laughing'; game.ui.setHint(''); game.ui.objective('');
  if (p.mode === 'bike') { p.speed = 0; }
  p.scaleTarget = 6; game.rig.extra = 10;
  // 奶蛙变身大奶蛙，笑得前仰后合；左上弹出捧腹大笑动图
  if (game.big) {
    const B = game.big, cam = game.pipe.camera.position;
    B.g.visible = true; B.t = 0; B.s = 0.4; B.target = 7; B.laugh = 1;
    B.g.position.copy(p.pos); B.g.rotation.set(0, 0, 0);
    B.g.rotation.y = Math.atan2(cam.x - p.pos.x, cam.z - p.pos.z);
    B.yaw = B.g.rotation.y; p.root.visible = false;
  }
  game.ui.laughPop(true); game.tl.at(3.8, () => game.ui.laughPop(false));
  game.audio.laugh(); game.pipe.shake = 1.5; game.flash = 0.6;
  game.waves.spawn(p.pos.clone(), 60);
  game.peds.fling(p, game.ui, game.audio, '被笑飞了');
  // 冲击波：整条街的人和摊位都被笑飞，同时放慢动作
  game.tl.at(0.4, () => {
    game.island.blast(p.pos, 85, 42); game.peds.blast(p.pos, 85);
    game.waves.spawn(p.pos.clone(), 80, new THREE.Color(3, 1.5, 2.5)); game.waves.spawn(p.pos.clone(), 120, new THREE.Color(1.5, 2.5, 3));
    game.audio.boom(); game.slowT = 1.3;
  });
  game.fx.confetti(p.pos.clone().setY(8), 400);
  const ha = ['哈哈哈哈哈哈', '笑死我了', '捧腹大笑！！', '绷不住了', '哈哈哈哈哈哈哈哈', '奶蛙变大了', '这是什么大招'];
  game.ui.burst(ha, 16);
  game.meter = 100; game.ui.setMeter(100);
  game.tl.at(4, () => { p.scaleTarget = 1; game.rig.extra = 0; game.finale(); });
}

/**
 * 大结局：片尾字幕、镜头交给 finaleCam。
 * @param {import('./game.js').Game} game
 * @returns {void}
 */
export function finale(game) {
  game.state = 'finale'; game.finT = 0; game.phase = 'finale';
  game.pipe.g.uLetter.value = 1;
  game.line(LINES.finale, 5);
  game.ui.showHud(false);
  game.env.hour = Math.max(game.env.hour, 20.2); game.env.apply(true);
  game.camFrom = game.pipe.camera.position.clone();
  game.tl.at(4, () => game.ui.title(true, '活人感 2079', 'AI 把活干完了。你负责活着。'));
  game.tl.at(13, () => game.ui.title(true, '活人感 2079', '未完待续 · 其余街区预计 2080 年完工'));
  // 大奶蛙留在广场上继续笑，镜头拉远时正好是前景；片尾镜头在南边，所以转过来朝南
  if (game.big) { game.big.laugh = 0.55; game.big.yaw = Math.PI; }
  game.tl.at(21, () => {
    game.ui.title(false); game.state = 'free'; game.phase = 'free'; game.pipe.g.uLetter.value = 0; game.ui.showHud(true); game.ui.objective('自由闯荡'); game.rig.init = false;
    if (game.big) { game.big.target = 0; game.big.laugh = 0; }
    game.player.root.visible = true;
  });
  game.fwT = 0;
}

/**
 * 片尾镜头：先正对大笑的大奶蛙后退，再拉成整座岛的大远景。
 * @param {import('./game.js').Game} game
 * @param {number} dt 帧间隔（秒）
 * @returns {void}
 */
export function finaleCam(game, dt) {
  game.finT += dt;
  const t = game.finT;
  // 先正对着笑个不停的大奶蛙往后退、往上升，再拉成整座岛加海上烟花的大远景
  const F = game.big && game.big.g.visible ? game.big.g.position : game.player.pos;
  const kA = smooth(0, 4.5, t), k = smooth(3.5, 13, t);
  const near = new THREE.Vector3(F.x + Math.sin(t * 0.4) * 3, lerp(5.5, 15, kA), F.z - lerp(15, 32, kA));
  const nearLook = new THREE.Vector3(F.x, lerp(5.5, 7.5, kA), F.z);
  const a = -Math.PI / 2 + t * 0.05, r = lerp(36, 230, k), h = lerp(16, 120, k);
  const wt = new THREE.Vector3(F.x * (1 - k), 0, lerp(F.z, 120, k));
  const wide = new THREE.Vector3(wt.x + Math.cos(a) * r * 0.5, h, wt.z - Math.sin(a) * r * 0.2 - r * 0.9);
  const wideLook = new THREE.Vector3(lerp(F.x, 0, k), lerp(7.5, 40, k), lerp(F.z, 330, k));
  const cam = game.pipe.camera;
  cam.position.copy(near.lerp(wide, k));
  cam.lookAt(nearLook.lerp(wideLook, k));
  cam.fov = 50; cam.updateProjectionMatrix();
  game.fwT -= dt;
  if (game.fwT <= 0 && t > 2) {
    game.fwT = 0.35 + Math.random() * 0.4;
    const pos = new THREE.Vector3((Math.random() - 0.5) * 300, 70 + Math.random() * 80, 300 + Math.random() * 120);
    game.fx.firework(pos); game.audio.boom(0.15);
  }
}

/**
 * 小地图上的点：目的地、袋鼠、追人 NPC、小电驴。
 * @param {import('./game.js').Game} game
 * @returns {void}
 */
export function updateHud(game) {
  const p = game.player;
  const marks = [];
  const nav = game.navTarget();
  if (nav) marks.push({ x: nav.pos.x, z: nav.pos.z, color: '#ffc83a', r: 6, edge: true });
  else if (game.marker.visible) marks.push({ x: game.marker.position.x, z: game.marker.position.z, color: '#ffc83a', r: 6, edge: true });
  if (game.kanga.active) marks.push({ x: game.kanga.root.position.x, z: game.kanga.root.position.z, color: '#ff9a3a', r: 5 });
  for (const c of game.chasers) marks.push({ x: c.root.position.x, z: c.root.position.z, color: '#ff4a6a', r: 4 });
  if (game.anchors) {
    for (const gh of game.anchors.ghosts) marks.push({ x: gh.root.position.x, z: gh.root.position.z, color: '#55e8ff', r: 4 });
  }
  if (p.mode !== 'bike') marks.push({ x: p.bike.position.x, z: p.bike.position.z, color: '#6fffd0', edge: true });
  game.ui.minimap(p.pos.x, p.pos.z, game.rig.yaw, marks, game.navLine);
}
