// 导演：《活人感 2079 · 重启的代价》主循环、人生舱大厅、3 锚点重启循环、算力抵押协议、三重结局与自由闯荡
import * as THREE from 'three';
import { Pipeline, Environment, PERF_TIERS } from '../gfx/pipeline.js';
import { Particles, Shockwaves } from '../gfx/fx.js';
import { batchStatic } from '../gfx/batch.js';
import { Island } from '../world/island.js';
import { Player, CameraRig } from '../actors/player.js';
import { Kangaroo, Niulai, Peds, Chaser } from '../actors/npc/index.js';
import { preload, preloadGen, hasModel, MODEL_CONF } from '../actors/models.js';
import { Hall } from './hall.js';
import { UI } from './ui.js';
import { HOURS, bindPhotoControls } from './photo.js';
import { Guide } from './guide.js';
import { Districts, devTools } from './districts.js';
import { RebootState } from './reboot.js';
import { AnchorsManager } from './anchors.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Input } from '../core/input.js';
import { Audio } from '../audio/audio.js';
import { CARD, GACHA_N } from '../data/text.js';
import { AREAS } from '../data/quest-config.js';
import { Timeline, lerp } from '../core/util.js';
import {
  makeMarker, setMarker, setRoute, updateQuests, makeArrows, updateArrows, navTarget, resetToRoad,
  updateMission, deliver, bigLaugh, finale, finaleCam, updateHud,
} from './mission.js';
import { autoDrive, updateKangaroo, makeBigFrog, updateBigFrog, onMount, onEvent } from './auto-pilot.js';
import { updateWanted, clearChasers, warnAlive } from './wanted.js';
import { goGray, upgrade, updateGrade, clouds } from './quality.js';

export class Game {
  constructor(canvas) {
    this.params = new URLSearchParams(location.search);
    this.auto = this.params.get('auto') === '1';
    this.pipe = new Pipeline(canvas);
    this.input = new Input(canvas);
    this.audio = new Audio();
    this.ui = new UI();
    this.tl = new Timeline();
    this.reboot = new RebootState({ persist: this.params.get('fresh') !== '1' });
    this.state = 'loading';
    this.meter = 100; this.laugh = 100; this.laughCool = 0; this.stars = 0; this.chasers = [];
    this.timeScale = 1; this.slowT = 0; this.pptT = 0; this.warnAt = -99; this.overT = 0; this.airT = 0;
    this.glitchT = 0; this.modalActive = false; this.endingMode = null;
    this.lastNow = performance.now(); this.time = 0;
  }

  async init(progress) {
    const names = Object.keys(MODEL_CONF);
    let n = 0;
    const stage = async (label, fraction) => {
      progress(label, fraction);
      await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
    };
    await stage('准备角色…', 0.02);
    await preload(names, () => progress(`准备角色… ${++n}/${names.length}`, 0.04 + (0.34 * n) / names.length));
    await stage('载入街区生成模型…', 0.38);
    await preloadGen();
    await stage('搭建人生舱大厅…', 0.40);
    this.hall = new Hall(this.pipe);
    await stage('绘制天空和海面…', 0.49);
    const s = (this.world = new THREE.Scene());
    this.env = new Environment(this.pipe, s);
    await stage('铺设街区和中央广场…', 0.58);
    this.island = new Island(s, this.env);
    this.env.apply();
    await stage('布置角色、锚点与算力总闸…', 0.76);
    this.fx = new Particles(s); this.waves = new Shockwaves(s);
    this.player = new Player(s, this.island, this.audio, this.fx);
    this.rig = new CameraRig(this.pipe.camera);
    this.kanga = new Kangaroo(s); this.niu = new Niulai(s); this.peds = new Peds(s, this.island);
    this.clouds(s);
    this.marker = this.makeMarker(); s.add(this.marker);
    this.guide = new Guide(this);
    this.districts = new Districts(this);
    this.anchors = new AnchorsManager(this);
    this.ui.renderAnchorTracker({
      loop: this.reboot.loop, collected: this.anchors.collected, tracked: this.anchors.tracked,
      intel: this.reboot.intel, vaultActive: this.reboot.vaultActive(),
      mortgagedCount: this.reboot.mortgagedIds().length, kangarooState: this.anchors.kangarooState,
    }, (trackId) => this.selectTrack(trackId));

    if (this.params.get('dev') === '1') this.dev = this.makeDevTools();
    this.makeArrows(s);
    this.orbit = new OrbitControls(this.pipe.camera, this.pipe.renderer.domElement);
    this.orbit.enabled = false; this.orbit.enableDamping = true; this.orbit.maxPolarAngle = 1.52; this.orbit.minDistance = 4; this.orbit.maxDistance = 600;
    document.getElementById('help').addEventListener('click', () => this.toggleHelp());
    if (hasModel('bigfrog')) this.makeBigFrog(s);
    this.views = bindPhotoControls(this);
    this.bindRebootUI();

    if (this.params.get('batch') !== '0') this.batch = batchStatic(this.world, { owners: [this], structural: [this.island.root] });
    await stage('准备灯光和材质…', 0.88);
    this.pipe.renderer.compile(this.hall.scene, this.pipe.camera);
    this.pipe.setScene(this.hall.scene);
    this.state = 'title';
    this.ui.setHumanity(this.reboot);
    this.ui.setStars(0);
    this.ui.showHud(false);
    this.refreshTitleButtons();
    progress('准备就绪', 1);
    if (this.views.has(this.params.get('view'))) this.startView(this.params.get('view'));
    this.loop();
  }

  /** 绑定标题页与 HUD 按钮事件。 */
  bindRebootUI() {
    const rbBtn = document.getElementById('btn-reboot');
    if (rbBtn) rbBtn.onclick = (e) => { e.stopPropagation(); this.openRebootProtocol('你主动按下了重启键——每一次重启都会保留情报，但会带走一部分自己。', true); };
    const perfBtn = document.getElementById('btn-perf');
    if (perfBtn) perfBtn.onclick = (e) => {
      e.stopPropagation();
      const info = this.pipe.cycleTier();
      perfBtn.textContent = `⚡ ${info.label}`;
      this.ui.danmaku(`性能档位已切至：${info.label}（帧率上限 ${info.fpsCap}fps）`, true);
    };
    const nbBtn = document.getElementById('btn-notebook');
    if (nbBtn) nbBtn.onclick = (e) => { e.stopPropagation(); this.toggleNotebook(); };
    const resetBtn = document.getElementById('title-reset');
    if (resetBtn) resetBtn.onclick = (e) => {
      e.stopPropagation();
      this.reboot.resetAll(true);
      this.refreshTitleButtons();
      this.ui.setHumanity(this.reboot);
      this.ui.banner('存档已重置', '回到第 1 世 · 人性完整度 100%');
    };
  }

  refreshTitleButtons() {
    const goBtn = document.getElementById('btn-start');
    const resetBtn = document.getElementById('title-reset');
    if (goBtn) {
      goBtn.textContent = this.reboot.loop > 1
        ? `继续第 ${this.reboot.loop} 世（人性 ${this.reboot.humanityScore()}%）`
        : '开始第 1 世 · 逃出人生舱';
    }
    if (resetBtn) resetBtn.hidden = !(this.reboot.loop > 1 || this.reboot.endingsUnlocked.length > 0);
  }

  selectTrack(id) {
    if (!this.anchors) return;
    this.anchors.tracked = id;
    this.anchors.refreshUI();
    this.audio.pop();
  }

  start() {
    if (this.state !== 'title' || this.photo) return;
    this.audio.start(); this.audio.setMusic(0.45);
    document.getElementById('title').classList.add('off');
    this.hall.resetHero(false);
    // 若存档已是第 2 世及以上，直接跳过开场动画与抽卡，进入地球村继续逃生！
    if (this.reboot.loop > 1) {
      this.ui.setAnchorCardVisible(true);
      this.anchors.startLoop(false);
      return;
    }
    this.state = 'hall'; this.hallT = 0; this.cardsShown = false;
    this.pipe.g.uLetter.value = 1;
    if (!this.auto) this.tl.at(0.6, () => { if (!this.cardsShown) this.ui.skip(true); });
    this.tl.at(0.5, () => this.line(['大肥鱼 AI 客服', '早上好，2079 年最后的活人。距离你的意识被永久归档，只剩 150 秒。'], 4.2));
    this.tl.at(4.8, () => this.line(['大肥鱼 AI 客服', '集齐 3 枚活人锚点并拉下中央广场总闸，你才能拔掉电饭煲醒来。'], 4.2));
    this.tl.at(9.0, () => this.toCards());
  }

  skipHall() {
    if (this.state !== 'hall' || this.cardsShown) return;
    this.tl.clear(); if (window.speechSynthesis) speechSynthesis.cancel();
    this.hallT = Math.max(this.hallT, 16);
    this.toCards();
  }

  async toCards() {
    if (this.cardsShown) return;
    this.cardsShown = true; this.ui.skip(false);
    this.line(['大肥鱼 AI 客服', '今日免费十连！保底出一个……还算鲜活的普通人。'], 3.5);
    await this.ui.drawCards(CARD, this.auto, GACHA_N, (i) => {
      if (i === 'shake') { this.audio.tone('sawtooth', 200, 900, 0.9, 0.12); return; }
      if (i === 'ssr') { this.audio.upgrade(); this.audio.say('恭喜！稀有款：普通人', { pitch: 0.8 }); this.ui.burst(['终于不是富二代了', '普通人才是稀有款', '150 秒逃生开始！'], 5); return; }
      this.audio.tone('square', 600 + i * 60, 900 + i * 60, 0.08, 0.08);
    });
    this.audio.upgrade();
    this.hall.leave = 0.01;
    this.tl.at(0.8, () => { this.flash = 1; this.audio.whoosh(); });
    this.tl.at(1.1, () => this.beginDive());
  }

  line([who, text], dur = 4) {
    this.ui.say(who, text, dur);
    const fish = who.includes('大肥鱼');
    this.audio.say(text, { pitch: fish ? 0.8 : who === '袋鼠' ? 1.5 : 1.15, rate: 1.15 });
    if (fish && this.hall) this.hall.talking = dur;
  }

  // ---------- 空降：精准投放到中央广场南门外（距小电驴仅 14 米，绝不罚跑 170 米！） ----------
  beginDive() {
    this.pipe.setScene(this.world);
    this.state = 'dive';
    this.phase = '';
    this.pipe.g.uLetter.value = 0;
    this.chuteOffered = false;
    this.chuteT = 0;
    // 起点在 (2, 165, 42)，小电驴在 (6, 0, 50)，约 4 秒畅快落地，落地就在电驴旁！
    this.player.startDive(2, 165, 42);
    this.player.yaw = 0.3;
    this.rig.init = false;
    this.ui.showHud(true);
    this.ui.setAnchorCardVisible(false);
    this.line(['大肥鱼 AI 客服', '正在空降地球村！落地骑上小电驴，150 秒内集齐 3 枚活人锚点！'], 4);
    this.ui.objective('朝金色光柱降落 → 骑上小电驴开启第 1 世');
    this.setMarker(this.player.bike.position);
    this.input.lockOk = true;
    this.ui.burst(['投胎成功！', '小电驴就在脚下！', '降落伞呢？？'], 4);
  }

  /** Q 键捧腹大笑技能：随时可放（16 秒冷却），除非「笑声与情绪」已被抵押！ */
  useLaughAbility() {
    const rb = this.reboot;
    if (rb.isMortgaged('laugh')) {
      this.audio.tone('sawtooth', 180, 110, 0.25, 0.18);
      this.glitchT = 0.45;
      this.ui.banner('笑不出来了', '【笑声与情绪】已抵押！去中央广场北侧砸碎胶囊夺回它！');
      this.ui.danmaku('[ERROR] 笑声模块未挂载 · 禁止大笑', true);
      return;
    }
    if (this.laughCool > 0) {
      this.ui.danmaku(`捧腹大笑冷却中（还剩 ${Math.ceil(this.laughCool)} 秒）`, false);
      return;
    }
    this.laughCool = 16;
    const p = this.player;
    this.ui.laughPop(true);
    this.tl.at(2.4, () => this.ui.laughPop(false));
    this.audio.laugh();
    this.pipe.shake = 1.25;
    this.flash = 0.45;
    this.slowT = 0.7;
    this.waves.spawn(p.pos.clone(), 42);
    this.waves.spawn(p.pos.clone(), 70, new THREE.Color(2.8, 1.8, 0.5));
    this.island.blast(p.pos, 55, 34);
    this.peds.blast(p.pos, 55);
    this.fx.confetti(p.pos.clone().setY(4), 160);
    // 震飞附近所有亲戚追兵和 AI 托管幽灵！
    for (const c of this.chasers) if (c.root.position.distanceTo(p.pos) < 55) c.knock(p.pos, p.heading().multiplyScalar(25));
    for (const gh of this.anchors.ghosts) if (gh.root.position.distanceTo(p.pos) < 55) gh.blastFrom(p.pos);
    // 如果袋鼠就在附近，直接笑翻袋鼠截胡痛觉锚！
    if (this.anchors.kangarooState === 'running' && this.kanga.active && this.kanga.root.position.distanceTo(p.pos) < 28) {
      this.anchors.interceptKangaroo();
    }
    this.ui.burst(['哈哈哈哈哈哈！', '把 AI 幽灵笑飞了！', '这就是活人感！'], 6);
  }

  /** 打开《重启算力抵押协议》弹窗（主动按 Backspace 或倒计时归零触发）。 */
  openRebootProtocol(reason, canCancel = false) {
    if (this.modalActive || this.state === 'title' || this.state === 'loading' || this.state === 'finale') return;
    this.modalActive = true;
    if (document.pointerLockElement) document.exitPointerLock();
    this.audio.setEngine(false, 0);
    this.ui.showRebootModal({
      open: true,
      reason,
      rb: this.reboot,
      canCancel,
      onCancel: () => {
        this.modalActive = false;
        this.ui.showRebootModal({ open: false });
      },
      onConfirm: (mortgageId, hubId) => {
        this.modalActive = false;
        this.ui.showRebootModal({ open: false });
        this.reboot.commitReboot(mortgageId, hubId);
        this.anchors.startLoop(false);
      },
    });
  }

  /** 东京人生贩卖机 3 位维护码弹窗。 */
  openVendorKeypad() {
    if (this.modalActive) return;
    this.modalActive = true;
    if (document.pointerLockElement) document.exitPointerLock();
    this.audio.setEngine(false, 0);
    this.ui.showVendorModal({
      open: true,
      expectedCode: this.reboot.intel.cafeCode,
      known: this.reboot.intel.cafeCodeFound,
      onClose: () => { this.modalActive = false; },
      onSuccess: () => {
        this.modalActive = false;
        this.anchors.collectAnchor('absurd', '人生贩卖机吐出了隐藏罐头「真实的一天」！');
      },
      onWrong: () => {
        this.modalActive = false;
        this.audio.crash();
        this.ui.banner('维护码错误！', '贩卖机吐出了愤怒的七大姑！（先去魔都加油咖啡看小票）');
        if (!this.reboot.isMortgaged('bond')) {
          const c = new Chaser(this.world, 'aunt', new THREE.Vector3(100, 0, -94));
          c.say('输错密码还想跑？工资多少！');
          this.chasers.push(c);
        }
      },
    });
  }

  /** 老家县一中班主任早读 3 题快问快答弹窗。 */
  openHometownQuiz() {
    if (this.modalActive) return;
    this.modalActive = true;
    if (document.pointerLockElement) document.exitPointerLock();
    this.audio.setEngine(false, 0);
    this.ui.showQuizModal({
      open: true,
      known: this.reboot.intel.quizSolved,
      onClose: () => { this.modalActive = false; },
      onPass: () => {
        this.modalActive = false;
        this.reboot.discover('quizSolved');
        this.anchors.collectAnchor('memory', '早读 3 题全对！班主任破例放你一马！');
      },
      onFail: (clue) => {
        this.modalActive = false;
        this.audio.crash();
        this.anchors.timeLeft = Math.max(1, this.anchors.timeLeft - 8);
        this.pipe.shake = 0.65;
        this.ui.banner('答错了！耗时 -8 秒', `提示：${clue}`);
        if (!this.reboot.isMortgaged('bond')) {
          const c = new Chaser(this.world, 'teacher', new THREE.Vector3(-94, 0, 62));
          c.say('这道题我讲过没有！站住！');
          this.chasers.push(c);
        }
      },
    });
  }

  /** Tab 打开/关闭跨轮次记忆笔记本。 */
  toggleNotebook() {
    if (this.state !== 'roam' && this.state !== 'free') return;
    if (this.modalActive && !this._notebookOpen) return;
    this._notebookOpen = !this._notebookOpen;
    this.modalActive = this._notebookOpen;
    if (this._notebookOpen && document.pointerLockElement) document.exitPointerLock();
    if (this._notebookOpen) this.audio.setEngine(false, 0);
    this.ui.showNotebookModal({
      open: this._notebookOpen,
      rb: this.reboot,
      collected: this.anchors.collected,
      onClose: () => {
        this._notebookOpen = false;
        this.modalActive = false;
        this.ui.showNotebookModal({ open: false });
      },
    });
  }

  /** 拉下总闸：按人性完整度与是否从回收站夺回代价，播放三重震撼结局之一！ */
  triggerEnding() {
    const ending = this.reboot.computeEnding();
    const elapsed = this.anchors.loopElapsed;
    this.tl.clear();
    this.state = 'finale';
    this.phase = 'finale';
    this.endingMode = ending.id;
    this.finT = 0;
    this.fwT = 0;
    this.modalActive = false;
    if (document.pointerLockElement) document.exitPointerLock();
    this.audio.setEngine(false, 0);
    this.ui.showHud(false);
    this.ui.setHint('');
    this.ui.laughPop(false);
    this.guide.marker(null);
    this.pipe.g.uLetter.value = 1;
    this.clearChasers();

    if (ending.id === 'empty_shell') {
      // 讽刺结局【完美的空壳】：切回冰冷人生舱大厅，奶蛙亮起客服蓝环飘在大肥鱼身旁！
      this.flash = 0.9;
      this.glitchT = 0.9;
      this.pipe.g.uDesat.value = 0.78;
      this.hall.resetHero(true);
      this.pipe.setScene(this.hall.scene);
      this.line(['大肥鱼 AI 客服', ending.bigfishLine], 5);
      this.tl.at(2.8, () => this.ui.title(true, '完美的空壳', '您已剪除多余的人性，正式成为 2079 AI 客服'));
      this.tl.at(5.2, () => this.showEndingReceipt(ending, elapsed));
    } else {
      // 真结局【粗糙的活人】或隐藏逆转结局【违约者：抢回代价】：盛大烟花 + 捧腹大笑大奶蛙！
      this.pipe.g.uDesat.value = 0;
      this.env.coldMode = 0;
      this.env.hour = 20.2;
      this.env.apply(true);
      this.audio.laugh();
      this.flash = 0.85;
      this.fx.confetti(this.player.pos.clone().setY(6), 300);
      if (this.big) {
        this.big.g.visible = true; this.big.t = 0; this.big.s = 0.5; this.big.target = 6.5; this.big.laugh = 0.9;
        this.big.g.position.set(0, 0, 22); this.big.yaw = Math.PI;
        this.player.root.visible = false;
      }
      this.line(['大肥鱼 AI 客服', ending.bigfishLine], 5);
      this.tl.at(1.4, () => this.ui.title(true, ending.title, ending.subtitle));
      this.tl.at(5.2, () => this.showEndingReceipt(ending, elapsed));
    }
  }

  showEndingReceipt(ending, elapsed) {
    this.ui.title(false);
    this.modalActive = true;
    this.ui.showEndingModal({
      open: true,
      ending,
      rb: this.reboot,
      elapsed,
      onReboot: () => {
        this.ui.showEndingModal({ open: false });
        this.modalActive = false;
        this.endingMode = null;
        this.pipe.g.uLetter.value = 0;
        if (this.big) { this.big.target = 0; this.big.g.visible = false; }
        this.player.root.visible = true;
        this.pipe.setScene(this.world);
        this.state = 'roam';
        this.phase = 'loop';
        this.openRebootProtocol('已通关一次结局！想再启一世探索其他结局吗？', false);
      },
      onFree: () => {
        this.ui.showEndingModal({ open: false });
        this.modalActive = false;
        this.endingMode = null;
        this.enterFreeRoam();
      },
      onReset: () => {
        this.ui.showEndingModal({ open: false });
        this.modalActive = false;
        this.endingMode = null;
        this.reboot.resetAll(true);
        this.pipe.g.uLetter.value = 0;
        this.pipe.g.uDesat.value = 0;
        this.env.coldMode = 0;
        this.env.hour = 18.2;
        this.env.apply(true);
        if (this.big) { this.big.target = 0; this.big.g.visible = false; }
        this.player.root.visible = true;
        this.ui.setAnchorCardVisible(true);
        this.anchors.startLoop(false);
      },
    });
  }

  enterFreeRoam() {
    this.pipe.setScene(this.world);
    this.pipe.g.uLetter.value = 0;
    this.state = 'free';
    this.phase = 'free';
    this.mounted = true;
    if (this.big) { this.big.target = 0; this.big.laugh = 0; this.big.g.visible = false; }
    this.player.root.visible = true;
    this.player.mode = 'bike';
    this.districts.teleport(4, 46, Math.PI);
    this.ui.showHud(true);
    this.ui.setAnchorCardVisible(false);
    this.ui.setLoopClock(null, this.reboot.loop, this.anchors.collected.size);
    this.ui.objective('自由闯荡 · 8 个街区彩色光圈支线全开放');
    this.rig.init = false;
  }

  /** 开发/验收快捷工具（?dev=1）。 */
  makeDevTools() {
    const base = devTools(this);
    return {
      ...base,
      startLoop: () => {
        this.tl.clear();
        document.getElementById('title').classList.add('off');
        document.getElementById('cards').classList.remove('on');
        this.audio.start?.();
        this.ui.setAnchorCardVisible(true);
        this.anchors.startLoop(false);
        return 'ok';
      },
      collectAll: () => {
        this.anchors.collectAnchor('absurd', 'dev');
        this.anchors.collectAnchor('memory', 'dev');
        this.anchors.collectAnchor('pain', 'dev');
        return this.anchors.collected.size;
      },
      rebootWith: (moduleId, hub = 'plaza') => {
        this.reboot.commitReboot(moduleId, hub);
        this.ui.setAnchorCardVisible(true);
        this.anchors.startLoop(false);
        return { loop: this.reboot.loop, humanity: this.reboot.humanityScore(), ghosts: this.anchors.ghosts.length };
      },
      smashVault: () => {
        for (const c of this.anchors.capsules) this.anchors.smashCapsule(c);
        this.anchors.refreshUI();
        return this.reboot.humanityScore();
      },
      triggerEnding: () => { this.triggerEnding(); return this.endingMode; },
      resetSave: () => { this.reboot.resetAll(true); return 'reset'; },
    };
  }

  goGray() { return goGray(this); }
  upgrade() { return upgrade(this); }
  makeMarker() { return makeMarker(this); }
  setMarker(p) { return setMarker(this, p); }
  clouds(s) { return clouds(this, s); }

  // ---------- 主循环：带帧率上限与后台暂停，严格控制 CPU/GPU 发热 ----------
  loop() {
    requestAnimationFrame(() => this.loop());
    // 页面切到后台时完全停渲染、停模拟，零功耗
    if (document.hidden) { this.lastNow = performance.now(); return; }
    const now = performance.now();
    const cfg = PERF_TIERS[this.pipe.tier] || PERF_TIERS.balanced;
    const minFrameMs = 1000 / cfg.fpsCap - 1.5;
    if (now - this.lastNow < minFrameMs) return;
    const raw = (now - this.lastNow) / 1000;
    this.lastNow = now;
    const dt = Math.min(raw, 1 / 20);
    this.fps = (this.fps || 60) * 0.94 + 0.06 / Math.max(raw, 1e-3);

    const canTour = (this.state === 'roam' || this.state === 'free') && ['foot', 'bike'].includes(this.player.mode)
      && !this.modalActive && !(this.pptT > 0) && !this.paused && !this.mapOpen;
    if (this.photo || (canTour && this.input.hit('KeyP'))) {
      if (!this.photo) this.togglePhoto(true);
      else if (this.input.hit('KeyP') || this.input.hit('Escape')) this.togglePhoto(false);
      else if (this.input.hit('KeyT')) this.cycleHour();
      if (this.photo) this.updatePhoto(dt);
      this.input.endFrame();
      return;
    }

    if (this.input.hit('Tab') && (this.state === 'roam' || this.state === 'free')) {
      this.toggleNotebook();
      this.input.endFrame();
      return;
    }
    if (this.input.hit('Backspace') && this.state === 'roam' && this.phase === 'loop' && !this.modalActive) {
      this.openRebootProtocol('你主动按下了重启键——每一次重启都会保留情报，但会带走一部分自己。', true);
      this.input.endFrame();
      return;
    }
    if (this.input.hit('KeyH') && this.state !== 'title' && this.state !== 'loading' && !this.mapOpen && !this.modalActive) this.toggleHelp();
    const inWorld = !['title', 'loading', 'hall'].includes(this.state);
    if (inWorld && !this.paused && !this.modalActive && (this.input.hit('KeyM') || (this.mapOpen && this.input.hit('Escape')))) this.toggleMap();

    if (this.paused || this.mapOpen || this.modalActive) {
      if (this.paused && this.input.hit('Escape')) this.toggleHelp();
      if (this._notebookOpen && this.input.hit('Escape')) this.toggleNotebook();
      // 模态弹窗/地图打开时降频渲染，省电不烫手
      this._pauseSkip = (this._pauseSkip || 0) + 1;
      if (this._pauseSkip % 4 === 0) this.pipe.render(0, this.time);
      this.input.endFrame();
      return;
    }

    this.time += dt;
    this.tl.update(dt);
    this.laughCool = Math.max(0, this.laughCool - dt);
    this.timeScale += ((this.slowT > 0 ? 0.28 : 1) - (this.timeScale ?? 1)) * Math.min(1, dt * 6);
    if (this.slowT > 0) this.slowT -= dt;
    const wdt = dt * (this.timeScale ?? 1);

    if (this.state === 'title' || this.state === 'hall') {
      this.updateHall(dt);
    } else if (this.state === 'finale' && this.endingMode === 'empty_shell') {
      this.finT += dt;
      this.hall.update(dt);
      this.hall.camera(this.pipe.camera, this.finT);
    } else {
      this.updateWorld(wdt);
    }

    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 1.4);
    if (this.glitchT > 0) this.glitchT = Math.max(0, this.glitchT - dt * 1.6);
    this.pipe.g.uFlash.value = this.flash || 0;
    this.pipe.g.uGlitch.value = this.glitchT || 0;
    this.ui.update(dt, this.state !== 'title' && this.state !== 'hall');
    this.pipe.render(dt, this.time);
    this.input.endFrame();
  }

  toggleMap() {
    this.mapOpen = !this.mapOpen;
    if (this.mapOpen) this.guide.stats.mapped = true;
    if (this.mapOpen && document.pointerLockElement) document.exitPointerLock();
    const p = this.player, marks = [];
    if (this.phase === 'loop' && this.anchors) {
      marks.push(...this.anchors.mapMarks());
    } else {
      const nav = this.navTarget();
      if (nav) marks.push({ x: nav.pos.x, z: nav.pos.z, color: '#ffc83a', r: 10, label: nav.label });
      marks.push(...this.districts.mapMarks());
    }
    if (p.mode !== 'bike') marks.push({ x: p.bike.position.x, z: p.bike.position.z, color: '#6fffd0', r: 8, label: '小电驴' });
    const areas = [
      ...AREAS.filter((a) => !a[0].includes('AI 生成中') && !this.districts.list.some((d) => d.name === a[0])),
      ...this.districts.mapAreas(),
    ];
    this.ui.bigMap(this.mapOpen, { areas, route: this.navLine, marks, px: p.pos.x, pz: p.pos.z, yaw: p.yaw, goal: this.ui.obj.textContent });
    if (window.speechSynthesis) { if (this.mapOpen) speechSynthesis.pause(); else speechSynthesis.resume(); }
    this.audio.pop();
  }

  startPPT() {
    if (this.reboot.isMortgaged('laugh')) return;
    this.pptT = 2.0; this.pptAcc = 0;
    this.ui.popup('<h3>大肥鱼 AI：正在加载过场动画…</h3><div class="bar"><div></div></div><p>99%（预计剩余：2079 年）</p>', 'ppt', 0);
  }
  endPPT() { this.ui.popupOff(); }

  offerChute() {
    this.chuteOffered = true; this.chuteT = 3.2;
    this.ui.popup('<h3>🪂 降落伞 · 付费功能</h3><p>月卡 ¥6，首月 ¥5.99</p><div class="btns"><span>空格 开通</span><span class="no">不开，硬摔</span></div>', '', 0);
    this.audio.ding();
  }
  chuteAnswer(buy) {
    this.chuteT = 0;
    if (buy) {
      this.ui.popup('<h3>支付失败</h3><p>已为您切换为：自由落体（免费）</p>', 'bad', 1.8);
      this.audio.crash();
    } else {
      this.ui.popupOff();
    }
  }
  warnAlive(why) {
    if (this.reboot.isMortgaged('laugh')) return;
    return warnAlive(this, why);
  }
  toggleHelp() {
    this.paused = this.guide.toggleHelp(this.ui.obj.textContent);
    if (this.paused && document.pointerLockElement) document.exitPointerLock();
    if (window.speechSynthesis) { if (this.paused) speechSynthesis.pause(); else speechSynthesis.resume(); }
  }
  updateHall(dt) {
    this.pipe.bloom.strength = 0.16;
    if (this.state === 'title') {
      this.hall.camera(this.pipe.camera, 0.5 + Math.sin(this.time * 0.2) * 0.5);
      this.hall.update(dt);
      if (!document.activeElement?.matches('button') && (this.input.hit('Space') || this.input.hit('Enter'))) this.start();
      return;
    }
    if (!this.cardsShown && !this.auto && (this.input.hit('Space') || this.input.hit('Enter') || this.input.hit('Escape'))) this.skipHall();
    this.hallT += dt;
    this.hall.update(dt);
    this.hall.camera(this.pipe.camera, this.hallT);
  }
  autoDrive() { return autoDrive(this); }
  setRoute(r) { return setRoute(this, r); }

  togglePhoto(on) {
    if (Boolean(this.photo) === on) return;
    const cam = this.pipe.camera;
    this.photo = on;
    document.body.classList.toggle('touring', on);
    document.getElementById('photo-hint').hidden = !on;
    if (on) {
      this.photoReturn = {
        hour: this.env.hour, speed: this.env.speed, pos: cam.position.clone(), rot: cam.quaternion.clone(),
        fov: cam.fov, lock: this.input.lockOk, hud: this.ui.hud.style.opacity, visible: this.player.root.visible,
        low: this.pipe.g.uLow.value, bloom: this.pipe.bloom.strength, shake: this.pipe.shake,
      };
      this.input.lockOk = false;
      if (document.pointerLockElement) document.exitPointerLock();
      this.photoTime = this.time;
      this.env.speed = 0; this.pipe.g.uLow.value = 0; this.pipe.shake = 0;
      this.orbit.target.copy(this.player.pos); this.orbit.target.y += 2;
      this.orbit.enabled = true; this.ui.showHud(false);
      this.audio.setEngine(false, 0);
      if (this.state !== 'title') window.speechSynthesis?.pause();
      document.getElementById('photo-place').value = 'here';
      this.showRideHere(null);
      document.getElementById('photo-exit').textContent = this.state === 'title' ? '返回标题' : '继续游戏';
      this.setPhotoHour(this.env.hour);
    } else {
      const back = this.photoReturn;
      this.orbit.enableDamping = false; this.orbit.update(); this.orbit.enableDamping = true;
      this.orbit.enabled = false;
      cam.position.copy(back.pos); cam.quaternion.copy(back.rot); cam.fov = back.fov; cam.updateProjectionMatrix();
      this.input.lockOk = back.lock; this.player.root.visible = back.visible;
      this.env.hour = back.hour; this.env.speed = back.speed; this.env.apply(); this.env.update(0, this.player.pos);
      this.pipe.g.uLow.value = back.low; this.pipe.bloom.strength = back.bloom; this.pipe.shake = back.shake;
      this.ui.hud.style.opacity = back.hud;
      if (this.state === 'title') {
        this.pipe.setScene(this.hall.scene);
        document.getElementById('title').classList.remove('off');
        document.getElementById('tour').focus({ preventScroll: true });
      } else window.speechSynthesis?.resume();
    }
  }
  setPhotoHour(hour) {
    this.env.hour = hour; this.env.apply();
    this.hourI = HOURS.reduce((best, h, i) => (Math.abs(h[0] - hour) < Math.abs(HOURS[best][0] - hour) ? i : best), 0);
    const exact = HOURS[this.hourI][0] === hour;
    document.getElementById('photo-hour').textContent = exact ? HOURS[this.hourI][1] : `${Math.floor(hour)} 时`;
    this.pipe.bloom.strength = lerp(0.24, 0.42, this.env.night);
  }
  cycleHour() { this.setPhotoHour(HOURS[(this.hourI + 1) % HOURS.length][0]); }
  frameView(id) {
    const view = this.views.get(id);
    if (!view) return;
    this.orbit.enableDamping = false; this.orbit.update(); this.orbit.enableDamping = true;
    const camera = this.pipe.camera;
    camera.position.fromArray(view.eye); camera.fov = 52; camera.updateProjectionMatrix();
    this.orbit.target.fromArray(view.target); this.orbit.update();
    document.getElementById('photo-place').value = id;
    if (view.hour != null) this.setPhotoHour(view.hour);
    this.showRideHere(view.district);
  }
  showRideHere(district) {
    const allowed = this.state === 'title' || (this.districtTrip && !this.districts.active);
    const button = document.getElementById('photo-ride');
    button.hidden = !district || !allowed;
    const detail = document.getElementById('photo-quest');
    detail.hidden = !district;
    detail.textContent = district ? `${district.quest.title} · ${district.quest.time} 秒` : '';
  }
  rideHere() {
    const district = this.views.get(document.getElementById('photo-place').value)?.district;
    if (!this.photo || !district || (this.state !== 'title' && (!this.districtTrip || this.districts.active))) return;
    const hour = this.env.hour;
    this.togglePhoto(false);
    if (!this.districtTrip) {
      this.districtTrip = true;
      this.auto = false;
      this.state = this.phase = 'free';
      this.mounted = true;
      this.audio.start(); this.audio.setMusic(0.45);
      document.getElementById('title').classList.add('off');
      document.activeElement?.blur();
      this.pipe.setScene(this.world); this.pipe.g.uLetter.value = 0;
      this.setMarker(null);
      this.input.lockOk = true;
      this.ui.showHud(true); this.ui.setAnchorCardVisible(false);
      this.ui.objective('街区自由行 · 在光圈内按 E 接任务');
    }
    this.player.root.visible = true;
    this.player.mode = 'bike';
    const at = district.quest.at;
    const [cx, cz] = district.center;
    this.districts.teleport(at.x, at.z, Math.atan2(cx - at.x, cz - at.z));
    this.env.hour = hour; this.env.speed = 0; this.env.apply(); this.env.update(0, this.player.pos);
    this.ui.setHint(`按 <b>E</b> 接任务：${district.quest.title}`);
  }
  startView(id = 'gate') {
    if (this.state !== 'title' || this.photo) return;
    document.getElementById('title').classList.add('off');
    this.pipe.setScene(this.world);
    this.togglePhoto(true);
    this.player.root.visible = false;
    this.frameView(id);
    const h = this.params.get('hour');
    if (h !== null && h.trim() && Number.isFinite(+h) && +h >= 0 && +h < 24) this.setPhotoHour(+h);
  }
  updatePhoto(dt) {
    this.photoTime += dt;
    this.orbit.update();
    this.island.playerPos = this.orbit.target;
    this.island.updateScenery(dt, this.photoTime);
    this.env.update(dt, this.orbit.target);
    this.pipe.render(dt, this.photoTime);
  }

  updateWorld(dt) {
    const p = this.player, inp = this.input;
    inp.virt = this.auto ? this.autoDrive() : (this.devVirt || null);
    const v = inp.virt || {};
    if (this.state === 'finale') this.finaleCam(dt);

    // 1/2/3/4 快捷切换追踪的锚点或算力回收站
    if (this.phase === 'loop') {
      if (inp.hit('Digit1')) this.selectTrack('absurd');
      else if (inp.hit('Digit2')) this.selectTrack('memory');
      else if (inp.hit('Digit3')) this.selectTrack('pain');
      else if (inp.hit('Digit4') && this.reboot.vaultActive()) this.selectTrack('vault');
    }

    // E 键交互：优先锚点/总闸/回收站 → 街区支线 → 上下小电驴
    if ((inp.hit('KeyE') || v.interact) && this.state !== 'finale') {
      if (inp.hit('KeyE') && this.anchors.tryInteract()) { /* 已交互 */ }
      else if (inp.hit('KeyE') && this.districts.tryInteract()) { /* 接了街区支线 */ }
      else if (p.canMount()) { p.mount(); this.onMount(); }
      else if (p.mode === 'bike' && Math.abs(p.speed) < 4 && !this.auto) { p.dismount(); this.audio.setEngine(false, 0); }
    }

    // Q 键捧腹大笑（在重启循环与自由闯荡中随时可触发，抵押笑声后锁死！）
    if ((inp.hit('KeyQ') || v.laugh) && (this.phase === 'loop' || this.phase === 'free')) {
      this.useLaughAbility();
    }

    if (inp.hit('KeyR') && (this.state === 'roam' || this.state === 'free') && (p.mode === 'foot' || p.mode === 'bike')) this.resetToRoad();

    if (p.mode === 'dive' && !this.chuteOffered && p.pos.y < 120) this.offerChute();
    if (this.chuteT > 0) {
      this.chuteT -= dt;
      if (inp.hit('Space') || (this.auto && this.chuteT < 1.2)) this.chuteAnswer(true);
      else if (this.chuteT <= 0 || p.mode !== 'dive') this.chuteAnswer(false);
    }

    p.update(dt, inp, this.rig.yaw);
    this.island.playerPos = p.pos;
    for (const e of p.events.splice(0)) this.onEvent(e);
    if (this.state === 'dive' || p.mode === 'splat') {
      if (p.mode === 'dive') this.rig.dive(dt, p);
      else this.rig.update(dt, p, inp, true);
    } else if (this.state !== 'finale') {
      this.rig.update(dt, p, inp, this.auto);
    }

    const nav = this.state === 'finale' ? null : this.navTarget();
    this.guide.marker(nav && nav.pos, nav && nav.label, this.pipe.camera);
    this.navLine = nav && this.state !== 'dive' ? this.guide.navRoute(nav.pos, dt) : null;
    this.updateBigFrog(dt);

    this.island.update(dt, this.time);
    this.env.update(dt, p.pos);
    this.kanga.update(dt, p, this.island);
    this.niu.update(dt, this.island, this.fx);
    this.peds.update(dt, p, this.ui, this.audio, this.fx);
    this.fx.update(dt); this.waves.update(dt);
    this.updateMission(dt);
    this.anchors.update(dt);
    this.updateWanted(dt);
    this.updateGrade(dt);
    this.updateHud();
    this.updateQuests(dt);
    this.districts.update(dt);
    this.updateArrows();
    if (this.island.statue) this.island.statue.rotation.y = Math.sin(this.time * 0.2) * 0.1;
  }

  updateKangaroo() { return updateKangaroo(this); }
  updateQuests(dt) { return updateQuests(this, dt); }
  makeArrows(s) { return makeArrows(this, s); }
  updateArrows() { return updateArrows(this); }
  navTarget() { return navTarget(this); }
  resetToRoad() { return resetToRoad(this); }
  makeBigFrog(s) { return makeBigFrog(this, s); }
  updateBigFrog(dt) { return updateBigFrog(this, dt); }
  onMount() { return onMount(this); }
  onEvent(e) { return onEvent(this, e); }
  updateMission(dt) { return updateMission(this, dt); }
  deliver() { return deliver(this); }
  updateWanted(dt) { return updateWanted(this, dt); }
  clearChasers() { return clearChasers(this); }
  bigLaugh() { return bigLaugh(this); }
  finale() { return finale(this); }
  finaleCam(dt) { return finaleCam(this, dt); }
  updateGrade(dt) { return updateGrade(this, dt); }
  updateHud() { return updateHud(this); }
}
