// 全局可调参数：路网与海岸线的基准值。零依赖。
// 数值原样取自 world/island.js 的导出，改这里等于改全岛布局。

/**
 * 南北向马路的 x 坐标。
 * @type {number[]}
 */
export const XR = [-150, -50, 50, 150];

/**
 * 东西向马路的 z 坐标。
 * @type {number[]}
 */
export const ZR = [-150, -100, -50, 50, 150];

/**
 * 马路宽度（米）。
 * @type {number}
 */
export const ROAD_W = 14;

/**
 * 海滩起始的 z 坐标。
 * @type {number}
 */
export const BEACH_Z = 210;

/**
 * 上面四个值的分组视图，方便整体传递。浅冻结：对象本身不可改，
 * 但 XR / ZR 仍是原数组引用，与单独 import 拿到的是同一个。
 * @type {Readonly<{ XR: number[], ZR: number[], ROAD_W: number, BEACH_Z: number }>}
 */
export const WORLD = Object.freeze({ XR, ZR, ROAD_W, BEACH_Z });
