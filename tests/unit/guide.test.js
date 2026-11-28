// src/game/guide.js —— 路网导航的纯函数部分（nearestRoad / routeTo）。
// 路网在模块加载时由 core/config.js 的 XR / ZR / BEACH_Z 建好，这里不碰 DOM。
import { describe, it, expect } from 'vitest';
import { nearestRoad, routeTo } from '../../src/game/guide.js';
import { XR, ZR, BEACH_Z } from '../../src/core/config.js';

// ---------- 独立重算一遍路网，用来核对 nearestRoad 的距离 ----------
// 与 guide.js 无关：直接从 config 的数值拼出所有路段，再算点到线段的距离。
const ROAD_SEGS = (() => {
  const segs = [];
  for (const x of XR) for (let i = 0; i + 1 < ZR.length; i++) segs.push([[x, ZR[i]], [x, ZR[i + 1]]]);
  for (const z of ZR) for (let i = 0; i + 1 < XR.length; i++) segs.push([[XR[i], z], [XR[i + 1], z]]);
  for (const x of [-150, 150]) segs.push([[x, ZR[ZR.length - 1]], [x, BEACH_Z]]);
  segs.push([[-150, BEACH_Z], [150, BEACH_Z]]);
  return segs;
})();

function distToSeg(px, pz, [a, b]) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const L2 = dx * dx + dz * dz;
  const t = L2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / L2));
  return Math.hypot(px - (a[0] + dx * t), pz - (a[1] + dz * t));
}

const trueDist = (x, z) => Math.min(...ROAD_SEGS.map((s) => distToSeg(x, z, s)));
// 任务书里的判据：x ∈ XR 或 z ∈ ZR
const onRoad = ([x, z]) => XR.includes(x) || ZR.includes(z);
// 更宽一点：海岸线 z = BEACH_Z 也是路
const onAnyRoad = ([x, z]) => onRoad([x, z]) || z === BEACH_Z;
const polyLen = (pts) => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);

describe('nearestRoad —— 落在路上', () => {
  it('(50, 0) 正好在 x=50 的路上，d === 0', () => {
    const r = nearestRoad(50, 0);
    expect(r.d).toBe(0);
    expect(r.x).toBe(50);
    expect(r.z).toBe(0);
  });

  it('(-150, -100) 是路口，d === 0', () => {
    const r = nearestRoad(-150, -100);
    expect(r.d).toBe(0);
    expect(r.x).toBe(-150);
    expect(r.z).toBe(-100);
  });

  it('每个路口和每条路的采样点 d 都是 0', () => {
    for (const x of XR) for (const z of ZR) expect(nearestRoad(x, z).d, `路口 (${x},${z})`).toBe(0);
    for (const x of XR) expect(nearestRoad(x, 0).d, `x=${x} 路中点`).toBe(0);
    for (const z of ZR) expect(nearestRoad(0, z).d, `z=${z} 路中点`).toBe(0);
    expect(nearestRoad(-150, BEACH_Z).d).toBe(0);
    expect(nearestRoad(150, BEACH_Z).d).toBe(0);
    expect(nearestRoad(0, BEACH_Z).d).toBe(0);
  });
});

describe('nearestRoad —— 离路时的距离', () => {
  it('(0, 0) 的 d 等于独立算出的最小距离', () => {
    const r = nearestRoad(0, 0);
    expect(r.d).toBeCloseTo(trueDist(0, 0), 10);
    expect(r.d).toBe(50); // 到 x=±50 或 z=±50 都是 50
  });

  it('一组离路点的 d 都等于独立算出的最小距离', () => {
    const pts = [
      [0, 0], [10, 10], [-25, 75], [100, 100], [0, 245], [-200, 0], [33, -77], [140, 190], [-149, 149],
      // 远在路网之外：投影必须夹到路段端点上，不能落到无限延长线上
      [0, 400], [-400, 0], [0, -400], [400, 400],
    ];
    for (const [x, z] of pts) {
      expect(nearestRoad(x, z).d, `(${x},${z})`).toBeCloseTo(trueDist(x, z), 10);
    }
  });

  it('投影点确实落在某条路上', () => {
    for (const [x, z] of [[0, 0], [10, 10], [-25, 75], [0, 245], [-200, 0], [140, 190], [0, 400], [-400, 0]]) {
      const r = nearestRoad(x, z);
      expect(onAnyRoad([r.x, r.z]), `(${x},${z}) 的投影 (${r.x},${r.z}) 不在路上`).toBe(true);
    }
  });
});

describe('nearestRoad —— 返回形状', () => {
  it('总是返回 {x, z, a, b, d}，数值有限且 d >= 0', () => {
    const pts = [[0, 0], [50, 0], [-150, -100], [999, -999], [-1e4, 1e4], [0, 245], [150, 210], [7, -3]];
    for (const [x, z] of pts) {
      const r = nearestRoad(x, z);
      expect(r, `(${x},${z})`).not.toBeNull();
      expect(Object.keys(r).sort()).toEqual(['a', 'b', 'd', 'x', 'z']);
      for (const k of ['x', 'z', 'd']) expect(Number.isFinite(r[k]), `(${x},${z}).${k}`).toBe(true);
      expect(r.d).toBeGreaterThanOrEqual(0);
      expect(r.a, `(${x},${z}).a`).toHaveLength(2);
      expect(r.b, `(${x},${z}).b`).toHaveLength(2);
      expect(r.a.every(Number.isFinite), `(${x},${z}).a`).toBe(true);
      expect(r.b.every(Number.isFinite), `(${x},${z}).b`).toBe(true);
    }
  });
});

describe('routeTo —— 同一条路上', () => {
  it('(50,0) → (50,100)：首尾正确，中间点都在路上', () => {
    const pts = routeTo(50, 0, 50, 100);
    expect(pts.length).toBeGreaterThanOrEqual(2);
    expect(pts[0]).toEqual([50, 0]);
    expect(pts[pts.length - 1]).toEqual([50, 100]);
    for (let i = 1; i < pts.length - 1; i++) {
      expect(onRoad(pts[i]), `中间点 ${JSON.stringify(pts[i])} 不在路上`).toBe(true);
    }
  });

  it('同一路段内返回正好 4 个点', () => {
    const pts = routeTo(50, -40, 50, 40);
    expect(pts).toHaveLength(4);
    expect(pts[0]).toEqual([50, -40]);
    expect(pts[3]).toEqual([50, 40]);
  });

  it('起终点重合且在路上时不抛异常，至少 2 个点', () => {
    expect(() => routeTo(50, 0, 50, 0)).not.toThrow();
    const pts = routeTo(50, 0, 50, 0);
    expect(pts.length).toBeGreaterThanOrEqual(2);
    expect(pts[0]).toEqual([50, 0]);
    expect(pts[pts.length - 1]).toEqual([50, 0]);
  });
});

describe('routeTo —— 跨图', () => {
  it('(-150,50) → (150,210)：总长有限且不短于直线距离', () => {
    const pts = routeTo(-150, 50, 150, 210);
    expect(pts[0]).toEqual([-150, 50]);
    expect(pts[pts.length - 1]).toEqual([150, 210]);
    const total = polyLen(pts);
    expect(Number.isFinite(total)).toBe(true);
    expect(total).toBeGreaterThanOrEqual(Math.hypot(300, 160) - 1e-9);
    for (let i = 1; i < pts.length - 1; i++) {
      expect(onRoad(pts[i]), `中间点 ${JSON.stringify(pts[i])} 不在路上`).toBe(true);
    }
  });

  it('离路起点也能规划：首尾是原始坐标', () => {
    const pts = routeTo(0, 0, 150, 210);
    expect(pts[0]).toEqual([0, 0]);
    expect(pts[pts.length - 1]).toEqual([150, 210]);
    expect(Number.isFinite(polyLen(pts))).toBe(true);
  });

  it('多组起终点都不抛异常，且首尾正确、总长有限', () => {
    const pairs = [
      [-150, -150, 150, 150],
      [50, 50, -50, -50],
      [0, 0, 0, 0],
      [-140, -91.5, 91, 230],
      [150, 210, -150, -150],
      [10, 10, 20, 20],
    ];
    for (const [fx, fz, tx, tz] of pairs) {
      const pts = routeTo(fx, fz, tx, tz);
      expect(pts.length, `(${fx},${fz})→(${tx},${tz})`).toBeGreaterThanOrEqual(2);
      expect(pts[0]).toEqual([fx, fz]);
      expect(pts[pts.length - 1]).toEqual([tx, tz]);
      expect(Number.isFinite(polyLen(pts))).toBe(true);
    }
  });

  it('每个点都是 [number, number]', () => {
    for (const p of routeTo(-150, 50, 150, 210)) {
      expect(Array.isArray(p)).toBe(true);
      expect(p).toHaveLength(2);
      expect(Number.isFinite(p[0]) && Number.isFinite(p[1])).toBe(true);
    }
  });
});
