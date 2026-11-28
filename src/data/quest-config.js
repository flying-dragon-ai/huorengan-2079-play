// 任务与路线配置：任务清单、街区名、外卖路线、笑点阈值、追人种类。
// 原样搬自 game/game.js，数值与文案一字未改。
import * as THREE from 'three';

/**
 * 一条人生任务。
 * @typedef {object} Quest
 * @property {string} t 任务文案
 * @property {(g: any) => boolean} done 判断这一条做完没，g 是导演对象
 */

/**
 * 人生任务：右边的任务列表；done 判断这一条做完没
 * @type {Quest[]}
 */
export const QUESTS = [
  { t: '骑上小电驴', done: (g) => !!g.mounted },
  { t: '去咖啡店取餐', done: (g) => ['deliver', 'night', 'laughReady', 'laughing', 'finale', 'free'].includes(g.phase) },
  { t: '把咖啡送给七大姑', done: (g) => ['night', 'laughReady', 'laughing', 'finale', 'free'].includes(g.phase) },
  { t: '攒满笑点', done: (g) => ['laughReady', 'laughing', 'finale', 'free'].includes(g.phase) },
  { t: '按 Q 捧腹大笑', done: (g) => ['laughing', 'finale', 'free'].includes(g.phase) },
];

/**
 * 大地图上的街区名字：[名字, x, z, 颜色]
 * @type {Array<[string, number, number, string]>}
 */
export const AREAS = [
  ['中央广场', 0, 0, '#ffd84a'], ['魔都弄堂', -100, -125, '#ff8ad8'], ['市中心', 0, -100, '#7ef6ff'], ['东京便利店街', 100, -100, '#a46bff'],
  ['热带海滩', 0, 245, '#ffb347'], ['公园', 0, 100, '#5dff9a'], ['AI 生成中', -100, 100, '#3ff0ff'], ['AI 生成中', 100, 100, '#3ff0ff'],
  ['西方明珠塔', -100, -125 + 18, '#ff5fa8'],
];

/**
 * 平面坐标转世界坐标点。
 * @param {number} x
 * @param {number} z
 * @returns {THREE.Vector3} y 恒为 0
 */
const V = (x, z) => new THREE.Vector3(x, 0, z);

/**
 * 去咖啡店的路线。
 * @type {THREE.Vector3[]}
 */
export const ROUTE_CAFE = [V(-150, 50), V(-150, -100), V(-100, -100)];

/**
 * 送咖啡给七大姑的路线。
 * @type {THREE.Vector3[]}
 */
export const ROUTE_AUNT = [V(-60, -100), V(150, -100), V(150, 210), V(96, 210), V(91, 230)];

/**
 * 入夜后回家的路线。
 * @type {THREE.Vector3[]}
 */
export const ROUTE_NIGHT = [V(-150, 210), V(-150, -100), V(50, -100), V(150, -100), V(150, -50), V(50, -50), V(50, 50), V(-4, 50), V(-4, 30)];

/**
 * 笑点星星出现的时刻（秒）。
 * @type {number[]}
 */
export const STAR_AT = [3, 9, 18];

/**
 * 追人 NPC 的种类。
 * @type {string[]}
 */
export const KINDS = ['mom', 'teacher', 'aunt'];
