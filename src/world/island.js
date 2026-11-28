// 地球村：一座约 600 米见方的岛。地形、路网、街区、地标、可撞飞的道具、碰撞
// 本文件只剩 Island 门面：构造函数建好容器与随机源，其余每个方法都一行转交给
// 对应模块的自由函数（第一个参数是 island 实例），保证 this 语义与拆分前完全一致。
import * as THREE from 'three';
import { rng } from '../core/util.js';
import { Colliders } from './colliders.js';
import { buildTerrain, ramp, rampHeight, heightAt } from './terrain.js';
import { buildRoads, inRoad } from './roads.js';
import {
  facadeMat, building, neonMat, sign, row, buildDistricts, pearlTower, vendingWall,
  plaza, plazaBuildings, winMat, holoMini, drawScreen, holoBlock,
} from './buildings.js';
import {
  plazaDecor, makeGlobe, park, trees, palms, buildStreetLife,
  addProp, hitProps, blast, updateProps, updateScenery,
} from './props.js';
import { buildBeach } from './beach.js';
import { Shanghai } from './districts/shanghai.js';
import { Tokyo } from './districts/tokyo.js';
import { BigApple } from './districts/bigapple.js';
import { Beach } from './districts/beach.js';
import { Paris } from './districts/paris.js';
import { Pyramid } from './districts/pyramid.js';
import { Iceland } from './districts/iceland.js';
import { Hometown } from './districts/hometown.js';
import { buildStreetRefinements } from './districts/refinements.js';

export { XR, ZR, ROAD_W, BEACH_Z, shoreEdge, groundH } from './terrain.js';

/**
 * 整座岛。构造时按固定顺序搭出地形、路网、街区、街景、海滩与街区组件，
 * 之后每帧由 update() 推进道具物理与场景动画。
 */
export class Island {
  /**
   * @param {THREE.Scene} scene 主场景
   * @param {{ windows: THREE.Material[], neon: Array<{ mat: THREE.Material, base: THREE.Color }>, night: number }} env 环境状态（夜景亮度、可点亮材质表）
   */
  constructor(scene, env) {
    this.scene = scene; this.env = env;
    this.root = new THREE.Group(); scene.add(this.root);
    this.col = new Colliders();
    this.props = [];
    this.ramps = [];
    this.peds = [];
    this.r = rng(2079);
    this.buildTerrain();
    this.buildRoads();
    this.buildDistricts();
    this.buildStreetLife();
    this.buildBeach();
    this.buildDistrictKits();
  }

  /**
   * 第 2 批起每个街区是一个独立组件：自己搭场景、自己管笑点和当地任务
   * @returns {void}
   */
  buildDistrictKits() {
    this.districts = [new Shanghai(this), new Tokyo(this), new BigApple(this), new Beach(this), new Paris(this), new Pyramid(this), new Iceland(this), new Hometown(this)];
    buildStreetRefinements(this);
  }

  /**
   * 往岛的根节点挂一个对象。
   * @param {THREE.Object3D} o 要挂的对象
   * @returns {THREE.Object3D} 同一个对象，方便链式使用
   */
  add(o) { this.root.add(o); return o; }

  // ---------- 地形 ----------
  /** @returns {void} */
  buildTerrain() { return buildTerrain(this); }

  // ---------- 路网 ----------
  /** @returns {void} */
  buildRoads() { return buildRoads(this); }

  /**
   * @param {number} x x 坐标
   * @param {number} z z 坐标
   * @param {number} [pad=0] 额外外扩的宽度
   * @returns {boolean} 在路上返回 true
   */
  inRoad(x, z, pad = 0) { return inRoad(this, x, z, pad); }

  // ---------- 楼 ----------
  /**
   * @param {'glass'|'concrete'|'shikumen'|'tokyo'|'pastel'} style 立面风格
   * @param {number} v 变体序号
   * @returns {THREE.MeshStandardMaterial} 立面材质
   */
  facadeMat(style, v) { return facadeMat(this, style, v); }

  /**
   * @param {number} x 中心 x
   * @param {number} z 中心 z
   * @param {number} w 宽
   * @param {number} d 深
   * @param {number} h 高
   * @param {'glass'|'concrete'|'shikumen'|'tokyo'|'pastel'} style 立面风格
   * @param {{ face?: [number, number]|null }} [opts] face：石库门门头朝向
   * @returns {THREE.Mesh} 楼体网格
   */
  building(x, z, w, d, h, style, { face = null } = {}) { return building(this, x, z, w, d, h, style, { face }); }

  /**
   * @param {THREE.Color} color 基色
   * @returns {THREE.MeshBasicMaterial} 霓虹材质
   */
  neonMat(color) { return neonMat(this, color); }

  /**
   * @param {THREE.Texture} tex 招牌贴图
   * @param {number} w 宽
   * @param {number} h 高
   * @param {number} x 位置 x
   * @param {number} y 位置 y
   * @param {number} z 位置 z
   * @param {number} ry 绕 Y 旋转
   * @param {number} [glow=1] 自发光强度
   * @returns {THREE.Mesh} 招牌网格
   */
  sign(tex, w, h, x, y, z, ry, glow = 1) { return sign(this, tex, w, h, x, y, z, ry, glow); }

  /**
   * @param {number} x0 起点 x
   * @param {number} x1 终点 x
   * @param {number} zFront 临街面 z
   * @param {number} depth 进深
   * @param {number} dir 楼体往哪一侧长
   * @param {'glass'|'concrete'|'shikumen'|'tokyo'|'pastel'} style 立面风格
   * @param {[number, number]} hRange 高度区间
   * @param {[number, number]} wRange 面宽区间
   * @param {{ skip?: (x: number) => boolean }} [opts] skip：返回 true 的位置留空
   * @returns {Array<{ b: THREE.Mesh, x: number, w: number, h: number, z: number, zFront: number }>} 排出来的楼
   */
  row(x0, x1, zFront, depth, dir, style, hRange, wRange, opts = {}) { return row(this, x0, x1, zFront, depth, dir, style, hRange, wRange, opts); }

  /** @returns {void} */
  buildDistricts() { return buildDistricts(this); }

  /**
   * @param {number} x 塔基 x
   * @param {number} z 塔基 z
   * @returns {void}
   */
  pearlTower(x, z) { return pearlTower(this, x, z); }

  /**
   * @param {number} x0 起点 x
   * @param {number} x1 终点 x
   * @param {number} z 墙面 z
   * @returns {void}
   */
  vendingWall(x0, x1, z) { return vendingWall(this, x0, x1, z); }

  /** @returns {void} */
  plaza() { return plaza(this); }

  /** @returns {void} */
  plazaBuildings() { return plazaBuildings(this); }

  /**
   * @param {'glass'|'concrete'|'shikumen'|'tokyo'|'pastel'} style 立面风格
   * @param {number} rx 横向窗格重复数
   * @param {number} ry 纵向窗格重复数
   * @param {number} [tint] 颜色覆盖
   * @returns {THREE.MeshStandardMaterial} 克隆出来的材质
   */
  winMat(style, rx, ry, tint) { return winMat(this, style, rx, ry, tint); }

  /**
   * @param {number} cx 中心 x
   * @param {number} cz 中心 z
   * @param {number} s 边长
   * @returns {void}
   */
  holoMini(cx, cz, s) { return holoMini(this, cx, cz, s); }

  /**
   * @param {number} t 累计时间（秒）
   * @returns {void}
   */
  drawScreen(t) { return drawScreen(this, t); }

  /**
   * @param {number} cx 中心 x
   * @param {number} cz 中心 z
   * @returns {void}
   */
  holoBlock(cx, cz) { return holoBlock(this, cx, cz); }

  // ---------- 广场装饰 / 公园 / 树 ----------
  /** @returns {void} */
  plazaDecor() { return plazaDecor(this); }

  /**
   * @param {THREE.Material} goldM 金环材质
   * @returns {THREE.Group} 地球仪组
   */
  makeGlobe(goldM) { return makeGlobe(this, goldM); }

  /**
   * @param {number} cx 中心 x
   * @param {number} cz 中心 z
   * @returns {void}
   */
  park(cx, cz) { return park(this, cx, cz); }

  /**
   * @param {Array<[number, number]>} pts 每棵树的位置
   * @returns {void}
   */
  trees(pts) { return trees(this, pts); }

  /**
   * @param {Array<[number, number]>} pts 每棵棕榈的位置
   * @returns {void}
   */
  palms(pts) { return palms(this, pts); }

  // ---------- 跳台 ----------
  /**
   * @param {number} x 中心 x
   * @param {number} z 中心 z
   * @param {number} ry 上坡方向
   * @param {number} [L=10] 坡长
   * @param {number} [W=6] 坡宽
   * @param {number} [H=2.2] 坡高
   * @returns {void}
   */
  ramp(x, z, ry, L = 10, W = 6, H = 2.2) { return ramp(this, x, z, ry, L, W, H); }

  /**
   * @param {number} x x 坐标
   * @param {number} z z 坐标
   * @returns {number} 跳台表面高度
   */
  rampHeight(x, z) { return rampHeight(this, x, z); }

  /**
   * @param {number} x x 坐标
   * @param {number} z z 坐标
   * @returns {number} 可站立高度
   */
  heightAt(x, z) { return heightAt(this, x, z); }

  // ---------- 街景：路灯、行道树、摊位、路障、纸板路人 ----------
  /** @returns {void} */
  buildStreetLife() { return buildStreetLife(this); }

  /**
   * @param {THREE.Object3D} obj 道具对象
   * @param {number} x 位置 x
   * @param {number} z 位置 z
   * @param {number} ry 绕 Y 旋转
   * @param {number} radius 碰撞半径
   * @param {number} mass 质量
   * @returns {{ obj: THREE.Object3D, radius: number, mass: number, vel: THREE.Vector3, spin: THREE.Vector3, flying: boolean, home: THREE.Vector3 }} 道具记录
   */
  addProp(obj, x, z, ry, radius, mass) { return addProp(this, obj, x, z, ry, radius, mass); }

  /**
   * 撞飞：返回本次新撞飞的个数
   * @param {THREE.Vector3} pos 撞击点
   * @param {number} radius 撞击半径
   * @param {THREE.Vector3} vel 撞击速度
   * @param {number} [power=1] 力度倍率
   * @returns {number} 本次新撞飞的道具个数
   */
  hitProps(pos, radius, vel, power = 1) { return hitProps(this, pos, radius, vel, power); }

  /**
   * @param {THREE.Vector3} pos 爆心
   * @param {number} radius 影响半径
   * @param {number} power 冲击力度
   * @returns {number} 被掀飞的道具个数
   */
  blast(pos, radius, power) { return blast(this, pos, radius, power); }

  /**
   * @param {number} dt 帧间隔（秒）
   * @returns {void}
   */
  updateProps(dt) { return updateProps(this, dt); }

  // ---------- 海滩：棕榈、遮阳伞、码头、救生塔 ----------
  /** @returns {void} */
  buildBeach() { return buildBeach(this); }

  /**
   * @param {number} dt 帧间隔（秒）
   * @param {number} t 累计时间（秒）
   * @returns {void}
   */
  update(dt, t) {
    this.updateProps(dt);
    this.updateScenery(dt, t);
  }

  /**
   * @param {number} dt 帧间隔（秒）
   * @param {number} t 累计时间（秒）
   * @returns {void}
   */
  updateScenery(dt, t) { return updateScenery(this, dt, t); }
}
