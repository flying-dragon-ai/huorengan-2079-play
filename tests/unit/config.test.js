// src/core/config.js —— 路网与海岸线基准值。
import { describe, it, expect } from 'vitest';
import { XR, ZR, ROAD_W, BEACH_Z, WORLD } from '../../src/core/config.js';

const ascending = (arr) => arr.every((v, i) => i === 0 || v > arr[i - 1]);

describe('XR / ZR', () => {
  it('XR 是严格递增的数字数组，值固定', () => {
    expect(Array.isArray(XR)).toBe(true);
    expect(XR).toEqual([-150, -50, 50, 150]);
    expect(XR.every((v) => typeof v === 'number' && Number.isFinite(v))).toBe(true);
    expect(ascending(XR)).toBe(true);
  });

  it('ZR 是严格递增的数字数组，值固定', () => {
    expect(Array.isArray(ZR)).toBe(true);
    expect(ZR).toEqual([-150, -100, -50, 50, 150]);
    expect(ZR.every((v) => typeof v === 'number' && Number.isFinite(v))).toBe(true);
    expect(ascending(ZR)).toBe(true);
  });
});

describe('ROAD_W / BEACH_Z', () => {
  it('ROAD_W === 14', () => {
    expect(ROAD_W).toBe(14);
  });

  it('BEACH_Z === 210', () => {
    expect(BEACH_Z).toBe(210);
  });
});

describe('WORLD 分组视图', () => {
  it('对象被冻结', () => {
    expect(Object.isFrozen(WORLD)).toBe(true);
  });

  it('成员与具名导出是同一绑定', () => {
    expect(WORLD.XR).toBe(XR);
    expect(WORLD.ZR).toBe(ZR);
    expect(WORLD.ROAD_W).toBe(ROAD_W);
    expect(WORLD.BEACH_Z).toBe(BEACH_Z);
  });

  it('只有这四个键', () => {
    expect(Object.keys(WORLD).sort()).toEqual(['BEACH_Z', 'ROAD_W', 'XR', 'ZR']);
  });
});

describe('世界几何依赖的不变量', () => {
  it('XR 每个值都是 50 的整数倍', () => {
    for (const x of XR) expect(Math.abs(x % 50), `XR 里的 ${x}`).toBe(0);
  });

  it('ZR 严格递增', () => {
    expect(ascending(ZR)).toBe(true);
  });

  it('BEACH_Z 大于 ZR 里的每一个值', () => {
    for (const z of ZR) expect(BEACH_Z).toBeGreaterThan(z);
  });

  it('ROAD_W 为正，且小于 XR 相邻值的最小间距', () => {
    expect(ROAD_W).toBeGreaterThan(0);
    const gaps = XR.slice(1).map((v, i) => v - XR[i]);
    expect(Math.min(...gaps)).toBeGreaterThan(ROAD_W);
  });

  it('ROAD_W 也小于 ZR 相邻值的最小间距（路不会互相压掉）', () => {
    const gaps = ZR.slice(1).map((v, i) => v - ZR[i]);
    expect(Math.min(...gaps)).toBeGreaterThan(ROAD_W);
  });
});
