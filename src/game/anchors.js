// 「重启的代价」3D 世界玩法中枢：
// 1) 中央广场 AI 断电总闸（3 枚锚点亮灯 → 拉闸触发三重结局）
// 2) 中央广场北侧 算力回收站（抵押 ≥2 项激活，撞碎胶囊当场夺回失去的色彩/人情/痛觉/笑声/记忆！）
// 3) 3 条跨街区活人锚点（魔都×东京维护码 / 大苹果地铁×老家早读问答 / 截胡偷运锚点的袋鼠×金字塔快递柜）
// 4) 上一世 AI 幽灵奶蛙回放与围剿 + 抵押「街区记忆」后的巴黎隔离围挡
import * as THREE from 'three';
import {
  ANCHOR_DEFS, KANGAROO_HEIST_PATH, PLAZA_BREAKER, PLAZA_VAULT,
  MODULE_MAP, DROP_HUBS,
} from '../data/reboot-config.js';
import { questRing, flat, board } from '../world/districts/kit.js';
import { GhostNaiwa } from '../actors/npc/ghost.js';
import { Chaser } from '../actors/npc/index.js';

const V = (x, z) => new THREE.Vector3(x, 0, z);

/** 建一个悬浮发光的 3D 胶囊模型（算力回收站用）。 */
function makeCapsuleMesh(colorHex, label) {
  const g = new THREE.Group();
  const c = new THREE.Color(colorHex);
  const core = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.55, 1.1, 6, 14),
    new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(1.8) }),
  );
  core.position.y = 1.65;
  g.add(core);
  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(0.95, 0.95, 2.6, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x6ff4ff, transparent: true, opacity: 0.28,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }),
  );
  shell.position.y = 1.65;
  g.add(shell);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.15, 0.08, 6, 28),
    new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(2.2) }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.25;
  g.add(ring);

  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 64;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = 'rgba(6,16,28,0.88)';
  ctx.fillRect(0, 0, 256, 64);
  ctx.strokeStyle = '#' + c.getHexString();
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 252, 60);
  ctx.fillStyle = '#fff';
  ctx.font = '800 26px "PingFang SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 128, 34);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  tag.scale.set(4.2, 1.05, 1);
  tag.position.y = 3.6;
  g.add(tag);

  return { g, core, ring };
}

export class AnchorsManager {
  /** @param {import('./game.js').Game} game */
  constructor(game) {
    this.g = game;
    this.scene = game.world;
    this.collected = new Set();
    this.tracked = 'absurd'; // 'absurd' | 'memory' | 'pain' | 'breaker' | 'vault'
    this.timeLeft = 150;
    this.loopElapsed = 0;
    this.ghosts = [];
    this.capsules = [];
    this.vaultAlert = false;
    this.lockerPryT = 0;
    this.kangarooState = 'running'; // 'running' | 'caught' | 'locked'
    this.cafeCodeShownThisLoop = false;
    this.modalOpen = null; // null | 'vendor' | 'quiz' | 'reboot' | 'notebook' | 'ending'
    this.temptCool = 22;

    this.buildBreaker();
    this.buildAnchorRings();
    this.buildKangarooOrb();
    this.buildMemoryQuarantine();
    this.buildXrayBeams();
  }

  /** 中央广场「AI 算力断电总闸」实体。 */
  buildBreaker() {
    const [bx, bz] = PLAZA_BREAKER;
    const g = new THREE.Group();
    g.position.set(bx, 0, bz);
    const dark = new THREE.MeshStandardMaterial({ color: 0x162230, metalness: 0.75, roughness: 0.3 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.0, 0.6, 24), dark);
    base.position.y = 0.3;
    g.add(base);
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.8, 3.6, 1.2), dark);
    pillar.position.y = 2.1;
    g.add(pillar);
    // 顶部电饭煲造型断电开关
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.65, 0.7, 20),
      new THREE.MeshStandardMaterial({ color: 0xe6edf5, metalness: 0.6, roughness: 0.25 }),
    );
    pot.position.y = 4.3;
    g.add(pot);
    this.breakerOrbs = [];
    for (let i = 0; i < 3; i++) {
      const m = new THREE.MeshBasicMaterial({ color: 0x334455 });
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), m);
      orb.position.set((i - 1) * 0.75, 3.1, 0.68);
      g.add(orb);
      this.breakerOrbs.push(orb);
    }
    this.breakerRing = questRing(this.scene, '#ffc83a', '断电总闸（需 3 锚点）');
    this.breakerRing.g.position.set(bx, 0, bz);
    this.breakerBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(2.0, 2.0, 140, 20, 1, true),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(2.2, 1.6, 0.3), transparent: true, opacity: 0.2,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      }),
    );
    this.breakerBeam.position.set(bx, 70, bz);
    this.breakerBeam.visible = false;
    this.scene.add(g, this.breakerBeam);
    this.breakerGroup = g;
    board(this.g.island, ['AI 算力断电总闸', '集齐 3 枚活人锚点后按 E 拉闸'], 6.2, 1.5, bx, 5.8, bz, 0, { bg: '#0c1c2e', fg: '#ffd84a' });
  }

  /** 3 条锚点在地球村里的彩色引导光圈。 */
  buildAnchorRings() {
    const [a1, a2, a3] = ANCHOR_DEFS;
    this.rings = {
      cafe: questRing(this.scene, '#ff8ad8', '魔都小票 · 查维护码'),
      vendor: questRing(this.scene, '#a46bff', '荒诞锚 · 人生贩卖机'),
      teacher: questRing(this.scene, '#ff796e', '记忆锚 · 班主任早读'),
      locker: questRing(this.scene, '#ffc85a', '痛觉锚 · 撬千年快递柜'),
    };
    this.rings.cafe.g.position.set(a1.cafeSpot[0], 0, a1.cafeSpot[1]);
    this.rings.vendor.g.position.set(a1.vendorSpot[0], 0, a1.vendorSpot[1]);
    this.rings.teacher.g.position.set(a2.teacherSpot[0], 0, a2.teacherSpot[1]);
    this.rings.locker.g.position.set(a3.lockerSpot[0], 0, a3.lockerSpot[1]);
  }

  /** 挂在袋鼠头顶的金色痛觉锚点球。 */
  buildKangarooOrb() {
    const g = new THREE.Group();
    const orb = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.55, 0),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(3.0, 2.1, 0.4) }),
    );
    g.add(orb);
    g.position.set(0, 3.1, 0);
    g.visible = false;
    this.g.kanga.root.add(g);
    this.kangaOrb = g;
  }

  /** 抵押「街区记忆」后覆盖巴黎街区的青色全息隔离围挡。 */
  buildMemoryQuarantine() {
    const g = new THREE.Group();
    const wallMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.2, 1.5, 2.2),
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const sides = [
      [100, 7, -41, 108, 14, 0],
      [100, 7, 41, 108, 14, 0],
      [46, 7, 0, 82, 14, Math.PI / 2],
      [154, 7, 0, 82, 14, Math.PI / 2],
    ];
    for (const [x, y, z, w, h, ry] of sides) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat);
      m.position.set(x, y, z);
      m.rotation.y = ry;
      g.add(m);
    }
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 128;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#041a26'; ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = '#55e8ff'; ctx.lineWidth = 6; ctx.strokeRect(4, 4, 504, 120);
    ctx.fillStyle = '#7ef6ff'; ctx.font = '900 34px "PingFang SC", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('MEMORY FREED · 巴黎已回收', 256, 56);
    ctx.fillStyle = '#d4f6ff'; ctx.font = '700 22px "PingFang SC", sans-serif';
    ctx.fillText('已作为重启算力代价释放显存', 256, 98);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(24, 6), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
    sign.position.set(45.5, 9, 0);
    sign.rotation.y = -Math.PI / 2;
    g.add(sign);
    g.visible = false;
    this.scene.add(g);
    this.quarantine = g;
  }

  /** 抵押「色彩与天气」后的 AI 透视高空光柱（穿墙标出全部未完成锚点与袋鼠）。 */
  buildXrayBeams() {
    const mk = (hex) => {
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(0.9, 1.6, 160, 10, 1, true),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(hex).multiplyScalar(2.0),
          transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
        }),
      );
      m.visible = false;
      this.scene.add(m);
      return m;
    };
    this.xrays = {
      absurd: mk('#ff8ad8'),
      memory: mk('#ff796e'),
      pain: mk('#ffc85a'),
      vault: mk('#55e8ff'),
    };
  }

  /** 搭建中央广场北侧「算力回收站」胶囊群（每项已抵押活人模块 1 颗可撞碎的胶囊）。 */
  rebuildVaultCapsules() {
    for (const c of this.capsules) this.scene.remove(c.mesh.g);
    this.capsules = [];
    const ids = this.g.reboot.mortgagedIds();
    if (!this.g.reboot.vaultActive()) return;
    const [vx, vz] = PLAZA_VAULT;
    ids.forEach((id, i) => {
      const def = MODULE_MAP[id];
      const ang = ((i - (ids.length - 1) / 2) * 0.55);
      const cx = vx + Math.sin(ang) * 9.5;
      const cz = vz - Math.cos(ang) * 4.5 + 3;
      const mesh = makeCapsuleMesh(def.capsuleColor, `${def.icon} ${def.short}胶囊`);
      mesh.g.position.set(cx, 0, cz);
      this.scene.add(mesh.g);
      this.capsules.push({ id, def, mesh, pos: V(cx, cz), broken: false });
    });
  }

  /** 清理并重新生成前几世的 AI 托管幽灵奶蛙。 */
  rebuildGhosts() {
    for (const gh of this.ghosts) gh.remove();
    this.ghosts = [];
    for (const tr of this.g.reboot.ghostTracks) {
      this.ghosts.push(new GhostNaiwa(this.scene, tr));
    }
  }

  /** 开启新一轮（第 N 世）：重置本轮锚点、袋鼠偷运路线、倒计时、幽灵与回收站。 */
  startLoop(isFirstDrop = false) {
    const g = this.g, rb = g.reboot;
    g.tl.clear();
    g.ui.laughPop(false);
    // 清理跨轮次残留的班主任后座模型
    const ht = g.districts?.list?.find((d) => d.id === 'hometown');
    if (ht?.backseat) {
      ht.backseat.removeFromParent();
      ht.backseat = null;
      ht.rideT = 0;
      if (ht.teacherModel) ht.teacherModel.visible = true;
    }
    this.collected.clear();
    this.timeLeft = rb.loopDuration();
    this.loopElapsed = 0;
    this.lockerPryT = 0;
    this.vaultAlert = false;
    this.cafeCodeShownThisLoop = false;
    this.kangarooState = 'running';
    this.temptCool = 26;
    this.tracked = rb.intel.cafeCodeFound ? 'absurd' : 'absurd';

    // 启动袋鼠实时偷运「痛觉锚」
    const path = KANGAROO_HEIST_PATH.map(([x, z]) => V(x, z));
    g.kanga.done = false;
    g.kanga.taunt = false;
    g.kanga.start(path[0].clone(), path);
    g.kanga.say('痛觉锚点归我了！我要锁进金字塔快递柜！');
    this.kangaOrb.visible = true;

    // 重置追兵与道具
    g.clearChasers();
    for (const p of g.island.props) {
      p.flying = false;
      p.vel.set(0, 0, 0);
      p.spin.set(0, 0, 0);
      p.obj.position.set(p.home.x, g.island.heightAt(p.home.x, p.home.z), p.home.z);
      p.obj.rotation.set(0, 0, 0);
    }

    this.rebuildGhosts();
    this.rebuildVaultCapsules();
    this.applyWorldCosts();

    if (!isFirstDrop) {
      // 第 2 世及以后：跳过漫长空降，直接按选定投放点骑上小电驴开冲！
      const hub = DROP_HUBS.find((h) => h.id === rb.spawnHub) || DROP_HUBS[0];
      g.pipe.setScene(g.world);
      g.pipe.g.uLetter.value = 0;
      g.pipe.g.uLow.value = 0;
      g.upT = 0;
      g.state = 'roam';
      g.phase = 'loop';
      g.mounted = true;
      g.player.root.visible = true;
      g.player.mode = 'bike';
      g.districts.teleport(hub.pos[0], hub.pos[1], hub.yaw);
      g.input.lockOk = true;
      g.ui.showHud(true);
      g.ui.banner(`第 ${rb.loop} 世 · 重启完成`, `人性完整度 ${rb.humanityScore()}% · 已有 ${this.ghosts.length} 个旧自己残影在街上巡逻`);
      g.flash = 0.7;
      g.glitchT = 0.65;
      g.audio.upgrade();
      if (rb.vaultActive()) {
        g.tl.at(3.2, () => {
          g.line(['大肥鱼 AI 客服', '提示：中央广场北侧出现了「算力回收站」，那是您已抵押的低效垃圾，请勿靠近。'], 5);
        });
      }
    }
    this.refreshUI();
  }

  /** 把当前 5 项活人模块的抵押/夺回状态实时同步到 3D 渲染管线、场景、NPC 和玩家物理！ */
  applyWorldCosts() {
    const g = this.g, rb = g.reboot;
    const cold = rb.isMortgaged('color');
    const noBond = rb.isMortgaged('bond');
    const noPain = rb.isMortgaged('pain');
    const noLaugh = rb.isMortgaged('laugh');
    const noMem = rb.isMortgaged('memory');

    // 1. 色彩与天气
    g.env.coldMode = cold ? 1 : 0;
    g.pipe.g.uDesat.value = cold ? 0.92 : 0;
    g.env.apply();

    // 2. 人情与羁绊：替换热梗路人为蓝衣 AI 客服、清空追兵、弹幕变日志
    g.peds.setCustodianMode?.(noBond);
    if (noBond) g.clearChasers();
    g.ui.aiLogMode = noBond || noLaugh;

    // 3. 痛觉与荒诞：摊位焊死、电驴极速稳驾
    g.island.propsWelded = noPain;
    g.player.noPainMode = noPain;

    // 4. 笑声与情绪：锁死 Q 键、音频切换冷冰冰模式
    g.audio.setColdMode?.(noLaugh);

    // 5. 街区记忆：巴黎隔离围挡
    if (this.quarantine) this.quarantine.visible = noMem;

    // 更新总闸 3 颗灯珠颜色
    ANCHOR_DEFS.forEach((a, i) => {
      const done = this.collected.has(a.id);
      this.breakerOrbs[i].material.color.set(done ? 0xffd84a : 0x2a3b4c);
    });
    this.breakerBeam.visible = this.collected.size >= 3;

    // 更新 HUD 人性完整度与模块筹码
    g.ui.setHumanity(rb);
  }

  /** 记录一枚锚点入手并给出强正反馈！ */
  collectAnchor(id, bannerSub) {
    if (this.collected.has(id)) return;
    const def = ANCHOR_DEFS.find((a) => a.id === id);
    if (!def) return;
    this.collected.add(id);
    const g = this.g;
    g.audio.upgrade();
    g.fx.confetti(g.player.pos.clone().setY(2.5), 160);
    g.ui.banner(`锚点 ${this.collected.size}/3 · ${def.short}`, bannerSub || def.name);
    if (!g.reboot.isMortgaged('bond')) {
      g.ui.burst([`${def.short}到手！`, '活人感回来了！', '快去拉断电总闸！'], 6);
    }
    this.applyWorldCosts();
    // 自动切追踪到下一个未收集锚点，或直接指回中央广场断电总闸
    const next = ANCHOR_DEFS.find((a) => !this.collected.has(a.id));
    this.tracked = next ? next.id : 'breaker';
    if (!next) {
      g.line(['系统警报', '三枚活人锚点已集齐！立即返回中央广场，拉下「AI 算力断电总闸」！'], 5);
    }
    this.refreshUI();
  }

  /** 刷新左侧简洁追踪卡片与顶部目标文字。 */
  refreshUI() {
    const g = this.g, rb = g.reboot;
    const allDone = this.collected.size >= 3;
    const obj = allDone
      ? (rb.vaultActive() ? '3/3 锚点已齐！南侧拉闸通关，或北侧砸毁「回收站」抢回代价！' : '3/3 锚点已齐！冲回中央广场按 E 拉下断电总闸！')
      : `第 ${rb.loop} 世 · 收集 3 枚活人锚点（${this.collected.size}/3）并拉下总闸`;
    g.ui.objective(obj);
    g.ui.renderAnchorTracker({
      loop: rb.loop,
      collected: this.collected,
      tracked: this.tracked,
      intel: rb.intel,
      vaultActive: rb.vaultActive(),
      mortgagedCount: rb.mortgagedIds().length,
      kangarooState: this.kangarooState,
    });
  }

  /** 返回当前导航目标（供地面金色箭头、小地图黄线、3D ◆ 使用）。 */
  navTarget() {
    const [a1, a2, a3] = ANCHOR_DEFS;
    const rb = this.g.reboot;
    if (this.tracked === 'vault' && this.capsules.some((c) => !c.broken)) {
      const cap = this.capsules.find((c) => !c.broken);
      return { pos: cap.pos, label: `砸碎 ${cap.def.short}胶囊` };
    }
    if (this.collected.size >= 3 || this.tracked === 'breaker') {
      return { pos: V(PLAZA_BREAKER[0], PLAZA_BREAKER[1]), label: '中央广场 · 断电总闸' };
    }
    if (this.tracked === 'absurd' && !this.collected.has('absurd')) {
      if (!rb.intel.cafeCodeFound) return { pos: V(a1.cafeSpot[0], a1.cafeSpot[1]), label: '魔都加油咖啡 · 查维护码' };
      return { pos: V(a1.vendorSpot[0], a1.vendorSpot[1]), label: `东京贩卖机 · 输码 ${rb.intel.cafeCode}` };
    }
    if (this.tracked === 'memory' && !this.collected.has('memory')) {
      return { pos: V(a2.teacherSpot[0], a2.teacherSpot[1]), label: '老家县一中 · 班主任问答' };
    }
    if (this.tracked === 'pain' && !this.collected.has('pain')) {
      if (this.kangarooState === 'running' && this.g.kanga.active) {
        return { pos: this.g.kanga.root.position, label: '截胡袋鼠 · 撞翻夺锚点' };
      }
      return { pos: V(a3.lockerSpot[0], a3.lockerSpot[1]), label: '金字塔快递柜 · 撬柜夺锚点' };
    }
    const next = ANCHOR_DEFS.find((a) => !this.collected.has(a.id));
    if (next) {
      this.tracked = next.id;
      return this.navTarget();
    }
    return { pos: V(PLAZA_BREAKER[0], PLAZA_BREAKER[1]), label: '中央广场 · 断电总闸' };
  }

  /** 每帧主更新（仅在 state==='roam' 且 phase==='loop' 时驱动倒计时与交互）。 */
  update(dt) {
    const g = this.g, p = g.player, rb = g.reboot, t = g.time;
    const activeLoop = g.state === 'roam' && g.phase === 'loop' && (p.mode === 'bike' || p.mode === 'foot');

    // 光圈显隐与旋转
    const [a1, a2, a3] = ANCHOR_DEFS;
    this.rings.cafe.g.visible = activeLoop && !this.collected.has('absurd') && !rb.intel.cafeCodeFound;
    this.rings.vendor.g.visible = activeLoop && !this.collected.has('absurd');
    this.rings.teacher.g.visible = activeLoop && !this.collected.has('memory');
    this.rings.locker.g.visible = activeLoop && !this.collected.has('pain') && this.kangarooState === 'locked';
    this.breakerRing.g.visible = activeLoop;

    for (const r of Object.values(this.rings)) if (r.g.visible) r.spin(dt, t);
    if (this.breakerRing.g.visible) this.breakerRing.spin(dt, t);

    // AI 透视光柱（抵押「色彩与天气」后的超级甜头）
    const xray = activeLoop && rb.isMortgaged('color');
    this.xrays.absurd.visible = xray && !this.collected.has('absurd');
    if (this.xrays.absurd.visible) {
      const pt = rb.intel.cafeCodeFound ? a1.vendorSpot : a1.cafeSpot;
      this.xrays.absurd.position.set(pt[0], 80, pt[1]);
    }
    this.xrays.memory.visible = xray && !this.collected.has('memory');
    if (this.xrays.memory.visible) this.xrays.memory.position.set(a2.teacherSpot[0], 80, a2.teacherSpot[1]);
    this.xrays.pain.visible = xray && !this.collected.has('pain');
    if (this.xrays.pain.visible) {
      const pt = this.kangarooState === 'running' ? [g.kanga.root.position.x, g.kanga.root.position.z] : a3.lockerSpot;
      this.xrays.pain.position.set(pt[0], 80, pt[1]);
    }
    this.xrays.vault.visible = activeLoop && rb.vaultActive() && this.capsules.some((c) => !c.broken);
    if (this.xrays.vault.visible) this.xrays.vault.position.set(PLAZA_VAULT[0], 80, PLAZA_VAULT[1]);

    if (!activeLoop) return;

    this.loopElapsed += dt;
    this.timeLeft -= dt;
    g.ui.setLoopClock(this.timeLeft, rb.loop, this.collected.size);

    // 记录轨迹，留给下一世生成 AI 幽灵奶蛙
    rb.recordPoint(dt, p.pos.x, p.pos.z, p.yaw, p.mode);

    // 1. 袋鼠实时偷运逻辑
    if (this.kangaOrb.visible) this.kangaOrb.rotation.y += dt * 3;
    if (this.kangarooState === 'running') {
      if (g.kanga.done) {
        this.kangarooState = 'locked';
        this.kangaOrb.visible = false;
        g.kanga.root.visible = false;
        rb.discover('kangarooAmbushFound');
        if (!this.collected.has('pain')) {
          g.ui.banner('袋鼠锁柜了！', '痛觉锚已被塞进金字塔「千年快递柜」');
          g.line(['袋鼠', '略略略！我已经把锚点锁进金字塔快递柜了，有本事来撬啊！'], 4.5);
          this.refreshUI();
        }
      } else if (g.kanga.active) {
        const dk = flat(p.pos, g.kanga.root.position);
        const fast = (p.mode === 'bike' && Math.abs(p.speed) > 7) || (p.mode === 'foot' && p.air);
        if (dk < 3.6 && fast) {
          this.interceptKangaroo();
        }
      }
    }

    // 2. 魔都「加油咖啡」自动查维护码
    if (!this.collected.has('absurd') && !rb.intel.cafeCodeFound && flat(p.pos, V(a1.cafeSpot[0], a1.cafeSpot[1])) < 5.5) {
      rb.discover('cafeCodeFound');
      this.cafeCodeShownThisLoop = true;
      g.audio.coin();
      g.ui.banner(`维护码：${rb.intel.cafeCode}`, '已写入记忆笔记本！直冲东京「人生贩卖机」');
      g.line(['加油咖啡店员', `一杯八十，送你一句加油——小票背面印着东京贩卖机维护码：${rb.intel.cafeCode}！`], 5);
      this.refreshUI();
    }

    // 3. 算力回收站胶囊碰撞（撞碎当场夺回抵押的人性模块！）
    let brokenAny = false;
    for (const cap of this.capsules) {
      if (cap.broken) continue;
      cap.mesh.core.rotation.y += dt * 2.2;
      cap.mesh.ring.rotation.z += dt * 1.5;
      const d = flat(p.pos, cap.pos);
      if (d < 2.9 && (p.mode === 'bike' || Math.hypot(p.vel.x, p.vel.z) > 3)) {
        this.smashCapsule(cap);
        brokenAny = true;
      }
    }
    if (brokenAny) this.refreshUI();

    // 4. 更新上一世的 AI 托管幽灵奶蛙
    const nearVault = flat(p.pos, V(PLAZA_VAULT[0], PLAZA_VAULT[1])) < 32 && this.capsules.some((c) => !c.broken);
    if (nearVault && !this.vaultAlert && this.ghosts.length) {
      this.vaultAlert = true;
      g.ui.banner('托管幽灵围剿！', '你前几世的 AI 替身正在冲向回收站阻止你！');
      g.line(['大肥鱼 AI 客服', '警告：检测到违约破坏算力回收站！已派遗您的历史最优解替身执行拦截！'], 5);
    }
    for (const gh of this.ghosts) {
      const hit = gh.update(dt, p, g.island, this.vaultAlert);
      if (hit) {
        this.timeLeft = Math.max(1, this.timeLeft - 2.5);
        g.glitchT = 0.7;
        g.pipe.shake = 0.55;
        p.speed *= 0.35;
        g.audio.tone('sawtooth', 320, 110, 0.35, 0.2);
        g.ui.danmaku(`[同步侵蚀] 被第 ${gh.loopNum} 世的自己减速 -2.5s！`, true);
      }
    }

    // 5. 上下文按 E 提示 & 金字塔撬柜进度
    let hint = '';
    if (this.collected.size >= 3 && flat(p.pos, V(PLAZA_BREAKER[0], PLAZA_BREAKER[1])) < 5.5) {
      hint = '按 <b>E</b> 拉下 AI 算力断电总闸！';
    } else if (!this.collected.has('absurd') && flat(p.pos, V(a1.vendorSpot[0], a1.vendorSpot[1])) < 5.2) {
      hint = rb.intel.cafeCodeFound
        ? `按 <b>E</b> 向人生贩卖机输入维护码 <b>${rb.intel.cafeCode}</b>`
        : '按 <b>E</b> 调查人生贩卖机（维护码在魔都加油咖啡小票上）';
    } else if (!this.collected.has('memory') && flat(p.pos, V(a2.teacherSpot[0], a2.teacherSpot[1])) < 5.5) {
      hint = '按 <b>E</b> 接受班主任早读 3 题快问快答';
    } else if (!this.collected.has('pain') && this.kangarooState === 'locked' && flat(p.pos, V(a3.lockerSpot[0], a3.lockerSpot[1])) < 5.5) {
      if (this.lockerPryT > 0) {
        this.lockerPryT += dt;
        const pct = Math.min(100, Math.round((this.lockerPryT / 3.2) * 100));
        hint = `正在硬撬千年快递柜… <b>${pct}%</b>（别离开！）`;
        if (this.lockerPryT >= 3.2) {
          this.lockerPryT = 0;
          this.collectAnchor('pain', '硬撬千年快递柜成功！记住了袋鼠的路线！');
        }
      } else {
        hint = '按 <b>E</b> 硬撬千年快递柜夺回痛觉锚';
      }
    } else {
      this.lockerPryT = 0;
    }

    // 若玩家靠近未砸碎的胶囊，给出提示
    if (!hint) {
      const cap = this.capsules.find((c) => !c.broken && flat(p.pos, c.pos) < 8);
      if (cap) hint = `骑车撞碎 <b>${cap.def.icon}${cap.def.short}胶囊</b>（或按 <b>E</b>）夺回被抵押的自己！`;
    }
    if (hint) g.ui.setHint(hint);

    // 6. 大肥鱼温柔引诱重启（每轮适度提醒一次）
    this.temptCool -= dt;
    if (this.temptCool <= 0 && this.timeLeft < 75 && this.collected.size < 2 && rb.availableToMortgage().length) {
      this.temptCool = 999;
      g.ui.phoneMsg('大肥鱼 AI 客服', '本轮时间有点紧哦～随时按 Backspace「重启人生」，情报全保留！');
    }

    // 7. 倒计时归零：强制弹出《重启算力抵押协议》！
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      g.openRebootProtocol('归档倒计时归零！你的意识即将被格式化——');
    }
  }

  /** 半路撞翻或笑飞袋鼠，直接截胡「痛觉锚」！ */
  interceptKangaroo() {
    if (this.kangarooState !== 'running' || this.collected.has('pain')) return;
    this.kangarooState = 'caught';
    this.kangaOrb.visible = false;
    const g = this.g;
    g.kanga.active = false;
    g.kanga.root.visible = false;
    g.reboot.discover('kangarooAmbushFound');
    g.audio.boing();
    g.audio.play('feidudu', { vol: 0.85 });
    g.pipe.shake = 0.85;
    g.fx.puff(g.kanga.root.position.clone().setY(1.5), 40, new THREE.Color(1, 0.85, 0.3), 12);
    this.collectAnchor('pain', '半路截胡撞翻袋鼠！夺回痛觉锚！');
  }

  /** 撞碎算力回收站里的胶囊：实时在 3D 世界里把卖掉的人性轰然夺回！ */
  smashCapsule(cap) {
    if (cap.broken) return;
    cap.broken = true;
    this.scene.remove(cap.mesh.g);
    const g = this.g;
    g.reboot.reclaimModule(cap.id);
    this.vaultAlert = true;
    g.flash = 0.85;
    g.glitchT = 0.7;
    g.pipe.shake = 1.0;
    g.audio.boom(0.7);
    g.audio.upgrade();
    g.fx.confetti(cap.pos.clone().setY(2), 180);
    g.ui.banner(`夺回【${cap.def.name}】！`, cap.def.reclaimLine);
    g.ui.burst([`抢回${cap.def.short}了！`, 'AI 急了！', '这才是活人感！', '违约重启成功！'], 7);
    this.applyWorldCosts();
  }

  /** 处理 E 键与锚点、总闸、回收站的交互。返回 true 表示已消费 E 键。 */
  tryInteract() {
    const g = this.g, p = g.player, rb = g.reboot;
    if (g.state !== 'roam' || g.phase !== 'loop') return false;
    const [a1, a2, a3] = ANCHOR_DEFS;

    // 1. 拉下总闸
    if (this.collected.size >= 3 && flat(p.pos, V(PLAZA_BREAKER[0], PLAZA_BREAKER[1])) < 5.8) {
      g.triggerEnding();
      return true;
    }

    // 2. 砸碎附近的抵押胶囊
    const cap = this.capsules.find((c) => !c.broken && flat(p.pos, c.pos) < 5.5);
    if (cap) {
      this.smashCapsule(cap);
      this.refreshUI();
      return true;
    }

    // 3. 东京人生贩卖机输入维护码
    if (!this.collected.has('absurd') && flat(p.pos, V(a1.vendorSpot[0], a1.vendorSpot[1])) < 5.5) {
      g.openVendorKeypad();
      return true;
    }

    // 4. 老家县一中班主任早读快问快答
    if (!this.collected.has('memory') && flat(p.pos, V(a2.teacherSpot[0], a2.teacherSpot[1])) < 5.8) {
      g.openHometownQuiz();
      return true;
    }

    // 5. 金字塔快递柜硬撬
    if (!this.collected.has('pain') && this.kangarooState === 'locked' && flat(p.pos, V(a3.lockerSpot[0], a3.lockerSpot[1])) < 5.8) {
      if (rb.isMortgaged('bond')) {
        this.collectAnchor('pain', '零阻力直接打开千年快递柜！');
      } else {
        this.lockerPryT = Math.max(0.05, this.lockerPryT);
        g.audio.tone('square', 300, 620, 0.15, 0.15);
        // 刷出一个阿努比斯/亲戚追兵制造紧迫感
        if (g.chasers.length < 2) {
          const c = new Chaser(g.world, 'aunt', V(-124, -27), {
            name: '阿努比斯监工', color: '#ffc85a', face: 'calm',
            lines: ['这快递是你家的吗？', '法老三千年件也敢撬？', '先交 80 块滞纳金！'],
          });
          g.chasers.push(c);
          g.ui.danmaku('阿努比斯监工冲过来阻止你撬柜！', true);
        }
      }
      return true;
    }
    return false;
  }

  /** 为大地图提供所有锚点、总闸、回收站、幽灵与袋鼠的清晰标注。 */
  mapMarks() {
    const out = [];
    const [a1, a2, a3] = ANCHOR_DEFS;
    const rb = this.g.reboot;
    out.push({ x: PLAZA_BREAKER[0], z: PLAZA_BREAKER[1], color: '#ffc83a', r: 10, label: `断电总闸 (${this.collected.size}/3)` });
    if (rb.vaultActive() && this.capsules.some((c) => !c.broken)) {
      out.push({ x: PLAZA_VAULT[0], z: PLAZA_VAULT[1], color: '#55e8ff', r: 9, label: '算力回收站（夺回代价）' });
    }
    if (!this.collected.has('absurd')) {
      if (!rb.intel.cafeCodeFound) out.push({ x: a1.cafeSpot[0], z: a1.cafeSpot[1], color: '#ff8ad8', r: 8, label: '①魔都查维护码' });
      out.push({ x: a1.vendorSpot[0], z: a1.vendorSpot[1], color: '#a46bff', r: 8, label: '①东京贩卖机' });
    }
    if (!this.collected.has('memory')) {
      out.push({ x: a2.subwaySpot[0], z: a2.subwaySpot[1], color: '#5dff9a', r: 7, label: '捷径：铁岭地铁' });
      out.push({ x: a2.teacherSpot[0], z: a2.teacherSpot[1], color: '#ff796e', r: 8, label: '②老家早读问答' });
    }
    if (!this.collected.has('pain')) {
      if (this.kangarooState === 'running' && this.g.kanga.active) {
        out.push({ x: this.g.kanga.root.position.x, z: this.g.kanga.root.position.z, color: '#ff9a3a', r: 9, label: '③偷运袋鼠' });
      }
      out.push({ x: a3.lockerSpot[0], z: a3.lockerSpot[1], color: '#ffc85a', r: 8, label: '③金字塔快递柜' });
    }
    for (const gh of this.ghosts) {
      out.push({ x: gh.root.position.x, z: gh.root.position.z, color: '#55e8ff', r: 6, label: `第${gh.loopNum}世幽灵` });
    }
    return out;
  }
}
