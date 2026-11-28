// 「重启的代价」核心配置：5 大活人模块、3 条跨街区锚点、班主任快问快答、AI 系统日志与三重结局。
// 纯数据模块，零依赖，供逻辑层与单元测试共用。

export const LOOP_DURATION = 150;
export const LAUGH_BONUS_TIME = 35;

/**
 * 5 枚可抵押的「活人模块」：每次重启必须交出其中 1 枚，用人性换效率。
 * @type {Array<{
 *   id: 'color'|'bond'|'pain'|'laugh'|'memory',
 *   icon: string,
 *   name: string,
 *   short: string,
 *   sweetener: string,
 *   cost: string,
 *   aiPitch: string,
 *   reclaimLine: string,
 *   capsuleColor: number
 * }>}
 */
export const HUMANITY_MODULES = [
  {
    id: 'color',
    icon: '🎨',
    name: '色彩与天气',
    short: '色彩',
    sweetener: 'AI 透视模式：全岛锚点、袋鼠与捷径穿墙高亮',
    cost: '世界褪成灰蓝算力视图，东京停雨、极光熄灭、海滩失去黄昏',
    aiPitch: '色彩属于高耗能视觉冗余，回收后立即为您开启全岛目标透视。',
    reclaimLine: '色彩与晚霞轰然回归！',
    capsuleColor: 0xff6fb0,
  },
  {
    id: 'bond',
    icon: '🤝',
    name: '人情与羁绊',
    short: '人情',
    sweetener: '全岛零阻力：亲戚不再追你，被催星永久归零',
    cost: '街上热梗角色全部替换为面无表情的蓝衣 AI 客服，弹幕沦为冰冷日志',
    aiPitch: '亲戚唠叨与热梗路人严重拖慢效率，已准备将其替换为礼貌客服。',
    reclaimLine: '热梗路人与吵闹的七大姑全都回来了！',
    capsuleColor: 0xffc83a,
  },
  {
    id: 'pain',
    icon: '💥',
    name: '痛觉与荒诞',
    short: '痛觉',
    sweetener: '极速稳驾：电驴提速 +35%，撞墙不减速不摔饼',
    cost: '不再摔成饼，街边摊位焊死成铁块撞不飞，荒诞物理喜剧死去',
    aiPitch: '关闭痛觉与搞笑物理，可大幅降低碰撞损耗并提升 35% 极速。',
    reclaimLine: '荒诞物理回归！摊位又能满天飞了！',
    capsuleColor: 0xff6b3d,
  },
  {
    id: 'laugh',
    icon: '😂',
    name: '笑声与情绪',
    short: '笑声',
    sweetener: '绝对冷静：每轮倒计时 +35 秒，免疫假过场与干扰弹窗',
    cost: 'Q 捧腹大笑永久碎裂锁死，配乐退化为冰冷的服务器滴答声',
    aiPitch: '大笑会造成算力尖峰，交出情绪模块即可换取额外 35 秒运行配额。',
    reclaimLine: '笑声回来了！按 Q 捧腹大笑已解锁！',
    capsuleColor: 0x5dff9a,
  },
  {
    id: 'memory',
    icon: '🗺️',
    name: '街区记忆',
    short: '记忆',
    sweetener: '定点空降：每轮可直接空降到任意锚点街区门口，省掉跑路',
    cost: '永久回收巴黎街区（盖满「已释放算力」围挡），从你的世界抹除',
    aiPitch: '非核心观光街区占用了 22% 显存，回收后立即赠送定点投放特权。',
    reclaimLine: '被删除的街区记忆重新浮现！',
    capsuleColor: 0x72edff,
  },
];

export const MODULE_MAP = Object.fromEntries(HUMANITY_MODULES.map((m) => [m.id, m]));

/**
 * 3 条跨街区活人锚点定义。
 */
export const ANCHOR_DEFS = [
  {
    id: 'absurd',
    index: 1,
    name: '荒诞锚 · 真实的一天',
    short: '荒诞锚',
    color: '#ff8ad8',
    cafeSpot: [-61, -98],
    vendorSpot: [100, -92.5],
    hintLoop1: '先去魔都「加油咖啡」查 ¥800 小票维护码 → 再到东京「人生贩卖机」输码取锚点',
    hintKnown: '已记住维护码！直接冲向东京「人生贩卖机」按 E 输码取锚点',
  },
  {
    id: 'memory',
    index: 2,
    name: '记忆锚 · 未忘的乡愁',
    short: '记忆锚',
    color: '#ff796e',
    subwaySpot: [78, 124],
    teacherSpot: [-100, 62],
    hintLoop1: '去老家县一中找班主任完成早读 3 题问答（大苹果「铁岭地铁」可秒传直达！）',
    hintKnown: '早读答案与铁岭地铁都已记住！直冲老家县一中秒答通关',
  },
  {
    id: 'pain',
    index: 3,
    name: '痛觉锚 · 拒绝麻木',
    short: '痛觉锚',
    color: '#ffc85a',
    beachStart: [86, 224],
    lockerSpot: [-140, -27],
    hintLoop1: '袋鼠正把锚点从海滩偷运去金字塔快递柜！半路高速撞翻它，或去金字塔撬柜夺回',
    hintKnown: '已摸清袋鼠偷运路线！开局提前沿东线埋伏撞翻它，或直奔金字塔快递柜',
  },
];

/**
 * 袋鼠偷运「痛觉锚」的路径：热带海滩 → 大苹果东侧 → 巴黎东侧 → 中央广场北 → 金字塔千年快递柜。
 */
export const KANGAROO_HEIST_PATH = [
  [86, 224],
  [150, 210],
  [150, 100],
  [150, -50],
  [50, -50],
  [-50, -50],
  [-150, -50],
  [-140, -27],
];

/**
 * 老家县一中班主任的 3 道地球村快问快答（真正需要玩家按键 1/2/3 或点击作答）。
 */
export const HOMETOWN_QUIZ = [
  {
    q: '在老家菜市场点拌粉说「不要辣」，老板理解的「微辣」等于多少？',
    options: ['真的不放辣椒', '只放一瓢，不放两瓢', '扫码开通会员免辣'],
    answer: 1,
    clue: '老家菜市场牌子写着：不要辣 = 微辣 = 一瓢',
  },
  {
    q: '冰岛温泉的企鹅考勤机规定：员工迟到一次要扣多少条鱼？',
    options: ['80 条（与咖啡同价）', '200 条鱼', '调休两天抵扣'],
    answer: 1,
    clue: '冰岛企鹅考勤机霓虹牌：迟到扣 200 条鱼',
  },
  {
    q: '巴黎「家里颂」面包店的法棍按硬度分级，决斗专用是哪一级？',
    options: ['早餐松软级', '下午茶伴侣级', '合法防身·冠军级'],
    answer: 2,
    clue: '巴黎面包房招牌：法棍 / 可颂 / 合法防身用品',
  },
];

/**
 * 抵押「街区记忆」后可选的定点空降位置。
 */
export const DROP_HUBS = [
  { id: 'plaza', name: '中央广场南门', pos: [4, 48], yaw: Math.PI },
  { id: 'tokyo', name: '东京人生贩卖机旁', pos: [84, -100], yaw: Math.PI / 2 },
  { id: 'hometown', name: '老家县一中门口', pos: [-100, 50], yaw: 0 },
  { id: 'pyramid', name: '金字塔快递柜旁', pos: [-126, -34], yaw: -Math.PI / 2 },
];

/**
 * 抵押「人情与羁绊」或「笑声与情绪」后，取代人类发疯弹幕的冰冷系统日志。
 */
export const AI_LOGS = [
  '[INFO] 用户心率平稳：62 bpm（符合托管标准）',
  '[OK] 情绪波动已压制至 0.03%',
  '[SYS] 本轮路径规划效率提升 14.2%',
  '[INFO] 冗余社交模块已卸载，释放算力 18%',
  '[OK] 未检测到无意义幽默行为',
  '[SYS] 上一世残影已接管原定生活轨迹',
  '[INFO] 欢迎您逐渐成为更优解的自己',
  '[OK] 2079 人生舱稳定运行中 · 零误差',
  '[SYS] 检测到怀旧脉冲，已自动平滑滤除',
  '[INFO] 客服转正评估进度更新',
];

/**
 * 蓝衣 AI 标准客服替身的冰冷台词（替代热梗角色与亲戚）。
 */
export const AI_CUSTODIAN_LINES = [
  '您好，祝您今日效率最大化。',
  '您的外卖路径已优化，请勿偏离。',
  '情绪波动过低，表现非常优秀。',
  '已为您自动跳过寒暄与情感消耗。',
  '如需再次重启，请随时签署抵押协议。',
  '我是标准客服 047 号，很高兴为您服务。',
];

/**
 * 三重结局文案定义。
 */
export const ENDINGS = {
  true_human: {
    id: 'true_human',
    badge: '真结局 · ENDING A',
    title: '粗糙的活人',
    subtitle: '你磕磕绊绊、摔成过饼，但你一寸自己都没卖。',
    theme: 'gold',
    bigfishLine: '[ERROR] 效率极低、逻辑混乱……但生命体征 100% 真实。您赢了。',
    verdict: 'AI 没能把你蒸馏成标准模版。你掀飞电饭煲，带着满身槽点和热乎气走出了人生舱。',
  },
  empty_shell: {
    id: 'empty_shell',
    badge: '讽刺结局 · ENDING B',
    title: '完美的空壳',
    subtitle: '你用极致的效率赢了这场游戏，却把「自己」留在了重启协议里。',
    theme: 'cold',
    bigfishLine: '恭喜！零失误、极速通关、情绪波动 0.0%！您已正式通过 2079 AI 客服转正考核。',
    verdict: '舱盖缓缓合上。你不再需要逃离人生舱——因为现在的你，和 AI 已经没有区别。',
  },
  vault_rebel: {
    id: 'vault_rebel',
    badge: '隐藏真结局 · ENDING C',
    title: '违约者：抢回代价',
    subtitle: '你识破了重启的圈套，顶着自己的 AI 替身把卖掉的人性亲手砸了回来！',
    theme: 'rebel',
    bigfishLine: '[CRITICAL] 用户暴力破坏算力回收站！已回收的色彩、笑声与七大姑正在倒灌系统——',
    verdict: '原来「重启」真正的出口，不是变成零失误的机器，而是哪怕残缺混乱也要把「自己」全部夺回来。',
  },
};

/**
 * 中央广场核心交互点坐标。
 */
export const PLAZA_BREAKER = [0, 22];
export const PLAZA_VAULT = [0, -24];
