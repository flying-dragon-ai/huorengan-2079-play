// src/core/math.js —— 纯数学工具，零依赖。
import { describe, it, expect } from 'vitest';
import { clamp, lerp, damp, smooth, angleDamp, rng } from '../../src/core/math.js';

// 把角度折回 (-π, π]，用来量"走了多远"
const wrap = (x) => Math.atan2(Math.sin(x), Math.cos(x));

describe('clamp', () => {
  it('区间内的值原样返回', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });

  it('低于下界夹到下界', () => {
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(-1e9, -7, 7)).toBe(-7);
  });

  it('高于上界夹到上界', () => {
    expect(clamp(42, 0, 10)).toBe(10);
    expect(clamp(1e9, -7, 7)).toBe(7);
  });

  it('上下界相等时恒返回该值', () => {
    expect(clamp(3, 5, 5)).toBe(5);
    expect(clamp(9, 5, 5)).toBe(5);
    expect(clamp(-9, 5, 5)).toBe(5);
  });
});

describe('lerp', () => {
  it('t=0 返回起点', () => {
    expect(lerp(3, 11, 0)).toBe(3);
  });

  it('t=1 返回终点', () => {
    expect(lerp(3, 11, 1)).toBe(11);
  });

  it('t=0.5 返回中点', () => {
    expect(lerp(3, 11, 0.5)).toBe(7);
    expect(lerp(-4, 4, 0.5)).toBe(0);
  });

  it('允许外插到 [0,1] 之外', () => {
    expect(lerp(0, 10, 2)).toBe(20);
    expect(lerp(0, 10, -1)).toBe(-10);
    expect(lerp(10, 0, 1.5)).toBe(-5);
  });
});

describe('damp', () => {
  it('dt=0 时返回起始值', () => {
    expect(damp(3, 7, 5, 0)).toBe(3);
    expect(damp(-100, 100, 30, 0)).toBe(-100);
  });

  it('朝目标收敛且不越过目标', () => {
    let v = 0;
    for (let i = 0; i < 200; i++) {
      const next = damp(v, 10, 6, 1 / 60);
      expect(next).toBeGreaterThan(v);
      expect(next).toBeLessThanOrEqual(10);
      v = next;
    }
    expect(v).toBeCloseTo(10, 6);
  });

  it('随 dt 单调递增（同一起点、同一目标）', () => {
    let prev = damp(0, 100, 4, 0);
    for (let dt = 0.01; dt <= 1; dt += 0.01) {
      const v = damp(0, 100, 4, dt);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it('l*dt 很大时几乎等于目标', () => {
    expect(damp(0, 100, 1000, 1)).toBeCloseTo(100, 6);
    expect(damp(-50, 50, 500, 2)).toBeCloseTo(50, 6);
  });

  it('反向收敛（目标小于起点）', () => {
    const v = damp(10, 0, 5, 0.2);
    expect(v).toBeLessThan(10);
    expect(v).toBeGreaterThan(0);
  });
});

describe('smooth', () => {
  const a = -2;
  const b = 6;

  it('区间起点返回 0，终点返回 1', () => {
    expect(smooth(a, b, a)).toBe(0);
    expect(smooth(a, b, b)).toBe(1);
  });

  it('中点返回 0.5', () => {
    expect(smooth(a, b, (a + b) / 2)).toBe(0.5);
    expect(smooth(0, 1, 0.5)).toBe(0.5);
  });

  it('区间外被夹住', () => {
    expect(smooth(a, b, a - 100)).toBe(0);
    expect(smooth(a, b, b + 100)).toBe(1);
  });

  it('等于 smoothstep 公式 t*t*(3-2t)', () => {
    for (let x = a - 2; x <= b + 2; x += 0.25) {
      const t = clamp((x - a) / (b - a), 0, 1);
      expect(smooth(a, b, x)).toBeCloseTo(t * t * (3 - 2 * t), 12);
    }
  });

  it('在区间内单调不减', () => {
    let prev = -Infinity;
    for (let x = a; x <= b; x += 0.05) {
      const v = smooth(a, b, x);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});

describe('angleDamp', () => {
  it('dt=0 时返回起始角', () => {
    expect(angleDamp(3, -3, 5, 0)).toBe(3);
    expect(angleDamp(-1.2, 2.4, 12, 0)).toBe(-1.2);
  });

  it('跨 ±π 时走短弧：3.0 → -3.0 往正方向走', () => {
    const a = 3;
    const b = -3;
    const v = angleDamp(a, b, 10, 0.1);
    // 短弧是 +0.2832 rad（3.0 → 3.2832 ≡ -3.0），长弧是 -5.9999 rad
    expect(v).toBeGreaterThan(a);
    expect(Math.abs(wrap(v - b))).toBeLessThan(Math.abs(wrap(a - b)));
    expect(Math.abs(wrap(v - a))).toBeLessThan(Math.PI);
  });

  it('跨 ±π 时走短弧：-3.0 → 3.0 往负方向走', () => {
    const a = -3;
    const b = 3;
    const v = angleDamp(a, b, 10, 0.1);
    expect(v).toBeLessThan(a);
    expect(Math.abs(wrap(v - b))).toBeLessThan(Math.abs(wrap(a - b)));
  });

  it('普通区间内朝目标收敛', () => {
    let v = 0;
    for (let i = 0; i < 300; i++) v = angleDamp(v, 1, 8, 1 / 60);
    expect(v).toBeCloseTo(1, 6);
  });

  it('每步的角位移不超过 π（永不绕远路）', () => {
    const pairs = [[3, -3], [-3, 3], [0, Math.PI - 1e-6], [Math.PI - 1e-6, 0], [2.9, -2.9]];
    for (const [a, b] of pairs) {
      const v = angleDamp(a, b, 50, 0.5);
      expect(Math.abs(wrap(v - a))).toBeLessThanOrEqual(Math.PI);
    }
  });
});

describe('rng', () => {
  it('同种子产生完全相同的序列', () => {
    const a = rng(12345);
    const b = rng(12345);
    for (let i = 0; i < 32; i++) expect(a()).toBe(b());
  });

  it('两个独立实例的序列一致（确定性）', () => {
    const seqA = Array.from({ length: 16 }, rng(7));
    const seqB = Array.from({ length: 16 }, rng(7));
    expect(seqA).toEqual(seqB);
  });

  it('不同种子产生不同序列', () => {
    const a = Array.from({ length: 16 }, rng(1));
    const b = Array.from({ length: 16 }, rng(2));
    expect(a).not.toEqual(b);
    expect(a.some((v, i) => v !== b[i])).toBe(true);
  });

  it('所有值落在 [0,1)', () => {
    const r = rng(99);
    for (let i = 0; i < 5000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('默认种子可用且可复现', () => {
    const a = Array.from({ length: 8 }, rng());
    const b = Array.from({ length: 8 }, rng());
    expect(a).toEqual(b);
  });

  it('序列不是常数', () => {
    const seq = Array.from({ length: 32 }, rng(2024));
    expect(new Set(seq).size).toBeGreaterThan(1);
  });
});
