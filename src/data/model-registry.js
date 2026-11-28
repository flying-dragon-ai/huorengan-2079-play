// 模型登记表：名字 → 目标高度 / 朝向修正 / 文件名。纯数据，零依赖。
// 原样搬自 actors/models.js，注释一并保留。

// h: 目标高度（米）；yaw: 让模型正面朝 +Z 的修正角
export const FACE_X = -Math.PI / 2; // Tripo 导出的角色正面朝 +X

/**
 * 单个模型的配置。
 * @typedef {object} ModelConf
 * @property {number} h 目标高度（米）
 * @property {number} yaw 朝向修正角（弧度），让模型正面朝 +Z
 * @property {string} [file] assets/models/ 下的文件名（不含 .glb），缺省用登记名
 * @property {boolean} [tripo] 是否来自 Tripo 导出（需要 tameMaterials 处理材质）
 * @property {number} [long] 长条模型的长度（米），如电驴
 */

/**
 * 全部模型的登记表。
 * @type {Record<string, ModelConf>}
 */
export const MODEL_CONF = {
  naiwa: { h: 1.5, yaw: 0, file: 'naiwa_animated', tripo: true },
  kangaroo: { h: 1.9, yaw: 0 },
  niulai: { h: 1.6, yaw: 0 },
  ebike: { h: 1.25, yaw: Math.PI / 2, long: 1.9 },
  // 大奶蛙：捧腹大笑变身用，带骨骼（Pelvis、Chest、Head、UpperArm.L/R…）
  bigfrog: { h: 1.5, yaw: FACE_X, file: 'bigfrog', tripo: true },
  // 热梗路人（用户提供的 Tripo / Hi3D 模型，已减面）
  catbanana: { h: 1.4, yaw: FACE_X, file: 'memes/catbanana', tripo: true },
  catoiia: { h: 1.4, yaw: FACE_X, file: 'memes/catoiia', tripo: true },
  daodun: { h: 1.5, yaw: FACE_X, file: 'memes/daodun', tripo: true },
  gugugaga: { h: 1.5, yaw: FACE_X, file: 'memes/gugugaga', tripo: true },
  penguin: { h: 1.6, yaw: FACE_X, file: 'memes/penguin', tripo: true },
  duck: { h: 1.5, yaw: FACE_X, file: 'memes/duck', tripo: true },
  opossum: { h: 1.5, yaw: FACE_X, file: 'memes/opossum', tripo: true },
  rabbit: { h: 1.6, yaw: 0, file: 'memes/rabbit', tripo: true },
  minotaur: { h: 1.75, yaw: 0, file: 'memes/minotaur', tripo: true },
  fantasy: { h: 1.6, yaw: 0, file: 'memes/fantasy', tripo: true },
  // 这四个是从下载文件夹里的原始模型减面来的（tools/assets/blender/decimate_glb.py）
  xiaoxing: { h: 1.3, yaw: FACE_X, file: 'memes/xiaoxing', tripo: true },
  buding: { h: 1.15, yaw: FACE_X, file: 'memes/buding', tripo: true },
  whalemaid: { h: 1.35, yaw: 0, file: 'memes/whalemaid', tripo: true },
  agentpenguin: { h: 1.8, yaw: 0, file: 'memes/agentpenguin', tripo: true },
  // 外接硬盘《奶蛙·课间梦游指南》里的奶蛙变装；齐天大圣带 idle / walk / attack 三段骨骼动画
  wukong: { h: 2.0, yaw: 0, file: 'memes/wukong', tripo: true },
  frogknight: { h: 1.75, yaw: 0, file: 'memes/frogknight', tripo: true },
  frogschool: { h: 1.5, yaw: 0, file: 'memes/frogschool', tripo: true },
};
