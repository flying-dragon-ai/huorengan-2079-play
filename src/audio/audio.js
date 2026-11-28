// WebAudio 合成音效、引擎声、芯片音乐电台、系统语音念台词，外加旧作里的录音音效
// 录音来源见 assets/来源.md：奶蛙笑声是 MIT；梗音效是网友上传的，只适合比赛演示
import { audioUrl } from '../core/paths.js';

// [文件, 从第几秒开始, 放多长]
/**
 * 录音音效表：键 → [文件名, 从第几秒开始, 放多长]。
 * @type {Record<string, [string, number, number]>}
 */
export const SAMPLES = {
  laughLong: ['naiwa-baoxiao.mp3', 2.6, 6],
  laughShort: ['naiwa-pet-laugh.wav', 0, 1.8],
  feidudu: ['feidudu.mp3', 0.08, 2.9],
  feidudu2: ['feidudu-echo.mp3', 0.28, 0.82],
  cowmama: ['cow-mama.wav', 0, 5.1],
  shanshen: ['shanshenbu.mp3', 0, 0.72],
  banana1: ['banana-cry-1.mp3', 0.14, 0.84], banana2: ['banana-cry-2.mp3', 0.24, 1.04],
  oiia1: ['oiia-1.mp3', 0.46, 1.5], oiia2: ['oiia-2.mp3', 0.28, 1.48],
  daodun1: ['daodun.mp3', 0.2, 1.0], daodun2: ['daodun-2.mp3', 0.2, 0.84],
  gugu1: ['gugugaga-1.mp3', 0.04, 1.0], gugu2: ['gugugaga-2.mp3', 0.14, 1.04],
};

/**
 * 音频系统：WebAudio 合成音效 + 录音采样 + 引擎/风声循环 + 芯片音乐 + 系统语音。
 * 浏览器要求用户手势后才能出声，所以 start() 要等第一次点击/按键。
 */
export class Audio {
  constructor() { this.ctx = null; this.voice = null; this.enabled = true; this.bufs = {}; this.memeUntil = 0; }

  /**
   * 加载 SAMPLES 里所有录音。页面内嵌了 #sound-bank 就直接用内嵌的 base64，否则走网络。
   * @returns {Promise<void>}
   */
  async loadSamples() {
    const C = this.ctx;
    const pack = document.getElementById('sound-bank');
    const embedded = pack && JSON.parse(pack.textContent);
    await Promise.all(Object.entries(SAMPLES).map(async ([k, [file]]) => {
      try {
        const bytes = embedded
          ? Uint8Array.from(atob(embedded[file]), c => c.charCodeAt(0)).buffer
          : await (await fetch(audioUrl(file))).arrayBuffer();
        this.bufs[k] = await C.decodeAudioData(bytes);
      } catch (e) { console.warn('[audio] 加载失败', file, e && e.message); }
    }));
  }

  // 放一段录音。meme: 梗音效同一时间只放一个，免得吵成一锅粥
  /**
   * 放一段录音。
   * @param {string} key SAMPLES 里的键
   * @param {{vol?: number, rate?: number, delay?: number, meme?: boolean}} [opts] 音量 / 倍速 / 延迟（秒）/ 是否算梗音效
   * @returns {boolean} 没加载到或梗音效还在冷却就返回 false
   */
  play(key, { vol = 0.8, rate = 1, delay = 0, meme = false } = {}) {
    const C = this.ctx, b = this.bufs[key];
    if (!C || !b) return false;
    const t = C.currentTime + delay, [, off, len] = SAMPLES[key], dur = Math.min(len, b.duration - off);
    if (meme) { if (t < this.memeUntil) return false; this.memeUntil = t + dur / rate + 0.3; }
    const s = C.createBufferSource(), g = C.createGain();
    s.buffer = b; s.playbackRate.value = rate;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.015);
    g.gain.setValueAtTime(vol, t + Math.max(0.03, dur / rate - 0.06)); g.gain.linearRampToValueAtTime(0, t + dur / rate);
    s.connect(g); g.connect(this.sfxBus); s.start(t, off, dur);
    return true;
  }

  /** 建 AudioContext、总线、噪声缓冲、风声与引擎循环，并开始加载采样与音乐。 @returns {void} */
  start() {
    if (this.ctx) return;
    const C = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
    this.master = C.createGain(); this.master.gain.value = 0.8;
    const comp = C.createDynamicsCompressor(); this.master.connect(comp); comp.connect(C.destination);
    this.musicBus = C.createGain(); this.musicBus.gain.value = 0.0; this.musicBus.connect(this.master);
    this.sfxBus = C.createGain(); this.sfxBus.gain.value = 0.9; this.sfxBus.connect(this.master);
    // 噪声
    const len = C.sampleRate * 2, b = C.createBuffer(1, len, C.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = b;
    // 风声
    this.wind = this.loopNoise(400, 0); 
    // 引擎
    const o = C.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 60;
    const o2 = C.createOscillator(); o2.type = 'square'; o2.frequency.value = 30;
    const f = C.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
    this.engGain = C.createGain(); this.engGain.gain.value = 0;
    o.connect(f); o2.connect(f); f.connect(this.engGain); this.engGain.connect(this.sfxBus);
    o.start(); o2.start();
    this.eng = { o, o2, f };
    this.pickVoice();
    speechSynthesis.onvoiceschanged = () => this.pickVoice();
    // 万一声音还被浏览器挡着，下次点击或按键时再打开
    const wake = () => { if (C.state !== 'running') C.resume(); };
    addEventListener('pointerdown', wake); addEventListener('keydown', wake);
    this.loadSamples();
    this.music();
  }

  /** 挑一个中文系统语音（优先婷婷/美佳等）。 @returns {void} */
  pickVoice() {
    const vs = speechSynthesis.getVoices().filter((v) => /zh[-_]CN/i.test(v.lang));
    this.voice = vs.find((v) => /Tingting|Ting-Ting|Meijia|Yu-shu|Li-mu/i.test(v.name)) || vs[0] || null;
  }

  /**
   * 建一条循环噪声（风声用）。
   * @param {number} freq 带通中心频率（Hz）
   * @param {number} gain 初始增益
   * @returns {{g: GainNode, f: BiquadFilterNode}} 增益与滤波器节点
   */
  loopNoise(freq, gain) {
    const C = this.ctx, s = C.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = C.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.6;
    const g = C.createGain(); g.gain.value = gain;
    s.connect(f); f.connect(g); g.connect(this.sfxBus); s.start();
    return { g, f };
  }

  /** 空降风声：音量与中心频率跟着下落速度走。 @param {number} v 0..1 的风力 @returns {void} */
  setWind(v) { if (this.ctx) { this.wind.g.gain.setTargetAtTime(v * 0.5, this.ctx.currentTime, 0.1); this.wind.f.frequency.setTargetAtTime(300 + v * 900, this.ctx.currentTime, 0.1); } }
  /**
   * 引擎声：开关与转速。
   * @param {boolean} on 是否在骑
   * @param {number} speed 速度（米/秒）
   * @returns {void}
   */
  setEngine(on, speed) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engGain.gain.setTargetAtTime(on ? 0.06 + speed * 0.004 : 0, t, 0.1);
    this.eng.o.frequency.setTargetAtTime(55 + speed * 7, t, 0.05);
    this.eng.o2.frequency.setTargetAtTime(28 + speed * 3.5, t, 0.05);
    this.eng.f.frequency.setTargetAtTime(400 + speed * 40, t, 0.05);
  }

  /**
   * 一个滑音。
   * @param {OscillatorType} type 波形
   * @param {number} f0 起始频率（Hz）
   * @param {number} f1 结束频率（Hz）
   * @param {number} dur 时长（秒）
   * @param {number} [vol] 音量，默认 0.3
   * @param {number} [delay] 延迟（秒）
   * @returns {void}
   */
  tone(type, f0, f1, dur, vol = 0.3, delay = 0) {
    if (!this.ctx) return;
    const C = this.ctx, t = C.currentTime + delay;
    const o = C.createOscillator(), g = C.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.sfxBus); o.start(t); o.stop(t + dur + 0.05);
  }
  /**
   * 一段低通噪声。
   * @param {number} dur 时长（秒）
   * @param {number} [vol] 音量，默认 0.4
   * @param {number} [freq] 起始截止频率（Hz），默认 1200
   * @param {number} [delay] 延迟（秒）
   * @returns {void}
   */
  noise(dur, vol = 0.4, freq = 1200, delay = 0) {
    if (!this.ctx) return;
    const C = this.ctx, t = C.currentTime + delay, s = C.createBufferSource(); s.buffer = this.noiseBuf;
    const f = C.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(80, t + dur);
    const g = C.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfxBus); s.start(t); s.stop(t + dur + 0.05);
  }

  /** 弹簧“嘣”。 @returns {void} */
  boing() { this.tone('sine', 180, 900, 0.35, 0.35); this.tone('sine', 900, 300, 0.25, 0.2, 0.3); }
  /** 撞车。 @returns {void} */
  crash() { this.noise(0.5, 0.6, 3000); this.tone('square', 120, 40, 0.3, 0.15); }
  /** 摔成饼。 @returns {void} */
  splat() { this.noise(0.9, 0.9, 1800); this.tone('sine', 90, 30, 0.6, 0.6); }
  /** 气泡“啾”。 @returns {void} */
  pop() { this.tone('triangle', 600, 1400, 0.12, 0.25); }
  /** 金币。 @returns {void} */
  coin() { this.tone('square', 988, 988, 0.08, 0.15); this.tone('square', 1319, 1319, 0.3, 0.15, 0.08); }
  /** 挥空/风声。 @returns {void} */
  whoosh() { this.noise(0.6, 0.3, 4000); }
  /** 提示音。 @returns {void} */
  ding() { this.tone('sine', 1200, 1200, 0.5, 0.2); this.tone('sine', 1600, 1600, 0.6, 0.15, 0.12); }
  /** 升级音阶。 @returns {void} */
  upgrade() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone('square', f, f, 0.25, 0.12, i * 0.09)); this.whoosh(); }
  /** 爆炸。 @param {number} [delay] 延迟（秒） @returns {void} */
  boom(delay = 0) { this.noise(1.4, 0.7, 900, delay); this.tone('sine', 70, 25, 1.0, 0.5, delay); }
  /** 奶蛙笑：有录音就放录音，没有就用合成的罐头笑声顶上。 @returns {void} */
  laugh() {
    // 奶蛙的真笑声：短笑两遍，再接一段爆笑原声
    if (this.bufs.laughLong) {
      this.play('laughShort', { vol: 0.9 }); this.play('laughShort', { vol: 0.8, delay: 1.7, rate: 1.05 });
      this.play('laughLong', { vol: 0.75, delay: 0.4 });
      return;
    }
    // 录音没加载到：用合成的罐头笑声顶上
    for (let i = 0; i < 14; i++) {
      const f = 260 + Math.random() * 180;
      this.tone('sawtooth', f * 1.3, f, 0.12, 0.06, i * 0.13);
      this.noise(0.08, 0.05, 2500, i * 0.13);
    }
    this.say('哈哈哈哈哈哈', { pitch: 1.6, rate: 1.4 });
  }

  /**
   * 用系统语音念一句台词。
   * @param {string} text 台词
   * @param {{pitch?: number, rate?: number, queue?: boolean}} [opts] 音高 / 语速 / 是否排队（不排队会打断上一句）
   * @returns {void}
   */
  say(text, { pitch = 1, rate = 1.1, queue = false } = {}) {
    if (!this.enabled || !window.speechSynthesis) return;
    if (!queue) speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN'; if (this.voice) u.voice = this.voice;
    u.pitch = this.coldMode ? 0.72 : pitch;
    u.rate = this.coldMode ? 1.02 : rate;
    u.volume = 0.85;
    speechSynthesis.speak(u);
  }

  /** 抵押「笑声与情绪」后切换到冰冷机房节拍。 */
  setColdMode(on) {
    this.coldMode = !!on;
    this.setMusic(on ? 0.22 : 0.48);
  }

  /** 音乐总线音量（0..1，带 0.8 秒渐变）。 @param {number} v 音量 @returns {void} */
  setMusic(v) { if (this.ctx) this.musicBus.gain.setTargetAtTime(v, this.ctx.currentTime, 0.8); }

  // 芯片音乐电台：简单的循环，低音加琶音（页面隐藏时暂停调度省 CPU）
  /** 启动芯片音乐电台：104 BPM，四小节和弦循环 + 琶音 + 旋律 + 噪声鼓。 @returns {void} */
  music() {
    const C = this.ctx, bpm = 104, step = 60 / bpm / 2;
    const prog = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
    const mel = [76, 74, 72, 74, 76, 76, 76, -1, 74, 74, 74, -1, 76, 79, 79, -1];
    let n = 0, next = C.currentTime + 0.1;
    const note = (m, t, dur, type, vol) => {
      const o = C.createOscillator(), g = C.createGain(); o.type = type;
      o.frequency.value = 440 * Math.pow(2, (m - 69) / 12);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      o.connect(g); g.connect(this.musicBus); o.start(t); o.stop(t + dur + 0.02);
    };
    const tick = () => {
      if (document.hidden || C.state !== 'running') { next = C.currentTime + 0.1; return; }
      while (next < C.currentTime + 0.3) {
        if (this.coldMode) {
          // 抵押笑声后的冰冷机房滴答声
          if (n % 2 === 0) note(n % 8 === 0 ? 45 : 57, next, 0.08, 'sine', 0.12);
        } else {
          const bar = Math.floor(n / 8) % 4, ch = prog[bar];
          if (n % 2 === 0) note(ch[0] - 24, next, step * 1.8, 'triangle', 0.22);
          note(ch[n % 3] + 12, next, step * 0.9, 'square', 0.035);
          const m = mel[n % 16];
          if (m > 0 && Math.floor(n / 16) % 2 === 1) note(m, next, step * 1.6, 'square', 0.05);
          if (n % 4 === 2) { const s = C.createBufferSource(); s.buffer = this.noiseBuf; const g = C.createGain(); g.gain.setValueAtTime(0.06, next); g.gain.exponentialRampToValueAtTime(0.001, next + 0.08); s.connect(g); g.connect(this.musicBus); s.start(next); s.stop(next + 0.1); }
        }
        next += step; n++;
      }
    };
    setInterval(tick, 120);
  }
}
