import { describe, it, expect } from 'vitest';
import { RebootState } from '../../src/game/reboot.js';
import {
  HUMANITY_MODULES, ANCHOR_DEFS, HOMETOWN_QUIZ, LOOP_DURATION, LAUGH_BONUS_TIME, ENDINGS,
} from '../../src/data/reboot-config.js';

describe('「重启的代价」配置与状态机', () => {
  it('配置完整：5 枚活人模块、3 枚锚点、3 道早读题、3 重结局', () => {
    expect(HUMANITY_MODULES).toHaveLength(5);
    expect(ANCHOR_DEFS).toHaveLength(3);
    expect(HOMETOWN_QUIZ).toHaveLength(3);
    expect(Object.keys(ENDINGS)).toEqual(['true_human', 'empty_shell', 'vault_rebel']);
    for (const q of HOMETOWN_QUIZ) {
      expect(q.options.length).toBe(3);
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThan(3);
    }
  });

  it('初始第 1 世：人性完整度 100%、无抵押、150 秒倒计时、回收站未激活', () => {
    const rb = new RebootState({ persist: false });
    expect(rb.loop).toBe(1);
    expect(rb.humanityScore()).toBe(100);
    expect(rb.mortgagedIds()).toEqual([]);
    expect(rb.loopDuration()).toBe(LOOP_DURATION);
    expect(rb.vaultActive()).toBe(false);
    expect(rb.ghostTracks).toHaveLength(0);
  });

  it('重启抵押代价：每抵押 1 项扣 20% 人性，记录上一世幽灵轨迹，保留情报', () => {
    const rb = new RebootState({ persist: false });
    rb.discover('cafeCodeFound');
    for (let i = 0; i < 8; i++) rb.recordPoint(0.45, i * 3, -10, 0.5, 'bike');
    rb.commitReboot('laugh');

    expect(rb.loop).toBe(2);
    expect(rb.isMortgaged('laugh')).toBe(true);
    expect(rb.humanityScore()).toBe(80);
    expect(rb.loopDuration()).toBe(LOOP_DURATION + LAUGH_BONUS_TIME);
    expect(rb.intel.cafeCodeFound).toBe(true);
    expect(rb.ghostTracks).toHaveLength(1);
    expect(rb.ghostTracks[0].loop).toBe(1);
    expect(rb.vaultActive()).toBe(false);

    // 再重启一次并抵押 color → 累计 2 项抵押，激活中央广场算力回收站
    for (let i = 0; i < 6; i++) rb.recordPoint(0.45, i * 2, 20, 1.0, 'bike');
    rb.commitReboot('color');
    expect(rb.loop).toBe(3);
    expect(rb.humanityScore()).toBe(60);
    expect(rb.vaultActive()).toBe(true);
    expect(rb.intel.vaultDiscovered).toBe(true);
    expect(rb.ghostTracks).toHaveLength(2);
  });

  it('三重结局判定：粗糙的活人 / 完美的空壳 / 违约者抢回代价', () => {
    // 结局 A：0~1 次重启直接通关
    const a = new RebootState({ persist: false });
    expect(a.computeEnding().id).toBe('true_human');

    // 结局 B：抵押 ≥3 项人性（人性 ≤40%）后通关 → 讽刺伪结局
    const b = new RebootState({ persist: false });
    b.commitReboot('color');
    b.commitReboot('bond');
    b.commitReboot('pain');
    expect(b.humanityScore()).toBe(40);
    expect(b.computeEnding().id).toBe('empty_shell');

    // 结局 C：抵押 ≥2 项后在算力回收站砸碎全部胶囊夺回人性 → 隐藏逆转结局
    const c = new RebootState({ persist: false });
    c.commitReboot('color');
    c.commitReboot('bond');
    expect(c.vaultActive()).toBe(true);
    expect(c.reclaimModule('color')).toBe(true);
    expect(c.reclaimModule('bond')).toBe(true);
    expect(c.humanityScore()).toBe(100);
    expect(c.computeEnding().id).toBe('vault_rebel');
  });

  it('幽灵轨迹最多保留最近 4 世，防止内存无限增长', () => {
    const rb = new RebootState({ persist: false });
    for (let l = 0; l < 6; l++) {
      for (let i = 0; i < 6; i++) rb.recordPoint(0.5, i, l, 0, 'bike');
      rb.commitReboot(null);
    }
    expect(rb.ghostTracks).toHaveLength(4);
    expect(rb.ghostTracks[0].loop).toBe(3);
    expect(rb.ghostTracks[3].loop).toBe(6);
  });
});
