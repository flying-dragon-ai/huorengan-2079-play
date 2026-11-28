// src/data/text.js —— 台词 / 弹幕 / 梗角色。只查完整性与形状，不改内容。
import { describe, it, expect } from 'vitest';
import { LINES, DANMAKU, MEMES, MEME3D, MEME_SPOTS, CHOIR, ROAD_MEME, GACHA_N, TIPS, CARD } from '../../src/data/text.js';
import { KINDS } from '../../src/data/quest-config.js';

const HEX = /^#[0-9a-f]{6}$/i;
const COORD_KEY = /^-?\d+,-?\d+$/;
const MOVES = ['waddle', 'hop', 'sway', 'still'];

const isStr = (v) => typeof v === 'string' && v.length > 0;
const isPair = (v) => Array.isArray(v) && v.length === 2 && v.every(isStr);
const isPairList = (v) => Array.isArray(v) && v.length > 0 && v.every(isPair);
const isStrList = (v) => Array.isArray(v) && v.length > 0 && v.every(isStr);
const isStrMap = (v) => !!v && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).length > 0 && Object.values(v).every(isStrList);

// 递归收集所有字符串，用来查空串
function collectStrings(v, out = []) {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) for (const x of v) collectStrings(x, out);
  else if (v && typeof v === 'object') for (const k of Object.keys(v)) collectStrings(v[k], out);
  return out;
}

describe('LINES', () => {
  it('是非空对象', () => {
    expect(LINES).toBeTypeOf('object');
    expect(Object.keys(LINES).length).toBeGreaterThan(0);
  });

  it('每个值都是 [说话人, 台词] 对、对数组、字符串或字符串数组的映射', () => {
    for (const [k, v] of Object.entries(LINES)) {
      const ok = isPair(v) || isPairList(v) || isStr(v) || isStrMap(v);
      expect(ok, `LINES.${k} 形状不对：${JSON.stringify(v).slice(0, 80)}`).toBe(true);
    }
  });

  it('对数组里的每一条都是两个字符串', () => {
    for (const [k, v] of Object.entries(LINES)) {
      if (!isPairList(v)) continue;
      for (const pair of v) {
        expect(pair, `LINES.${k}`).toHaveLength(2);
        expect(isStr(pair[0]) && isStr(pair[1]), `LINES.${k} 有空串`).toBe(true);
      }
    }
  });

  it('chasers 覆盖 quest-config 里的每一种追人 NPC', () => {
    expect(LINES.chasers).toBeTypeOf('object');
    for (const kind of KINDS) {
      expect(Array.isArray(LINES.chasers[kind]), `LINES.chasers.${kind} 缺失`).toBe(true);
      expect(LINES.chasers[kind].length).toBeGreaterThan(0);
      expect(LINES.chasers[kind].every(isStr)).toBe(true);
    }
  });
});

describe('DANMAKU', () => {
  it('是非空的字符串数组', () => {
    expect(Array.isArray(DANMAKU)).toBe(true);
    expect(DANMAKU.length).toBeGreaterThan(0);
    expect(DANMAKU.every(isStr)).toBe(true);
  });
});

describe('MEMES（纸板立牌）', () => {
  it('是非空数组，每项有 name / line / color / face', () => {
    expect(Array.isArray(MEMES)).toBe(true);
    expect(MEMES.length).toBeGreaterThan(0);
    for (const m of MEMES) {
      expect(m).toBeTypeOf('object');
      for (const f of ['name', 'line', 'color', 'face']) expect(isStr(m[f]), `MEMES.${m.name}.${f}`).toBe(true);
      expect(m.color, `MEMES.${m.name}.color`).toMatch(HEX);
    }
  });
});

describe('MEME3D（3D 热梗路人）', () => {
  it('是非空对象，每项有 name / say / hit / move / emote', () => {
    expect(MEME3D).toBeTypeOf('object');
    expect(Object.keys(MEME3D).length).toBeGreaterThan(0);
    for (const [k, m] of Object.entries(MEME3D)) {
      for (const f of ['name', 'say', 'hit', 'move', 'emote']) expect(isStr(m[f]), `MEME3D.${k}.${f}`).toBe(true);
      expect(MOVES, `MEME3D.${k}.move`).toContain(m.move);
    }
  });

  it('sfx 出现时是 [靠近, 被撞] 两个字符串', () => {
    for (const [k, m] of Object.entries(MEME3D)) {
      if (m.sfx === undefined) continue;
      expect(Array.isArray(m.sfx), `MEME3D.${k}.sfx`).toBe(true);
      expect(m.sfx).toHaveLength(2);
      expect(m.sfx.every(isStr), `MEME3D.${k}.sfx`).toBe(true);
    }
  });

  it('dead 出现时是布尔值', () => {
    for (const [k, m] of Object.entries(MEME3D)) {
      if (m.dead === undefined) continue;
      expect(typeof m.dead, `MEME3D.${k}.dead`).toBe('boolean');
    }
  });
});

describe('MEME_SPOTS / CHOIR', () => {
  const checkSpots = (list, label) => {
    expect(Array.isArray(list), label).toBe(true);
    expect(list.length, label).toBeGreaterThan(0);
    for (const s of list) {
      expect(Array.isArray(s), `${label} 项`).toBe(true);
      expect(s, `${label} 项长度`).toHaveLength(3);
      expect(isStr(s[0]), `${label} 名字`).toBe(true);
      expect(Number.isFinite(s[1]), `${label} ${s[0]} x`).toBe(true);
      expect(Number.isFinite(s[2]), `${label} ${s[0]} z`).toBe(true);
      expect(MEME3D[s[0]], `${label} 引用了不存在的模型 ${s[0]}`).toBeTypeOf('object');
    }
  };

  it('MEME_SPOTS 是 [模型, x, z] 且模型都在 MEME3D 里', () => {
    checkSpots(MEME_SPOTS, 'MEME_SPOTS');
  });

  it('CHOIR 是 [模型, x, z] 且模型都在 MEME3D 里', () => {
    checkSpots(CHOIR, 'CHOIR');
  });
});

describe('ROAD_MEME', () => {
  it('是 Set，元素都是 "x,z" 形式的字符串', () => {
    expect(ROAD_MEME).toBeInstanceOf(Set);
    expect(ROAD_MEME.size).toBeGreaterThan(0);
    for (const k of ROAD_MEME) {
      expect(typeof k).toBe('string');
      expect(k, `ROAD_MEME 里的 ${k}`).toMatch(COORD_KEY);
    }
  });

  it('每个坐标都能在 MEME_SPOTS 里找到对应的路人', () => {
    const spots = new Set(MEME_SPOTS.map(([, x, z]) => `${x},${z}`));
    for (const k of ROAD_MEME) expect(spots.has(k), `ROAD_MEME 的 ${k} 不在 MEME_SPOTS 里`).toBe(true);
  });
});

describe('GACHA_N / TIPS', () => {
  it('GACHA_N 是非空的字符串数组', () => {
    expect(Array.isArray(GACHA_N)).toBe(true);
    expect(GACHA_N.length).toBeGreaterThan(0);
    expect(GACHA_N.every(isStr)).toBe(true);
  });

  it('TIPS 是非空的字符串数组', () => {
    expect(Array.isArray(TIPS)).toBe(true);
    expect(TIPS.length).toBeGreaterThan(0);
    expect(TIPS.every(isStr)).toBe(true);
  });
});

describe('CARD', () => {
  it('有 place / role / talent 三个非空字符串', () => {
    expect(CARD).toBeTypeOf('object');
    for (const f of ['place', 'role', 'talent']) expect(isStr(CARD[f]), `CARD.${f}`).toBe(true);
  });
});

describe('全局：没有空字符串', () => {
  it('所有字符串集合里都不含空串或纯空白', () => {
    const all = collectStrings({ LINES, DANMAKU, MEMES, MEME3D, MEME_SPOTS, CHOIR, GACHA_N, TIPS, CARD });
    expect(all.length).toBeGreaterThan(0);
    const bad = all.filter((s) => s.trim().length === 0);
    expect(bad, `发现 ${bad.length} 个空字符串`).toEqual([]);
  });
});
