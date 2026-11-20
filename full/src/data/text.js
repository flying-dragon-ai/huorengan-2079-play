// 台词、弹幕、梗角色。换梗只改这里。

/**
 * 台词表：场景/角色 → 台词。单条是 [说话人, 内容]，多条是数组。
 * @type {Record<string, [string, string] | [string, string][] | string | Record<string, string[]>>}
 */
export const LINES = {
  hall: [
    ['大肥鱼 AI 客服', '早上好，2079 年的人类。今天 AI 也把活干完了。'],
    ['大肥鱼 AI 客服', '检测到您的活人感只剩 3%。建议立即投胎。'],
    ['大肥鱼 AI 客服', '请抽取您的人生卡。温馨提示：电饭煲不支持退款。'],
  ],
  dive: [
    ['大肥鱼 AI 客服', '正在投胎至：地球村。全世界都挤在这一个岛上。'],
    ['大肥鱼 AI 客服', '降落伞属于付费功能。祝您落地愉快。'],
  ],
  splat: [
    ['大肥鱼 AI 客服', '警告：活人感过低。画质已降为 360P 省算力模式。'],
    ['大肥鱼 AI 客服', '骑上电驴，找回活人感。'],
  ],
  upgrade: ['大肥鱼 AI 客服', '活人感 +20%！画质已恢复。不用谢，下单吧。'],
  orderIn: ['妈妈', '外卖单来了：一杯八十的咖啡，送到海边给你七大姑。'],
  pickup: ['咖啡店', '一杯八十。备注：多加冰，少加班。'],
  kangaroo: [
    ['袋鼠', '这单是我的！我口袋大！'],
    ['袋鼠', '让一让，袋鼠也要冲业绩！'],
    ['袋鼠', '你骑电驴，我骑自己！'],
  ],
  niulai: ['牛来', '牛来了！让开让开！'],
  deliver: ['七大姑', '哎哟，咖啡来了。你一个月挣多少？有对象了吗？'],
  night: ['妈妈', '几点了还不回家？锅里给你留了电饭煲。'],
  laughReady: ['大肥鱼 AI 客服', '笑点已充满。按 Q 捧腹大笑。'],
  finale: ['大肥鱼 AI 客服', '活人感 100%。恭喜，您是今天最像人的那个。'],
  chasers: {
    // 妈妈、班主任、亲戚的台词，一部分搬自旧版《活人感 2079》
    mom: ['穿秋裤了吗！', '骑慢点！', '回来吃饭！', '我是为你好！', '你看看人家！', '等你上了大学就轻松了！', '玩玩玩，就知道玩！'],
    teacher: ['这道题我讲过没有！', '你是我带过最差的一届！', '后排那个奶蛙！', '我们不说摸鱼，我们说战略性休息', '我们不说考砸了，我们说暴露了问题'],
    aunt: ['工资多少？', '什么时候结婚？', '隔壁孩子考上了！', '对象呢？', '房子买了没？', '编制考上没？', '胖了啊？'],
  },
  kangarooCatch: ['袋鼠', '你的胆子真是肥嘟嘟的！'],
  niulaiCry: '妈——妈——',
};

/**
 * 直播间弹幕池。
 * @type {string[]}
 */
export const DANMAKU = [
  '前方高能', '这画质是 2026 年做的？', '奶蛙冲！', '电饭煲很合身', '笑死，摔成饼了',
  '活人感拉满', '七大姑永不缺席', '一杯八十？？', '袋鼠是来抢单的', '这游戏能玩吗 我要玩',
  '黄昏好美', '牛来了牛来了', '班主任追上来了快跑', '2079 的我也在看', '这就是人生吗',
  '已截图做壁纸', '送礼物：一碗拌粉', '送礼物：电饭煲 x1', '铁岭 50 米 哈哈哈', '路牌是认真的吗',
  '我妈也这么说', '画面越正经内容越离谱', '这是 GTA 7 吧', '活着真好', '求出手游',
  // 旧版的直播间弹幕
  '活人感好强 我哭了', '蒸蚌！', '绷不住了', '如何呢，又能怎', '爱你老己', '从从容容，游刃有余', '匆匆忙忙，连滚带爬',
  '主播别摸鱼', '这奶蛙有点东西', '已截图发给我 AI 爸妈', '前排出售瓜子', '666', '咕咕嘎嘎', '我的刀盾！',
  '背手负鼠视察中', '你的胆子真是肥嘟嘟的', '被奶蛙硬控了', '松弛感拉满', '那咋了', '包的', '草台班子罢了',
  '情绪价值给到位了', '偷感很重', '来财来财', '这把是人机吧', 'oiia oiia', '香蕉猫别哭',
];

/**
 * 纸板立牌路人配置。
 * @typedef {object} Meme
 * @property {string} name 名字
 * @property {string} line 冒的话
 * @property {string} color 纸板颜色
 * @property {string} face 画的表情
 */

/**
 * 纸板立牌路人：没有 3D 模型的梗，用纸板表现
 * @type {Meme[]}
 */
export const MEMES = [
  { name: '早八人', line: '我还没醒', color: '#ffcf5a', face: 'sleep' },
  { name: '打工人', line: '打工使我快乐', color: '#7ad0ff', face: 'grin' },
  { name: '摸鱼仙人', line: '我在工作', color: '#9bffb0', face: 'side' },
  { name: '显眼包', line: '看我看我', color: '#ff7ad9', face: 'star' },
  { name: '干饭人', line: '开饭了吗', color: '#ff8a5a', face: 'eat' },
  { name: '社恐', line: '别看我', color: '#c9b8ff', face: 'shy' },
];

/**
 * 3D 热梗路人配置。
 * @typedef {object} Meme3D
 * @property {string} name 名字
 * @property {string} say 靠近时冒的话
 * @property {string} hit 被撞飞时喊的
 * @property {'waddle'|'hop'|'sway'|'still'} move 走路方式
 * @property {string} emote 靠近时的动作
 * @property {[string, string]} [sfx] [靠近, 被撞] 的音效名
 * @property {boolean} [dead] 被撞后装死
 */

/**
 * 3D 热梗路人：模型是用户提供的 Tripo / Hi3D 模型（减过面），叫声来自旧作的梗音效
 *   model 对应 MODEL_CONF；move：waddle 摇摆走、hop 蹦、sway 晃、still 不动；emote：靠近时的动作
 *   say：靠近时冒的话；hit：被撞飞时喊的；sfx：[靠近, 被撞] 的音效名（见 audio.js 的 SAMPLES）
 * @type {Record<string, Meme3D>}
 */
export const MEME3D = {
  catbanana: { name: '香蕉猫', say: '呜哇——我想回家', hit: '呜哇哇哇——', move: 'sway', emote: 'cry', sfx: ['banana1', 'banana2'] },
  catoiia: { name: 'OIIA 猫', say: 'oiia oiia！', hit: 'oiiaaaa——', move: 'still', emote: 'spin', sfx: ['oiia1', 'oiia2'] },
  daodun: { name: '刀盾狗', say: '我的刀盾！', hit: '我的刀盾——', move: 'waddle', emote: 'chop', sfx: ['daodun1', 'daodun2'] },
  gugugaga: { name: '咕咕嘎嘎企鹅', say: '咕咕嘎嘎！', hit: '嘎——', move: 'waddle', emote: 'elbow', sfx: ['gugu1', 'gugu2'] },
  penguin: { name: '侦探企鹅', say: '真相只有一个：你超时了', hit: '我的烟斗！', move: 'waddle', emote: 'hop' },
  agentpenguin: { name: '特工企鹅', say: '晚上要下雨，记得带伞', hit: '伞！我的伞！', move: 'waddle', emote: 'hop' },
  duck: { name: '运球小黄鸭', say: '运球不看路，是我的风格', hit: '球！我的球！', move: 'hop', emote: 'hop' },
  opossum: { name: '背手负鼠', say: '我就看看，不说话', hit: '（开始装死）', move: 'still', emote: 'hop', dead: true },
  xiaoxing: { name: '小星', say: '小星来啦～', hit: '呀——', move: 'hop', emote: 'hop' },
  buding: { name: '布丁', say: '布丁不想动', hit: '喵！！', move: 'still', emote: 'hop' },
  whalemaid: { name: '鲸鱼女仆', say: '欢迎光临，咖啡一杯八十～', hit: '主人你干嘛——', move: 'sway', emote: 'hop' },
  rabbit: { name: '剧组群演·兔', say: '罗密欧去哪了？', hit: '我只是个群演！', move: 'waddle', emote: 'hop' },
  minotaur: { name: '剧组群演·牛', say: '生存还是毁灭，这是个问题', hit: '毁灭吧——', move: 'still', emote: 'hop' },
  fantasy: { name: '剧组群演·鸭', say: '我是来串场的', hit: '串错场了——', move: 'waddle', emote: 'hop' },
  // 平行世界的奶蛙（变装）
  wukong: { name: '奶蛙·齐天大圣', say: '俺老孙来也！', hit: '妖怪，哪里跑——', move: 'still', emote: 'anim' },
  frogknight: { name: '奶蛙骑士', say: '风车在哪？我要冲锋！', hit: '我的长枪——', move: 'waddle', emote: 'hop' },
  frogschool: { name: '上学的奶蛙', say: '早读默写我还没背！', hit: '作业掉了——', move: 'hop', emote: 'hop' },
};

/**
 * 3D 路人站哪：都在外卖路线两边，演示视频一路都能看到 [模型, x, z]
 * @type {Array<[string, number, number]>}
 */
export const MEME_SPOTS = [
  ['whalemaid', -112, -91.5], ['catbanana', -128, -108.5], ['xiaoxing', -84, -91.5], ['buding', -66, -108.5],
  ['catoiia', 70, -91.5], ['daodun', 95, -108.5], ['agentpenguin', 120, -91.5], ['gugugaga', 134, -108.5],
  ['opossum', 158.5, -20], ['duck', 141.5, 60], ['catbanana', 158.5, 150],
  ['penguin', 70, 226], ['catoiia', 40, 232], ['daodun', -30, 228],
  ['rabbit', -22, 18], ['minotaur', -28, 8], ['fantasy', -18, 26], ['gugugaga', 20, 30],
  ['wukong', 10, 36], ['frogknight', 141.5, 100], ['frogschool', -140, -91.5],
  // 站在马路中间的：骑车撞上去会叠到电驴上（叠罗汉），转弯太急全甩飞
  ['catbanana', -150, 20], ['gugugaga', -150, -25], ['daodun', -150, -65],
  ['penguin', 30, -100], ['xiaoxing', 75, -100], ['duck', 120, -100],
];

/**
 * 合唱团：东京街南边排一排，奶蛙路过就开唱，越唱越快
 * @type {Array<[string, number, number]>}
 */
export const CHOIR = [['daodun', 58, -108.5], ['gugugaga', 63, -108.5], ['daodun', 68, -108.5], ['gugugaga', 73, -108.5], ['catoiia', 78, -108.5]];
/**
 * 站在马路中间的路人坐标集合（'x,z' 字符串）。
 * @type {Set<string>}
 */
export const ROAD_MEME = new Set(['-150,20', '-150,-25', '-150,-65', '30,-100', '75,-100', '120,-100']);

/**
 * 投胎十连抽：前九张都是富二代
 * @type {string[]}
 */
export const GACHA_N = ['家里有矿', '矿里有家', '出生即退休', '又是你', '零花钱以亿计', '没体验过作业', '大学是自家开的', '第 9 次了', '对不起'];

/**
 * 加载时和 H 操作说明里轮播的小贴士（前几条搬自旧版）
 * @type {string[]}
 */
export const TIPS = [
  '小贴士：「我是为你好」是一种无法闪避的范围技能。',
  '小贴士：别人家的孩子无法被击败，只能被无视（把它甩出画面）。',
  '小贴士：「等你上了大学就轻松了」是本游戏最大的谎言。',
  '小贴士：牛马，一种 21 世纪人类的自称，现已申报非物质文化遗产。',
  '小贴士：找不到路？跟着屏幕上的 ◆ 和小地图上的黄线走。',
  '小贴士：卡住了按 R，奶蛙和小电驴会一起回到路上。',
  '小贴士：下车碰一下热梗路人，就能招他当队友。',
  '小贴士：骑着电驴撞路人，会被妈妈和班主任追。',
];

/**
 * 抽到的人生卡。
 * @type {{ place: string, role: string, talent: string }}
 */
export const CARD = {
  place: '魔都弄堂',
  role: '打工人',
  talent: '骑电驴不戴头盔（已被系统改成电饭煲）',
};
