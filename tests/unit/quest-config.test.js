// src/data/quest-config.js —— 任务清单、街区名、外卖路线、笑点阈值、追人种类。
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { QUESTS, AREAS, ROUTE_CAFE, ROUTE_AUNT, ROUTE_NIGHT, STAR_AT, KINDS } from '../../src/data/quest-config.js';

const HEX = /^#[0-9a-f]{6}$/i;
const IDLE = { mounted: false, phase: 'getbike' };
const FREE = { mounted: true, phase: 'free' };

describe('QUESTS', () => {
  it('正好 5 条', () => {
    expect(QUESTS).toHaveLength(5);
  });

  it('每条都有字符串 t 和函数 done', () => {
    for (const [i, q] of QUESTS.entries()) {
      expect(typeof q.t, `QUESTS[${i}].t`).toBe('string');
      expect(q.t.length, `QUESTS[${i}].t`).toBeGreaterThan(0);
      expect(typeof q.done, `QUESTS[${i}].done`).toBe('function');
    }
  });

  it('未骑上电驴、还在 getbike 阶段时全部为 false', () => {
    for (const [i, q] of QUESTS.entries()) {
      expect(q.done(IDLE), `QUESTS[${i}] (${q.t})`).toBe(false);
    }
  });

  it('骑上电驴、进入 free 阶段后全部为 true', () => {
    for (const [i, q] of QUESTS.entries()) {
      expect(q.done(FREE), `QUESTS[${i}] (${q.t})`).toBe(true);
    }
  });

  it('done 返回布尔值而不是真值', () => {
    for (const [i, q] of QUESTS.entries()) {
      expect(typeof q.done(IDLE), `QUESTS[${i}]`).toBe('boolean');
      expect(typeof q.done(FREE), `QUESTS[${i}]`).toBe('boolean');
    }
  });

  it('第一条只看 mounted，不看 phase', () => {
    expect(QUESTS[0].done({ mounted: true, phase: 'getbike' })).toBe(true);
    expect(QUESTS[0].done({ mounted: false, phase: 'free' })).toBe(false);
  });
});

describe('AREAS', () => {
  it('正好 9 个街区', () => {
    expect(AREAS).toHaveLength(9);
  });

  it('每项是 [名字, x, z, #rrggbb]', () => {
    for (const [i, a] of AREAS.entries()) {
      expect(Array.isArray(a), `AREAS[${i}]`).toBe(true);
      expect(a, `AREAS[${i}] 长度`).toHaveLength(4);
      expect(typeof a[0], `AREAS[${i}][0]`).toBe('string');
      expect(a[0].length, `AREAS[${i}][0]`).toBeGreaterThan(0);
      expect(Number.isFinite(a[1]), `AREAS[${i}][1]`).toBe(true);
      expect(Number.isFinite(a[2]), `AREAS[${i}][2]`).toBe(true);
      expect(a[3], `AREAS[${i}][3]`).toMatch(HEX);
    }
  });
});

describe('路线', () => {
  const checkRoute = (route, len, label) => {
    expect(Array.isArray(route), label).toBe(true);
    expect(route, `${label} 长度`).toHaveLength(len);
    for (const [i, p] of route.entries()) {
      expect(p, `${label}[${i}] 不是 Vector3`).toBeInstanceOf(THREE.Vector3);
      expect(Number.isFinite(p.x), `${label}[${i}].x`).toBe(true);
      expect(Number.isFinite(p.z), `${label}[${i}].z`).toBe(true);
      expect(p.y, `${label}[${i}].y`).toBe(0);
    }
  };

  it('ROUTE_CAFE 是 3 个 y=0 的 Vector3', () => {
    checkRoute(ROUTE_CAFE, 3, 'ROUTE_CAFE');
  });

  it('ROUTE_AUNT 是 5 个 y=0 的 Vector3', () => {
    checkRoute(ROUTE_AUNT, 5, 'ROUTE_AUNT');
  });

  it('ROUTE_NIGHT 是 9 个 y=0 的 Vector3', () => {
    checkRoute(ROUTE_NIGHT, 9, 'ROUTE_NIGHT');
  });

  it('三条路线互不相同', () => {
    expect(ROUTE_CAFE).not.toBe(ROUTE_AUNT);
    expect(ROUTE_AUNT).not.toBe(ROUTE_NIGHT);
    expect(ROUTE_CAFE).not.toBe(ROUTE_NIGHT);
  });
});

describe('STAR_AT / KINDS', () => {
  it('STAR_AT 是 [3, 9, 18]', () => {
    expect(STAR_AT).toEqual([3, 9, 18]);
  });

  it('STAR_AT 严格递增', () => {
    expect(STAR_AT.every((v, i) => i === 0 || v > STAR_AT[i - 1])).toBe(true);
  });

  it("KINDS 是 ['mom','teacher','aunt']", () => {
    expect(KINDS).toEqual(['mom', 'teacher', 'aunt']);
  });
});
