// 「重启的代价」状态管理：循环世数、5 枚活人模块抵押/夺回、跨轮次记忆笔记本、旧自己幽灵轨迹与三重结局判定。
// 纯逻辑类，不直接依赖 DOM 或 WebGL，便于 Vitest 单元测试。
import { HUMANITY_MODULES, LOOP_DURATION, LAUGH_BONUS_TIME, ENDINGS } from '../data/reboot-config.js';

const STORAGE_KEY = 'huorengan2079_reboot_v1';

function generateCafeCode(seed) {
  const pool = ['807', '279', '404', '996', '520', '880'];
  return pool[Math.abs(seed) % pool.length];
}

export class RebootState {
  constructor({ persist = true } = {}) {
    this.persist = persist;
    this.resetAll(false);
    if (persist) this.load();
  }

  /** 完全重置为全新存档（第 1 世、人性 100%、无记忆线索、无幽灵）。 */
  resetAll(saveNow = true) {
    this.loop = 1;
    this.totalReboots = 0;
    this.reclaimedEver = false;
    this.spawnHub = 'plaza';
    this.modules = {};
    for (const m of HUMANITY_MODULES) {
      this.modules[m.id] = { mortgaged: false, reclaimed: false };
    }
    this.intel = {
      cafeCode: generateCafeCode(Math.floor(Math.random() * 1000) + 2079),
      cafeCodeFound: false,
      subwayFound: false,
      quizSolved: false,
      kangarooAmbushFound: false,
      vaultDiscovered: false,
    };
    /** @type {Array<{ loop: number, points: Array<[number, number, number, number]> }>} */
    this.ghostTracks = [];
    this.currentTrack = [];
    this._recAcc = 0;
    this.endingsUnlocked = [];
    if (saveNow && this.persist) this.save();
  }

  /** 是否已抵押且尚未夺回某项活人模块。 */
  isMortgaged(id) {
    const s = this.modules[id];
    return !!(s && s.mortgaged && !s.reclaimed);
  }

  /** 是否已夺回某项活人模块。 */
  isReclaimed(id) {
    const s = this.modules[id];
    return !!(s && s.reclaimed);
  }

  /** 当前仍处于抵押状态（被 AI 扣押）的模块 id 列表。 */
  mortgagedIds() {
    return HUMANITY_MODULES.map((m) => m.id).filter((id) => this.isMortgaged(id));
  }

  /** 当前还可选作抵押的活人模块列表（从未抵押，或已被夺回）。 */
  availableToMortgage() {
    return HUMANITY_MODULES.filter((m) => !this.isMortgaged(m.id));
  }

  /** 人性完整度（0–100）：每保留 1 枚活人模块 = 20%。 */
  humanityScore() {
    const intact = HUMANITY_MODULES.filter((m) => !this.isMortgaged(m.id)).length;
    return Math.round((intact / HUMANITY_MODULES.length) * 100);
  }

  /** 当前循环应得的倒计时总秒数（抵押「笑声与情绪」+35s）。 */
  loopDuration() {
    return LOOP_DURATION + (this.isMortgaged('laugh') ? LAUGH_BONUS_TIME : 0);
  }

  /** 是否满足激活中央广场「算力回收站（抢回代价）」的条件（抵押 ≥2 项）。 */
  vaultActive() {
    return this.mortgagedIds().length >= 2;
  }

  /** 记录本轮玩家轨迹采样点（每 0.4 秒记一次，最多保留 450 点）。 */
  recordPoint(dt, x, z, yaw, mode) {
    this._recAcc += dt;
    if (this._recAcc < 0.4) return;
    this._recAcc = 0;
    if (this.currentTrack.length >= 450) return;
    this.currentTrack.push([
      Math.round(x * 10) / 10,
      Math.round(z * 10) / 10,
      Math.round(yaw * 100) / 100,
      mode === 'bike' ? 1 : 0,
    ]);
  }

  /**
   * 执行重启：封存当前轨迹为 AI 幽灵，抵押选中的 1 项活人模块，递增循环世数。
   * @param {'color'|'bond'|'pain'|'laugh'|'memory'|null} mortgageId
   * @param {string} [spawnHub]
   */
  commitReboot(mortgageId, spawnHub = 'plaza') {
    if (this.currentTrack.length >= 5) {
      this.ghostTracks.push({ loop: this.loop, points: this.currentTrack.slice() });
      if (this.ghostTracks.length > 4) this.ghostTracks.shift();
    }
    this.currentTrack = [];
    this._recAcc = 0;

    if (mortgageId && this.modules[mortgageId]) {
      this.modules[mortgageId].mortgaged = true;
      this.modules[mortgageId].reclaimed = false;
    }
    this.loop += 1;
    this.totalReboots += 1;
    this.spawnHub = this.isMortgaged('memory') ? (spawnHub || 'plaza') : 'plaza';
    if (this.vaultActive()) this.intel.vaultDiscovered = true;
    if (this.persist) this.save();
  }

  /** 暴力砸碎算力回收站里的某枚抵押胶囊，当场夺回该活人模块！ */
  reclaimModule(id) {
    const s = this.modules[id];
    if (!s || !s.mortgaged || s.reclaimed) return false;
    s.reclaimed = true;
    this.reclaimedEver = true;
    if (this.persist) this.save();
    return true;
  }

  /** 标记一条跨轮次情报为已发现。 */
  discover(key) {
    if (key in this.intel && !this.intel[key]) {
      this.intel[key] = true;
      if (this.persist) this.save();
      return true;
    }
    return false;
  }

  /**
   * 拉下总闸时计算三重结局：
   * - 曾从回收站暴力夺回被抵押模块且最终人性 ≥80% → 隐藏真结局【违约者：抢回代价】
   * - 抵押仍剩 ≥3 项（人性 ≤40%） → 讽刺伪结局【完美的空壳】
   * - 否则（0–2 项抵押，人性 ≥60%） → 真结局【粗糙的活人】
   */
  computeEnding() {
    const mortgagedCount = this.mortgagedIds().length;
    let id = 'true_human';
    if (this.reclaimedEver && mortgagedCount === 0) id = 'vault_rebel';
    else if (mortgagedCount >= 3) id = 'empty_shell';
    else id = 'true_human';
    if (!this.endingsUnlocked.includes(id)) {
      this.endingsUnlocked.push(id);
      if (this.persist) this.save();
    }
    return ENDINGS[id];
  }

  save() {
    try {
      if (typeof localStorage === 'undefined') return;
      const data = {
        loop: this.loop,
        totalReboots: this.totalReboots,
        reclaimedEver: this.reclaimedEver,
        spawnHub: this.spawnHub,
        modules: this.modules,
        intel: this.intel,
        ghostTracks: this.ghostTracks,
        endingsUnlocked: this.endingsUnlocked,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch { /* 隐私模式忽略 */ }
  }

  load() {
    try {
      if (typeof localStorage === 'undefined') return;
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (!d || typeof d.loop !== 'number') return;
      this.loop = Math.max(1, d.loop);
      this.totalReboots = d.totalReboots || 0;
      this.reclaimedEver = !!d.reclaimedEver;
      this.spawnHub = d.spawnHub || 'plaza';
      if (d.modules) {
        for (const m of HUMANITY_MODULES) {
          if (d.modules[m.id]) {
            this.modules[m.id] = {
              mortgaged: !!d.modules[m.id].mortgaged,
              reclaimed: !!d.modules[m.id].reclaimed,
            };
          }
        }
      }
      if (d.intel) Object.assign(this.intel, d.intel);
      if (Array.isArray(d.ghostTracks)) this.ghostTracks = d.ghostTracks.slice(-4);
      if (Array.isArray(d.endingsUnlocked)) this.endingsUnlocked = d.endingsUnlocked;
    } catch { /* 损坏存档自动忽略 */ }
  }
}
