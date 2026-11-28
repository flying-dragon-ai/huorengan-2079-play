// 导演：开场 → 抽卡 → 空降 → 360P → 骑电驴 → 送外卖 → 入夜 → 捧腹大笑 → 大结局
// 这里只留 Game 门面（构造、加载、主循环、大厅、观景、世界编排）；
// 任务线在 mission.js，自动驾驶与角色事件在 auto-pilot.js，被催星在 wanted.js，画质在 quality.js。
import * as THREE from 'three';
import { Pipeline, Environment } from '../gfx/pipeline.js';
import { Particles, Shockwaves } from '../gfx/fx.js';
import { batchStatic } from '../gfx/batch.js';
import { Island } from '../world/island.js';
import { Player, CameraRig } from '../actors/player.js';
import { Kangaroo, Niulai, Peds } from '../actors/npc/index.js';
import { preload, preloadGen, hasModel, MODEL_CONF } from '../actors/models.js';
import { Hall } from './hall.js';
import { UI } from './ui.js';
import { HOURS, bindPhotoControls } from './photo.js';
import { Guide } from './guide.js';
import { Districts, devTools } from './districts.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Input } from '../core/input.js';
import { Audio } from '../audio/audio.js';
import { LINES, CARD, GACHA_N } from '../data/text.js';
import { AREAS } from '../data/quest-config.js';
import { Timeline, lerp } from '../core/util.js';
import {
  makeMarker, setMarker, setRoute, updateQuests, makeArrows, updateArrows, navTarget, resetToRoad,
  updateMission, deliver, bigLaugh, finale, finaleCam, updateHud,
} from './mission.js';
import { autoDrive, updateKangaroo, makeBigFrog, updateBigFrog, onMount, onEvent } from './auto-pilot.js';
import { updateWanted, clearChasers, warnAlive } from './wanted.js';
import { goGray, upgrade, updateGrade, clouds } from './quality.js';

/**
 * 游戏导演：持有所有子系统，负责开场、加载、主循环和世界编排。
 * 具体玩法逻辑在 mission / auto-pilot / wanted / quality 四个模块里，这里只做一行转发。
 */
export class Game {
  constructor(canvas) {
    this.params = new URLSearchParams(location.search);
    this.auto = this.params.get('auto') === '1';
    this.pipe = new Pipeline(canvas);
    this.input = new Input(canvas);
    this.audio = new Audio();
    this.ui = new UI();
    this.tl = new Timeline();
    this.state = 'loading';
    this.meter = 3; this.laugh = 0; this.stars = 0; this.chasers = [];
    this.timeScale = 1; this.slowT = 0; this.pptT = 0; this.warnAt = -99; this.overT = 0; this.airT = 0;
    this.lastNow = performance.now(); this.time = 0; // 不用 THREE.Clock（r180 会报弃用警告）
  }
  async init(progress) {
    const names = Object.keys(MODEL_CONF);
    let n = 0;
    const stage = async (label, fraction) => {
      progress(label, fraction);
      await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
    };
    await stage('准备角色…', 0.02);
    await preload(names, () => progress(`准备角色… ${++n}/${names.length}`, .04 + .34*n/names.length));
    await stage('载入街区生成模型…', .38);
    await preloadGen();
    await stage('搭建人生舱大厅…', .40);
    this.hall = new Hall(this.pipe);
    await stage('绘制天空和海面…', .49);
    const s = (this.world = new THREE.Scene());
    this.env = new Environment(this.pipe, s);
    await stage('铺设街区和中央广场…', .58);
    this.island = new Island(s, this.env);
    this.env.apply();
    await stage('布置角色和任务…', .76);
    this.fx = new Particles(s); this.waves = new Shockwaves(s);
    this.player = new Player(s, this.island, this.audio, this.fx);
    this.rig = new CameraRig(this.pipe.camera);
    this.kanga = new Kangaroo(s); this.niu = new Niulai(s); this.peds = new Peds(s, this.island);
    this.clouds(s);
    this.marker = this.makeMarker(); s.add(this.marker);
    this.guide = new Guide(this);
    this.districts = new Districts(this);
    if (this.params.get('dev') === '1') this.dev = devTools(this);
    this.makeArrows(s);
    // 观景模式（P）：鼠标拖动旋转、滚轮缩放、右键平移，T 换时间
    this.orbit = new OrbitControls(this.pipe.camera, this.pipe.renderer.domElement);
    this.orbit.enabled = false; this.orbit.enableDamping = true; this.orbit.maxPolarAngle = 1.52; this.orbit.minDistance = 4; this.orbit.maxDistance = 600;
    document.getElementById('help').addEventListener('click', () => this.toggleHelp());
    if (hasModel('bigfrog')) this.makeBigFrog(s);
    this.views = bindPhotoControls(this);
    // 静态批处理：只把「除了父子链没人引用」的不透明网格按材质合并，
    // 画面不变、draw call 大幅减少。?batch=0 关掉做 A/B 对照。
    if (this.params.get('batch') !== '0') this.batch = batchStatic(this.world, { owners: [this], structural: [this.island.root] });
    await stage('准备灯光和材质…', .88);
    // 预编译着色器，避免切场景时卡顿
    // 精细主角蒙皮在首次镜头前编译即可，不在loading末尾为全岛每个视角强制编译
    // 避免蒙皮材质和全岛环境同时创建大量GPU程序导致浏览器内存峰值
    // 让GLTF中首次出现的蒙皮材质在角色实际镜头前按需编译；不为所有材质重复预编译
    this.pipe.renderer.compile(this.hall.scene, this.pipe.camera);
    if (this.params.get('debugLoad') === '1') {
      let meshes=0,bones=0,verts=0;
      s.traverse(o=>{if(o.isMesh)meshes++;if(o.isBone)bones++;if(o.isSkinnedMesh)verts+=o.geometry.attributes.position.count});
      console.log('[load-stats]',JSON.stringify({meshes,bones,verts}));
    }
    this.pipe.setScene(this.hall.scene);
    this.state = 'title';
    this.ui.setMeter(this.meter); this.ui.setStars(0); this.ui.showHud(false);
    this.ui.setQuality('画质：全特效');
    progress('准备就绪', 1);
    if (this.views.has(this.params.get('view'))) this.startView(this.params.get('view'));
    this.loop();
  }
  start() {
    if (this.state !== 'title' || this.photo) return;
    this.audio.start(); this.audio.setMusic(0.5);
    document.getElementById('title').classList.add('off');
    this.state = 'hall'; this.hallT = 0; this.cardsShown = false;
    this.pipe.g.uLetter.value = 1;
    if (!this.auto) this.tl.at(1.2, () => { if (!this.cardsShown) this.ui.skip(true); });
    const L = LINES.hall;
    this.tl.at(2, () => this.line(L[0], 5));
    this.tl.at(8, () => this.line(L[1], 5));
    this.tl.at(13.5, () => this.line(L[2], 4.5));
    this.tl.at(18, () => this.toCards());
  }
  // 开场过场可以跳过：直接到抽卡
  skipHall() {
    if (this.state !== 'hall' || this.cardsShown) return;
    this.tl.clear(); if (window.speechSynthesis) speechSynthesis.cancel();
    this.hallT = Math.max(this.hallT, 16);
    this.line(LINES.hall[2], 3.5);
    this.toCards();
  }
  async toCards() {
    if (this.cardsShown) return;
    this.cardsShown = true; this.ui.skip(false);
    this.line(['大肥鱼 AI 客服', '今日免费十连！保底出一个……普通人。'], 4);
    await this.ui.drawCards(CARD, this.auto, GACHA_N, (i) => {
      if (i === 'shake') { this.audio.tone('sawtooth', 200, 900, 1.2, 0.12); return; }
      if (i === 'ssr') { this.audio.upgrade(); this.audio.say('恭喜！稀有款：普通人', { pitch: 0.8 }); this.ui.burst(['终于不是富二代了', '普通人才是稀有款', '这卡池有问题', '欧皇！'], 6); return; }
      this.audio.tone('square', 600 + i * 60, 900 + i * 60, 0.1, 0.1);
      if (i === 4) this.ui.say('大肥鱼 AI 客服', '又是富二代。系统正在排查卡池。', 2.5);
    });
    this.audio.upgrade();
    this.hall.leave = 0.01;
    this.tl.at(1.0, () => { this.flash = 1; this.audio.whoosh(); });
    this.tl.at(1.4, () => this.beginDive());
  }
  line([who, text], dur = 4) {
    this.ui.say(who, text, dur);
    const fish = who.includes('大肥鱼');
    this.audio.say(text, { pitch: fish ? 0.8 : who === '袋鼠' ? 1.5 : 1.2, rate: 1.15 });
    if (fish && this.hall) this.hall.talking = dur;
  }
  // ---------- 空降 ----------
  beginDive() {
    this.pipe.setScene(this.world);
    this.state = 'dive';
    this.pipe.g.uLetter.value = 0;
    this.player.startDive(-60, 430, -110);
    this.player.yaw = 0.5;
    this.rig.init = false;
    this.ui.showHud(true);
    this.line(LINES.dive[0], 4.5);
    this.tl.at(5, () => this.line(LINES.dive[1], 4));
    this.ui.objective('朝金色光柱降落 · WASD 操控');
    this.setMarker(this.player.bike.position); // 光柱立在小电驴上，落地后好找
    this.input.lockOk = true;
    this.ui.burst(['投胎成功', '这天空也太好看了', '要摔了要摔了', '降落伞呢？？'], 4);
  }
  goGray() { return goGray(this); }
  upgrade() { return upgrade(this); }
  makeMarker() { return makeMarker(this); }
  setMarker(p) { return setMarker(this, p); }
  clouds(s) { return clouds(this, s); }
  // ---------- 主循环 ----------
  loop() {
    requestAnimationFrame(() => this.loop());
    const now = performance.now(), raw = (now - this.lastNow) / 1000; this.lastNow = now;
    const dt = Math.min(raw, 1 / 20);
    this.fps = (this.fps || 60) * 0.97 + 0.03 / Math.max(raw, 1e-3); // 测帧率用
    const canTour = (this.state === 'roam' || this.state === 'free') && ['foot', 'bike'].includes(this.player.mode)
      && this.phase !== 'laughing' && !(this.pptT > 0) && !this.paused && !this.mapOpen;
    if (this.photo || (canTour && this.input.hit('KeyP'))) {
      if (!this.photo) this.togglePhoto(true);
      else if (this.input.hit('KeyP') || this.input.hit('Escape')) this.togglePhoto(false);
      else if (this.input.hit('KeyT')) this.cycleHour();
      if (this.photo) this.updatePhoto(dt);
      this.input.endFrame();
      return;
    }
    // H：操作说明。打开时整个游戏暂停，画面停在这一帧
    if (this.input.hit('KeyH') && this.state !== 'title' && this.state !== 'loading' && !this.mapOpen) this.toggleHelp();
    // M：全岛大地图，打开时也暂停
    const inWorld = !['title', 'loading', 'hall'].includes(this.state);
    if (inWorld && !this.paused && (this.input.hit('KeyM') || (this.mapOpen && this.input.hit('Escape')))) this.toggleMap();
    if (this.paused || this.mapOpen) {
      if (this.paused && this.input.hit('Escape')) this.toggleHelp();
      this.pipe.render(0, this.time); this.input.endFrame(); return;
    }
    this.time += dt;
    this.tl.update(dt);
    // 慢动作（捧腹大笑的冲击波）
    this.timeScale += ((this.slowT > 0 ? 0.22 : 1) - (this.timeScale ?? 1)) * Math.min(1, dt * 6);
    if (this.slowT > 0) this.slowT -= dt;
    const wdt = dt * (this.timeScale ?? 1);
    if (this.state === 'title' || this.state === 'hall') this.updateHall(dt);
    else this.updateWorld(wdt);
    if (this.flash > 0) { this.flash = Math.max(0, this.flash - dt * 1.4); }
    this.pipe.g.uFlash.value = this.flash || 0;
    this.ui.update(dt, this.state !== 'title' && this.state !== 'hall');
    // 假过场：“正在加载”的时候画面卡成 PPT，半秒才动一下
    if (this.pptT > 0) {
      this.pptT -= dt; this.pptAcc = (this.pptAcc || 0) + dt;
      if (this.pptAcc > 0.45) { this.pptAcc = 0; this.pipe.render(dt, this.time); }
      if (this.pptT <= 0) { this.pptT = 0; this.endPPT(); }
    } else this.pipe.render(dt, this.time);
    this.input.endFrame();
  }
  toggleMap() {
    this.mapOpen = !this.mapOpen;
    if (this.mapOpen) this.guide.stats.mapped = true;
    if (this.mapOpen && document.pointerLockElement) document.exitPointerLock();
    const p = this.player, marks = [];
    const nav = this.navTarget();
    if (nav) marks.push({ x: nav.pos.x, z: nav.pos.z, color: '#ffc83a', r: 11, label: nav.label });
    if (p.mode !== 'bike') marks.push({ x: p.bike.position.x, z: p.bike.position.z, color: '#6fffd0', r: 8, label: '小电驴' });
    if (this.kanga.active || this.kanga.taunt) marks.push({ x: this.kanga.root.position.x, z: this.kanga.root.position.z, color: '#ff9a3a', r: 8, label: '袋鼠' });
    for (const c of this.chasers) marks.push({ x: c.root.position.x, z: c.root.position.z, color: '#ff4a6a', r: 7 });
    marks.push({ x: this.island.cafe.x, z: this.island.cafe.z, color: '#c89a6a', r: 6, label: nav && nav.label.startsWith('咖啡') ? '' : '咖啡店' });
    marks.push({ x: this.island.auntSpot.x, z: this.island.auntSpot.z, color: '#ff9f6b', r: 6, label: nav && nav.label.startsWith('七大姑') ? '' : '七大姑' });
    marks.push(...this.districts.mapMarks());
    const areas = [...AREAS.filter((a) => !this.districts.list.some((d) => d.name === a[0] || (d.replaces || []).includes(a[0] + a[1] + ',' + a[2]))), ...this.districts.mapAreas()];
    this.ui.bigMap(this.mapOpen, { areas, route: this.navLine, marks, px: p.pos.x, pz: p.pos.z, yaw: p.yaw, goal: this.ui.obj.textContent });
    if (window.speechSynthesis) { if (this.mapOpen) speechSynthesis.pause(); else speechSynthesis.resume(); }
    this.audio.pop();
  }
  // ---------- 假过场 ----------
  startPPT() {
    this.pptT = 2.6; this.pptAcc = 0;
    this.ui.popup('<h3>大肥鱼 AI：正在加载取餐过场动画…</h3><div class="bar"><div></div></div><p>99%（预计剩余：2079 年）</p>', 'ppt', 0);
    this.audio.say('正在加载过场动画，请稍候', { pitch: 0.8 });
  }
  endPPT() {
    this.ui.popup('<h3>加载失败，已跳过</h3><p>已自动扣款 <b>¥80</b>（咖啡）</p><p>余额：活人感 20%</p>', 'bad', 2.4);
    this.audio.coin(); this.ui.burst(['卡成 PPT 了', '这是 3A 大作吗', '已扣 80 哈哈哈', '退钱！'], 5);
  }
  // ---------- 降落伞：付费功能 ----------
  offerChute() {
    this.chuteOffered = true; this.chuteT = 4.5;
    this.ui.popup('<h3>🪂 降落伞 · 付费功能</h3><p>月卡 ¥6，首月 ¥5.99</p><div class="btns"><span>空格 开通</span><span class="no">不开，硬摔</span></div>', '', 0);
    this.audio.ding();
  }
  chuteAnswer(buy) {
    this.chuteT = 0;
    if (buy) {
      this.ui.popup('<h3>支付失败</h3><p>余额不足：活人感 3%</p><p>已为您切换为：自由落体（免费）</p>', 'bad', 2.4);
      this.audio.crash(); this.ui.burst(['白嫖失败', '降落伞要钱的吗', '月卡 6 块哈哈', '投胎还要充值'], 5);
    } else {
      this.ui.popup('<h3>已为您选择：硬摔</h3><p>感谢支持免费模式</p>', '', 2);
      this.ui.burst(['硬摔警告', '勇士', '省了 6 块'], 3);
    }
  }
  warnAlive(why) { return warnAlive(this, why); }
  toggleHelp() {
    this.paused = this.guide.toggleHelp(this.ui.obj.textContent);
    if (this.paused && document.pointerLockElement) document.exitPointerLock();
    if (window.speechSynthesis) { if (this.paused) speechSynthesis.pause(); else speechSynthesis.resume(); }
  }
  updateHall(dt) {
    this.pipe.bloom.strength = 0.3;
    if (this.state === 'title') { this.hall.camera(this.pipe.camera, 0.5 + Math.sin(this.time * 0.2) * 0.5); this.hall.update(dt); if (!document.activeElement?.matches('button') && (this.input.hit('Space') || this.input.hit('Enter'))) this.start(); return; }
    if (!this.cardsShown && !this.auto && (this.input.hit('Space') || this.input.hit('Enter') || this.input.hit('Escape'))) this.skipHall();
    this.hallT += dt;
    this.hall.update(dt);
    this.hall.camera(this.pipe.camera, this.hallT);
  }
  autoDrive() { return autoDrive(this); }
  setRoute(r) { return setRoute(this, r); }
  // ---------- 观景模式 ----------
  togglePhoto(on) {
    if (Boolean(this.photo) === on) return;
    const cam = this.pipe.camera;
    this.photo = on;
    document.body.classList.toggle('touring', on);
    document.getElementById('photo-hint').hidden = !on;
    if (on) {
      this.photoReturn = { hour: this.env.hour, speed: this.env.speed, pos: cam.position.clone(), rot: cam.quaternion.clone(),
        fov: cam.fov, lock: this.input.lockOk, hud: this.ui.hud.style.opacity, visible: this.player.root.visible,
        low: this.pipe.g.uLow.value, bloom: this.pipe.bloom.strength, shake: this.pipe.shake };
      this.input.lockOk = false;
      if (document.pointerLockElement) document.exitPointerLock();
      this.photoTime = this.time;
      this.env.speed = 0; this.pipe.g.uLow.value = 0; this.pipe.shake = 0;
      this.orbit.target.copy(this.player.pos); this.orbit.target.y += 2;
      this.orbit.enabled = true; this.ui.showHud(false);
      this.audio.setEngine(false,0);
      if (this.state !== 'title') window.speechSynthesis?.pause();
      document.getElementById('photo-place').value = 'here';
      this.showRideHere(null);
      document.getElementById('photo-exit').textContent = this.state === 'title' ? '返回标题' : '继续游戏';
      this.setPhotoHour(this.env.hour);
    } else {
      const back = this.photoReturn;
      // 清掉拖动惯性，再恢复原镜头。
      this.orbit.enableDamping = false; this.orbit.update(); this.orbit.enableDamping = true;
      this.orbit.enabled = false;
      cam.position.copy(back.pos); cam.quaternion.copy(back.rot); cam.fov = back.fov; cam.updateProjectionMatrix();
      this.input.lockOk = back.lock; this.player.root.visible = back.visible;
      this.env.hour = back.hour; this.env.speed = back.speed; this.env.apply(); this.env.update(0,this.player.pos);
      this.pipe.g.uLow.value = back.low; this.pipe.bloom.strength = back.bloom; this.pipe.shake = back.shake;
      this.ui.hud.style.opacity = back.hud;
      if (this.state === 'title') {
        this.pipe.setScene(this.hall.scene);
        document.getElementById('title').classList.remove('off');
        document.getElementById('tour').focus({ preventScroll:true });
      } else window.speechSynthesis?.resume();
    }
  }
  setPhotoHour(hour) {
    this.env.hour = hour; this.env.apply();
    this.hourI = HOURS.reduce((best, h, i) => Math.abs(h[0]-hour) < Math.abs(HOURS[best][0]-hour) ? i : best, 0);
    const exact = HOURS[this.hourI][0] === hour;
    document.getElementById('photo-hour').textContent = exact ? HOURS[this.hourI][1] : `${Math.floor(hour)} 时`;
    this.pipe.bloom.strength = lerp(.27, .45, this.env.night);
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
      this.audio.start(); this.audio.setMusic(0.5);
      document.getElementById('title').classList.add('off');
      document.activeElement?.blur();
      this.pipe.setScene(this.world); this.pipe.g.uLetter.value = 0;
      this.setMarker(null);
      this.input.lockOk = true;
      this.ui.showHud(true); this.ui.objective('街区自由行 · 在光圈内按 E 接任务');
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
    this.island.updateScenery(dt, this.photoTime);
    this.env.update(dt, this.orbit.target);
    this.pipe.render(dt, this.photoTime);
  }
  updateWorld(dt) {
    const p = this.player, inp = this.input;
    inp.virt = this.auto ? this.autoDrive() : (this.devVirt || null);
    const v = inp.virt || {};
    if (this.state === 'finale') this.finaleCam(dt);
    // 交互
    if ((inp.hit('KeyE') || v.interact) && this.state !== 'finale') {
      if (inp.hit('KeyE') && this.districts.tryInteract()) { /* 接了街区任务 */ }
      else if (p.canMount()) { p.mount(); this.onMount(); }
      else if (p.mode === 'bike' && Math.abs(p.speed) < 3 && !this.auto) { p.dismount(); this.audio.setEngine(false, 0); }
    }
    if ((inp.hit('KeyQ') || v.laugh) && this.phase === 'laughReady') this.bigLaugh();

    // R：卡住了，奶蛙和小电驴一起回到最近的路上
    if (inp.hit('KeyR') && (this.state === 'roam' || this.state === 'free') && (p.mode === 'foot' || p.mode === 'bike')) this.resetToRoad();

    // 降落伞付费：掉到 330 米弹出来
    if (p.mode === 'dive' && !this.chuteOffered && p.pos.y < 330) this.offerChute();
    if (this.chuteT > 0) {
      this.chuteT -= dt;
      if (inp.hit('Space') || (this.auto && this.chuteT < 1.6)) this.chuteAnswer(true);
      else if (this.chuteT <= 0 || p.mode !== 'dive') this.chuteAnswer(false);
    }
    // 活人感过高：开太快或者飞太高
    if (p.mode === 'bike' && this.state === 'roam') {
      this.overT = Math.abs(p.speed) > 25.5 ? this.overT + dt : 0;
      this.airT = p.air ? this.airT + dt : 0;
      if ((this.overT > 1.2 || this.airT > 0.9) && this.time - this.warnAt > 30) this.warnAlive(this.overT > 1.2 ? '车速超过 90 km/h，像个活人' : '电驴飞起来了，像个活人');
    }

    p.update(dt, inp, this.rig.yaw);
    for (const e of p.events.splice(0)) this.onEvent(e);
    if (this.state === 'dive' || p.mode === 'splat') { if (p.mode === 'dive') this.rig.dive(dt, p); else this.rig.update(dt, p, inp, true); }
    else if (this.state !== 'finale') this.rig.update(dt, p, inp, this.auto);

    // 新手指引、目的地标记、小地图导航线
    const nav = this.state === 'finale' ? null : this.navTarget();
    this.guide.marker(nav && nav.pos, nav && nav.label, this.pipe.camera);
    this.navLine = nav && this.state !== 'dive' ? this.guide.navRoute(nav.pos, dt) : null;
    this.guide.update(dt);
    if (!this.auto && (this.state === 'roam' || this.state === 'free')) {
      const [ax, ay] = inp.axis();
      if (this.guide.stuck(dt, ax !== 0 || ay !== 0)) this.ui.say('小贴士', '卡住了？按 <kbd>R</kbd>，奶蛙和小电驴一起回到路上', 5);
    }
    this.updateBigFrog(dt);

    this.island.update(dt, this.time);
    this.env.update(dt, p.pos);
    this.kanga.update(dt, p, this.island);
    this.niu.update(dt, this.island, this.fx);
    this.peds.update(dt, p, this.ui, this.audio, this.fx);
    this.fx.update(dt); this.waves.update(dt);
    this.updateMission(dt);
    this.updateWanted(dt);
    this.updateGrade(dt);
    this.updateHud();
    this.updateKangaroo();
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
