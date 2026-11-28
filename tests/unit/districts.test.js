// src/game/districts.js —— 只测不依赖 WebGL 场景的纯逻辑：
// 结算（finish）、中止（abort）、接任务（start / tryInteract）、以及几个纯查询方法。
// 用 Districts.prototype.<name>.call(stub, ...) 直接跑，不构造实例（构造函数要 island / world）。
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Districts } from '../../src/game/districts.js';

const P = Districts.prototype;

function makeQuest(over = {}) {
  return {
    title: '送外卖', kind: '限时', short: '送外卖', time: 30, goal: '把咖啡送到',
    gain: 20, cheer: ['活人感涨了', '这任务有毒'],
    start: () => {}, update: () => ({}), end: () => ['结算一行'],
    at: new THREE.Vector3(0, 0, 0),
    ...over,
  };
}

function makeStub({ meter = 40, laugh = 0, phase = 'free', gain = 20, endLines = ['结算一行'], state = 'roam', mode = 'bike', mounted = true, active = true } = {}) {
  const calls = {
    setTimer: [], setMeter: [], result: [], burst: [], objective: [],
    banner: [], line: [], confetti: 0, coin: 0, crash: 0, ding: 0, end: [],
  };
  const quest = makeQuest({ gain, end: (...a) => { calls.end.push(a); return endLines.slice(); } });
  const d = { id: 'tokyo', name: '东京便利店街', color: '#a46bff', center: [100, -100], quest };
  const other = { id: 'beach', name: '热带海滩', color: '#ffb347', center: [0, 245], quest: makeQuest({ gain: 10, at: new THREE.Vector3(0, 0, 245) }) };
  const g = {
    meter, laugh, phase, state, mounted,
    player: { pos: new THREE.Vector3(1, 2, 3), mode },
    ui: {
      setTimer: (v) => calls.setTimer.push(v),
      setMeter: (v) => calls.setMeter.push(v),
      result: (...a) => calls.result.push(a),
      burst: (...a) => calls.burst.push(a),
      objective: (v) => calls.objective.push(v),
      banner: (...a) => calls.banner.push(a),
    },
    fx: { confetti: () => { calls.confetti++; } },
    audio: { coin: () => { calls.coin++; }, crash: () => { calls.crash++; }, ding: () => { calls.ding++; } },
    line: (...a) => calls.line.push(a),
  };
  // 原型挂上 Districts.prototype，这样 tryInteract 里调 this.sideOk() 也能跑；
  // 但不走构造函数（构造函数要 island / world / WebGL）。
  const stub = Object.assign(Object.create(P), {
    g,
    active: active ? { d, t: 12, note: '', score: 0, startAt: 0 } : null,
    done: new Set(),
    tried: new Set(),
    list: [d, other],
    gags: 0,
    gagSeen: new Set(),
  });
  return { stub, calls, d, other, quest };
}

describe('finish —— 完成任务的结算', () => {
  it('活人感按 quest.gain 增加，并写回 UI', () => {
    const { stub, calls } = makeStub({ meter: 40, gain: 20 });
    P.finish.call(stub, true);
    expect(stub.g.meter).toBe(60);
    expect(calls.setMeter).toEqual([60]);
  });

  it('增益是正数', () => {
    const { stub } = makeStub({ meter: 40, gain: 20 });
    const before = stub.g.meter;
    P.finish.call(stub, true);
    expect(stub.g.meter - before).toBeGreaterThan(0);
  });

  it('结算后 active 清空、街区记入 done、笑点 +20', () => {
    const { stub, calls } = makeStub({ laugh: 5 });
    P.finish.call(stub, true);
    expect(stub.active).toBeNull();
    expect(stub.done.has('tokyo')).toBe(true);
    expect(stub.g.laugh).toBe(25);
    expect(calls.setTimer).toEqual([null]);
    expect(calls.confetti).toBe(1);
    expect(calls.coin).toBe(1);
    expect(calls.crash).toBe(0);
  });

  it('结算文案里带 +gain% 和进度', () => {
    const { stub, calls } = makeStub({ gain: 20 });
    P.finish.call(stub, true);
    expect(calls.result).toHaveLength(1);
    const [lines, dur, title] = calls.result[0];
    expect(Array.isArray(lines)).toBe(true);
    expect(lines.join('\n')).toContain('活人感 +20%');
    expect(lines.join('\n')).toContain('街区任务 1 / 2');
    expect(dur).toBe(6);
    expect(title).toContain('任务完成');
  });

  it('活人感被夹在 0..100，溢出量写进文案', () => {
    const { stub, calls } = makeStub({ meter: 95, gain: 20 });
    P.finish.call(stub, true);
    expect(stub.g.meter).toBe(100);
    expect(stub.g.meter).toBeLessThanOrEqual(100);
    expect(stub.g.meter).toBeGreaterThanOrEqual(0);
    expect(calls.result[0][0].join('\n')).toContain('溢出 15%');
  });

  it('quest 没写 gain 时默认 +12', () => {
    const { stub, calls } = makeStub({ meter: 10 });
    stub.active.d.quest.gain = undefined;
    P.finish.call(stub, true);
    expect(stub.g.meter).toBe(22);
    expect(calls.result[0][0].join('\n')).toContain('活人感 +12%');
  });

  it('重复结算不会二次加分（active 已清空，再结算直接抛错）', () => {
    const { stub } = makeStub({ meter: 40, gain: 20 });
    P.finish.call(stub, true);
    expect(stub.g.meter).toBe(60);
    expect(() => P.finish.call(stub, true)).toThrow();
    expect(stub.g.meter).toBe(60);
    expect(stub.done.size).toBe(1);
  });
});

describe('finish —— 任务失败', () => {
  it('失败固定 +4，不记入 done，笑点 +8，走 crash 音效', () => {
    const { stub, calls } = makeStub({ meter: 40, laugh: 0 });
    P.finish.call(stub, false);
    expect(stub.g.meter).toBe(44);
    expect(stub.done.size).toBe(0);
    expect(stub.g.laugh).toBe(8);
    expect(calls.crash).toBe(1);
    expect(calls.coin).toBe(0);
    expect(calls.confetti).toBe(0);
    expect(calls.result[0][2]).toContain('任务失败');
  });

  it('失败时 meter 也不会超过 100', () => {
    const { stub } = makeStub({ meter: 99 });
    P.finish.call(stub, false);
    expect(stub.g.meter).toBe(100);
  });
});

describe('abort', () => {
  it('清空 active、停表，并以失败调用 quest.end', () => {
    const { stub, calls } = makeStub();
    const a = stub.active;
    P.abort.call(stub);
    expect(stub.active).toBeNull();
    expect(calls.setTimer).toEqual([null]);
    expect(calls.end).toHaveLength(1);
    expect(calls.end[0][1]).toBe(false);
    expect(calls.end[0][2]).toBe(a);
  });
});

describe('sideOk —— 主线空着才能接街区任务', () => {
  const ok = (over) => {
    const { stub } = makeStub(over);
    return P.sideOk.call(stub);
  };

  it('roam/free + 步行/骑车 + 已上车时为 true', () => {
    expect(ok({ state: 'roam', phase: 'free', mode: 'bike', mounted: true })).toBe(true);
    expect(ok({ state: 'free', phase: 'night', mode: 'foot', mounted: true })).toBe(true);
  });

  it('主线在跑计时任务时为 false', () => {
    for (const phase of ['pickup', 'deliver', 'order', 'laughing']) {
      expect(ok({ state: 'roam', phase, mode: 'bike', mounted: true }), phase).toBe(false);
    }
  });

  it('没上车、或还在 dive 模式时为 false', () => {
    expect(ok({ state: 'roam', phase: 'free', mode: 'bike', mounted: false })).toBe(false);
    expect(ok({ state: 'roam', phase: 'free', mode: 'dive', mounted: true })).toBe(false);
  });

  it('不在 roam/free 状态时为 false', () => {
    expect(ok({ state: 'title', phase: 'free', mode: 'bike', mounted: true })).toBe(false);
    expect(ok({ state: 'finale', phase: 'free', mode: 'bike', mounted: true })).toBe(false);
  });
});

describe('start / tryInteract', () => {
  it('start 建出 active，记下 quest.time 并标记 tried', () => {
    const { stub, calls, d } = makeStub();
    P.start.call(stub, d);
    expect(stub.active).not.toBeNull();
    expect(stub.active.d).toBe(d);
    expect(stub.active.t).toBe(d.quest.time);
    expect(stub.tried.has('tokyo')).toBe(true);
    expect(calls.banner).toHaveLength(1);
    expect(calls.ding).toBe(1);
  });

  it('站在光圈里按 E 能接任务', () => {
    const { stub, d } = makeStub({ active: false });
    stub.g.player.pos.set(0, 0, 0); // quest.at 就是 (0,0,0)
    expect(P.tryInteract.call(stub)).toBe(true);
    expect(stub.active.d).toBe(d);
  });

  it('离光圈太远按 E 不接任务', () => {
    const { stub } = makeStub({ active: false });
    stub.g.player.pos.set(100, 0, 100);
    expect(P.tryInteract.call(stub)).toBe(false);
    expect(stub.active).toBeNull();
  });

  it('已经有任务在做时按 E 不接新任务', () => {
    const { stub } = makeStub({ active: false });
    stub.g.player.pos.set(0, 0, 0);
    expect(P.tryInteract.call(stub)).toBe(true);
    expect(P.tryInteract.call(stub)).toBe(false);
  });
});

describe('纯查询方法', () => {
  it('questItems 列出所有带任务的街区', () => {
    const { stub } = makeStub();
    const items = P.questItems.call(stub);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ id: 'tokyo', done: false, side: true });
    expect(items[0].t).toContain('东京便利店街');
    stub.done.add('tokyo');
    expect(P.questItems.call(stub)[0].done).toBe(true);
  });

  it('mapAreas 输出 [名字, x, z, 颜色]', () => {
    const { stub } = makeStub();
    expect(P.mapAreas.call(stub)).toEqual([
      ['东京便利店街', 100, -100, '#a46bff'],
      ['热带海滩', 0, 245, '#ffb347'],
    ]);
  });

  it('mapMarks 只标没做完的街区任务', () => {
    const { stub } = makeStub();
    const marks = P.mapMarks.call(stub);
    expect(marks).toHaveLength(2);
    expect(marks[0]).toMatchObject({ x: 0, z: 0, color: '#a46bff', r: 7 });
    stub.done.add('tokyo');
    expect(P.mapMarks.call(stub)).toHaveLength(1);
  });

  it('nearestQuest 返回离玩家最近的未完成街区', () => {
    const { stub, other } = makeStub();
    stub.g.player.pos.set(0, 0, 240); // 离海滩 (0,245) 只有 5
    expect(P.nearestQuest.call(stub)).toBe(other);
    stub.done.add('beach');
    expect(P.nearestQuest.call(stub).id).toBe('tokyo');
  });

  it('gagFired 累加计数并记录 id', () => {
    const { stub } = makeStub();
    P.gagFired.call(stub, 'a');
    P.gagFired.call(stub, 'b');
    P.gagFired.call(stub, 'a');
    expect(stub.gags).toBe(3);
    expect([...stub.gagSeen].sort()).toEqual(['a', 'b']);
  });

  it('navTarget 有任务在做时指 active.nav', () => {
    const { stub } = makeStub();
    const nav = { pos: new THREE.Vector3(1, 0, 2), label: '送外卖' };
    stub.active.nav = nav;
    expect(P.navTarget.call(stub)).toBe(nav);
  });

  it('navTarget 主线空着时指最近的未完成光圈', () => {
    const { stub } = makeStub({ active: false, phase: 'free' });
    stub.g.player.pos.set(0, 0, 240);
    const t = P.navTarget.call(stub);
    expect(t).not.toBeNull();
    expect(t.pos).toBe(stub.list[1].quest.at);
    expect(t.label).toContain('热带海滩');
  });

  it('navTarget 主线在跑计时任务时为 null', () => {
    const { stub } = makeStub({ active: false, phase: 'deliver' });
    expect(P.navTarget.call(stub)).toBeNull();
  });
});
