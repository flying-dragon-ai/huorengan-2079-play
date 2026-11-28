// src/data/model-registry.js —— 模型登记表，并与磁盘上的 assets/models 交叉核对。
import { describe, it, expect } from 'vitest';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODEL_CONF, FACE_X } from '../../src/data/model-registry.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const MODEL_DIR = path.join(ROOT, 'assets', 'models');

const EXPECTED_KEYS = [
  'agentpenguin', 'bigfrog', 'buding', 'catbanana', 'catoiia', 'daodun', 'duck', 'ebike',
  'fantasy', 'frogknight', 'frogschool', 'gugugaga', 'kangaroo', 'minotaur', 'naiwa',
  'niulai', 'opossum', 'penguin', 'rabbit', 'whalemaid', 'wukong', 'xiaoxing',
];

const entries = Object.entries(MODEL_CONF);

describe('MODEL_CONF 键集', () => {
  it('正好 22 条', () => {
    expect(entries).toHaveLength(22);
  });

  it('键集与预期完全一致', () => {
    expect(Object.keys(MODEL_CONF).sort()).toEqual(EXPECTED_KEYS);
  });
});

describe('每条登记项的形状', () => {
  it('h 是有限正数', () => {
    for (const [name, c] of entries) {
      expect(Number.isFinite(c.h), `${name}.h`).toBe(true);
      expect(c.h, `${name}.h`).toBeGreaterThan(0);
    }
  });

  it('yaw 是有限数', () => {
    for (const [name, c] of entries) {
      expect(Number.isFinite(c.yaw), `${name}.yaw`).toBe(true);
    }
  });

  it('有 file 时是非空字符串', () => {
    for (const [name, c] of entries) {
      if (c.file === undefined) continue;
      expect(typeof c.file, `${name}.file`).toBe('string');
      expect(c.file.length, `${name}.file`).toBeGreaterThan(0);
    }
  });

  it('有 tripo 时是布尔值', () => {
    for (const [name, c] of entries) {
      if (c.tripo === undefined) continue;
      expect(typeof c.tripo, `${name}.tripo`).toBe('boolean');
    }
  });

  it('有 long 时是有限正数', () => {
    for (const [name, c] of entries) {
      if (c.long === undefined) continue;
      expect(Number.isFinite(c.long), `${name}.long`).toBe(true);
      expect(c.long, `${name}.long`).toBeGreaterThan(0);
    }
  });
});

describe('FACE_X', () => {
  it('等于 -Math.PI / 2', () => {
    expect(FACE_X).toBe(-Math.PI / 2);
  });
});

describe('与磁盘资产交叉核对', () => {
  it('assets/models 目录存在', () => {
    expect(existsSync(MODEL_DIR), `缺少目录 ${MODEL_DIR}`).toBe(true);
  });

  it('每条带 file 的登记项都有对应的 .glb', () => {
    const missing = [];
    for (const [name, c] of entries) {
      if (!c.file) continue;
      const p = path.join(MODEL_DIR, `${c.file}.glb`);
      if (!existsSync(p) || !statSync(p).isFile()) missing.push(`${name} → ${p}`);
    }
    expect(missing, `缺少模型文件：\n${missing.join('\n')}`).toEqual([]);
  });

  it('没有 file 的登记项按登记名回落到同名 .glb（models.js 的 conf.file || name）', () => {
    const missing = [];
    for (const [name, c] of entries) {
      if (c.file) continue;
      const p = path.join(MODEL_DIR, `${name}.glb`);
      if (!existsSync(p) || !statSync(p).isFile()) missing.push(`${name} → ${p}`);
    }
    expect(missing, `缺少回落模型文件：\n${missing.join('\n')}`).toEqual([]);
  });
});
