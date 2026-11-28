// 键盘鼠标输入。auto 模式下由机器人写入 virt

/**
 * 机器人/自动演示写入的虚拟输入。
 * @typedef {object} VirtualInput
 * @property {[number, number]} move 世界方向上的移动向量 [x, z]
 * @property {boolean} run 是否奔跑
 * @property {boolean} jump 是否跳跃
 * @property {boolean} interact 是否交互
 * @property {boolean} laugh 是否大笑
 * @property {boolean} hide 是否躲藏
 */

/**
 * 键盘鼠标输入。auto 模式下由机器人写入 virt。
 */
export class Input {
  /**
   * @param {HTMLCanvasElement} canvas 用来申请指针锁的画布
   */
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set();
    this.mdx = 0; this.mdy = 0;
    this.lastMouse = -99;
    this.virt = null; // { move:[x,z] 世界方向, run, jump, interact, laugh, hide }
    this.lockOk = false; // 进了地球村才锁鼠标；大厅和抽卡时鼠标要留着点卡
    addEventListener('keydown', (e) => {
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('click', () => {
      if (!this.lockOk || this.virt || !canvas.requestPointerLock) return;
      const r = canvas.requestPointerLock();
      if (r && r.catch) r.catch(() => {}); // 刚按过 Esc 时浏览器会拒绝，忽略即可
    });
    addEventListener('mousemove', (e) => {
      if (document.pointerLockElement) { this.mdx += e.movementX; this.mdy += e.movementY; this.lastMouse = performance.now() / 1000; }
    });
  }
  /**
   * 按键当前是否按住。
   * @param {string} c KeyboardEvent.code，如 'KeyW'
   * @returns {boolean}
   */
  down(c) { return this.keys.has(c); }

  /**
   * 按键本帧是否刚按下（endFrame 后清空）。
   * @param {string} c KeyboardEvent.code，如 'KeyQ'
   * @returns {boolean}
   */
  hit(c) { return this.pressed.has(c); }

  /**
   * WASD / 方向键合成的移动轴。
   * @returns {[number, number]} [x, y]，各自取值 -1 / 0 / 1
   */
  axis() {
    let x = 0, y = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) y += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y -= 1;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    return [x, y];
  }
  /**
   * 每帧末尾调用：清掉一次性按键与鼠标增量。
   * @returns {void}
   */
  endFrame() { this.pressed.clear(); this.mdx = 0; this.mdy = 0; }
}
