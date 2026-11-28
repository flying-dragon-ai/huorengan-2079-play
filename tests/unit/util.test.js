// src/core/util.js —— Timeline 计时器 + 数学工具的整体转出。
import { describe, it, expect } from 'vitest';
import * as util from '../../src/core/util.js';
import * as math from '../../src/core/math.js';

const { Timeline } = util;

describe('Timeline', () => {
  it('at() 排的回调在累计时间够之前不触发', () => {
    const tl = new Timeline();
    let fired = 0;
    tl.at(0.5, () => { fired++; });
    tl.update(0.4);
    expect(fired).toBe(0);
    tl.update(0.05);
    expect(fired).toBe(0);
    tl.update(0.1);
    expect(fired).toBe(1);
  });

  it('到点后只触发一次', () => {
    const tl = new Timeline();
    let fired = 0;
    tl.at(0.1, () => { fired++; });
    tl.update(1);
    tl.update(1);
    tl.update(1);
    expect(fired).toBe(1);
  });

  it('多个回调按延迟顺序触发', () => {
    const tl = new Timeline();
    const order = [];
    tl.at(0.1, () => order.push('a'));
    tl.at(0.2, () => order.push('b'));
    tl.at(0.3, () => order.push('c'));
    tl.update(0.15);
    expect(order).toEqual(['a']);
    tl.update(0.1);
    expect(order).toEqual(['a', 'b']);
    tl.update(0.1);
    expect(order).toEqual(['a', 'b', 'c']);
  });

  it('一次大步长里到点的回调全部触发，且保持延迟顺序', () => {
    const tl = new Timeline();
    const order = [];
    tl.at(0.1, () => order.push(1));
    tl.at(0.2, () => order.push(2));
    tl.at(0.3, () => order.push(3));
    tl.update(10);
    expect(order).toEqual([1, 2, 3]);
  });

  it('update 期间新排的回调不会在同一 tick 触发', () => {
    const tl = new Timeline();
    let inner = 0;
    tl.at(0.1, () => { tl.at(0, () => { inner++; }); });
    tl.update(0.2);
    expect(inner).toBe(0);
    tl.update(0.01);
    expect(inner).toBe(1);
  });

  it('clear() 丢掉所有待触发的回调', () => {
    const tl = new Timeline();
    let fired = 0;
    tl.at(0.1, () => { fired++; });
    tl.at(0.2, () => { fired++; });
    tl.clear();
    tl.update(10);
    expect(fired).toBe(0);
    expect(tl.items).toHaveLength(0);
  });

  it('clear() 不重置已流逝的时间', () => {
    const tl = new Timeline();
    tl.update(5);
    expect(tl.t).toBe(5);
    tl.clear();
    expect(tl.t).toBe(5);
  });

  it('update 返回 undefined 且不抛异常', () => {
    const tl = new Timeline();
    expect(() => tl.update(0)).not.toThrow();
    expect(tl.update(0.016)).toBeUndefined();
    tl.at(0, () => {});
    expect(tl.update(0.016)).toBeUndefined();
  });

  it('延迟是相对排入时刻计算的', () => {
    const tl = new Timeline();
    let fired = 0;
    tl.update(10);
    tl.at(1, () => { fired++; });
    tl.update(0.5);
    expect(fired).toBe(0);
    tl.update(0.6);
    expect(fired).toBe(1);
  });
});

describe('util 转出 math 的六个纯函数', () => {
  const names = ['clamp', 'lerp', 'damp', 'smooth', 'angleDamp', 'rng'];

  it('六个名字都在 util 上', () => {
    for (const n of names) expect(typeof util[n]).toBe('function');
  });

  it('util.X 与 math.X 是同一个函数引用', () => {
    for (const n of names) expect(util[n]).toBe(math[n]);
  });
});
