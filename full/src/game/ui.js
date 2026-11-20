// DOM 覆盖层：字幕、目标、活人感、被催星、手机、弹幕、小地图、抽卡、结算、片尾
import { DANMAKU } from '../data/text.js';
import { XR, ZR, BEACH_Z } from '../core/config.js';
import { shoreEdge } from '../world/terrain.js';

const $ = (id) => document.getElementById(id);

export class UI {
  constructor() {
    this.sub = $('sub'); this.obj = $('objective'); this.timer = $('timer');
    this.meter = $('meter-fill'); this.meterTxt = $('meter-txt'); this.stars = $('stars');
    this.phone = $('phone'); this.dm = $('danmaku'); this.mm = $('minimap'); this.hint = $('hint');
    this.quality = $('quality'); this.hud = $('hud');
    this.mctx = this.mm.getContext('2d');
    this.subT = 0; this.dmT = 2; this.dmRate = 2.4;
    this.mapBg = this.drawMapBg();
  }

  showHud(v) { this.hud.style.opacity = v ? 1 : 0; }

  say(who, text, dur = 4) {
    this.sub.innerHTML = `<b>${who}</b>${text}`;
    this.sub.classList.add('on'); this.subT = dur;
  }

  objective(text) {
    this.obj.textContent = text || '';
    this.obj.classList.toggle('on', !!text);
    if (text) { this.obj.classList.remove('flash'); void this.obj.offsetWidth; this.obj.classList.add('flash'); }
  }

  setTimer(s) { this.timer.textContent = s == null ? '' : `⏱ ${Math.max(0, Math.ceil(s))}s`; }
  setMeter(v) { this.meter.style.width = `${v}%`; this.meterTxt.textContent = `活人感 ${Math.round(v)}%`; }
  setStars(n) { this.stars.innerHTML = '★★★★★'.split('').map((s, i) => `<span class="${i < n ? 'lit' : ''}">${s}</span>`).join(''); }
  setQuality(t, low) { this.quality.textContent = t; this.quality.classList.toggle('low', !!low); }
  setHint(t) { this.hint.innerHTML = t || ''; this.hint.classList.toggle('on', !!t); }

  phoneMsg(from, text) {
    const d = document.createElement('div');
    d.className = 'msg'; d.innerHTML = `<b>${from}</b>${text}`;
    this.phone.prepend(d);
    this.phone.classList.add('ring'); setTimeout(() => this.phone.classList.remove('ring'), 600);
    while (this.phone.children.length > 3) this.phone.lastChild.remove();
    setTimeout(() => d.classList.add('old'), 9000);
  }

  danmaku(text, big = false) {
    const d = document.createElement('div');
    d.className = 'dm' + (big ? ' big' : '');
    d.textContent = text || DANMAKU[Math.floor(Math.random() * DANMAKU.length)];
    // 固定轨道：同时最多 5 条，每条错开一行，避免两行字叠在一起
    this.dmLane = ((this.dmLane ?? -1) + 1) % 5;
    d.style.top = `${8 + this.dmLane * 6.4}%`;
    d.style.animationDuration = `${7 + Math.random() * 4}s`;
    if (Math.random() < 0.2) d.style.color = ['#ffd84a', '#7ef6ff', '#ff8ad8'][Math.floor(Math.random() * 3)];
    this.dm.appendChild(d);
    while (this.dm.children.length > 14) this.dm.firstChild.remove();
    setTimeout(() => d.remove(), 12000);
  }
  burst(list, n = 8) { for (let i = 0; i < n; i++) setTimeout(() => this.danmaku(list ? list[i % list.length] : null, i % 3 === 0), i * 140); }

  update(dt, active) {
    if (this.subT > 0) { this.subT -= dt; if (this.subT <= 0) this.sub.classList.remove('on'); }
    if (active) { this.dmT -= dt; if (this.dmT <= 0) { this.danmaku(); this.dmT = this.dmRate * (0.6 + Math.random() * 0.8); } }
  }

  drawMapBg() {
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const x = c.getContext('2d'), S = 512 / 760, o = 256;
    x.fillStyle = '#0d3446'; x.fillRect(0, 0, 512, 512);
    x.beginPath();
    for (let i = 0; i <= 128; i++) { const a = (i / 128) * Math.PI * 2, r = shoreEdge(a) - 40; x.lineTo(o + Math.cos(a) * r * S, o + Math.sin(a) * r * S); }
    x.fillStyle = '#d9c08a'; x.fill();
    x.fillStyle = '#b8b2a6'; x.fillRect(o - 170 * S, o - 170 * S, 340 * S, 340 * S);
    x.strokeStyle = '#3a3a40'; x.lineWidth = 14 * S;
    for (const rx of XR) { x.beginPath(); x.moveTo(o + rx * S, o - 157 * S); x.lineTo(o + rx * S, o + ((rx === 150 || rx === -150) ? BEACH_Z : 157) * S); x.stroke(); }
    for (const rz of [...ZR, BEACH_Z]) { x.beginPath(); x.moveTo(o - 157 * S, o + rz * S); x.lineTo(o + 157 * S, o + rz * S); x.stroke(); }
    x.fillStyle = '#ffcf5a'; x.beginPath(); x.arc(o, o, 6, 0, 7); x.fill();
    return c;
  }

  // 小地图：以玩家为中心旋转；route 是导航线（世界坐标的点）
  minimap(px, pz, yaw, marks, route) {
    const x = this.mctx, W = this.mm.width, S = 512 / 760, zoom = 1.6;
    x.save(); x.clearRect(0, 0, W, W);
    x.beginPath(); x.arc(W / 2, W / 2, W / 2 - 2, 0, 7); x.clip();
    x.translate(W / 2, W / 2); x.rotate(-yaw + Math.PI); x.scale(zoom, zoom);
    x.drawImage(this.mapBg, -256 - px * S, -256 - pz * S);
    if (route && route.length > 1) {
      x.lineJoin = 'round'; x.lineCap = 'round';
      for (const [w, c] of [[7, 'rgba(0,0,0,0.45)'], [4.2, '#ffc83a']]) {
        x.strokeStyle = c; x.lineWidth = w; x.beginPath();
        route.forEach(([wx, wz], i) => (i ? x.lineTo : x.moveTo).call(x, (wx - px) * S, (wz - pz) * S));
        x.stroke();
      }
    }
    const lim = (W / 2 - 14) / zoom;
    for (const m of marks) {
      let mx = (m.x - px) * S, mz = (m.z - pz) * S;
      const d = Math.hypot(mx, mz);
      if (m.edge && d > lim) { mx *= lim / d; mz *= lim / d; } // 目标太远就贴在小地图边上，指明方向
      x.fillStyle = m.color; x.beginPath(); x.arc(mx, mz, m.r || 4, 0, 7); x.fill();
    }
    x.restore();
    x.fillStyle = '#fff'; x.beginPath(); x.moveTo(W / 2, W / 2 - 9); x.lineTo(W / 2 - 6, W / 2 + 7); x.lineTo(W / 2 + 6, W / 2 + 7); x.fill();
  }

  // 投胎十连抽：前九张一张张翻开都是“富二代”，最后一张抖一抖，翻出来是“打工人”
  drawCards(result, auto, rich, onFlip) {
    return new Promise((res) => {
      const el = $('cards'); el.classList.add('on');
      if (document.pointerLockElement) document.exitPointerLock(); // 鼠标被锁住就点不了卡
      const card = (i, front) => `<div class="card mini" data-i="${i}"><div class="inner"><div class="back">?</div><div class="front">${front}</div></div></div>`;
      const nine = rich.slice(0, 9).map((r, i) => card(i, `<small>人生卡</small><b>富二代</b><i>${r}</i>`)).join('');
      const last = card(9, `<small>✨ 稀有款 ✨</small><b>${result.role}</b><small>出生地</small><b>${result.place}</b><small>天赋</small><i>${result.talent}</i>`);
      el.innerHTML = `<h2>人生十连抽</h2><div class="row grid10">${nine}${last}</div><p class="tip" id="cards-tip">点一下开始十连（或按空格）</p>`;
      const cards = el.querySelectorAll('.card'), tip = $('cards-tip');
      const go = () => {
        if (el.dataset.done) return; el.dataset.done = 1;
        removeEventListener('keydown', onKey); el.removeEventListener('click', go);
        tip.textContent = '抽卡中…';
        cards.forEach((c, i) => { if (i < 9) setTimeout(() => { c.classList.add('flip'); onFlip && onFlip(i); }, 300 + i * 330); });
        const t9 = 300 + 9 * 330;
        setTimeout(() => { tip.textContent = '最后一张……'; cards[9].classList.add('shake'); onFlip && onFlip('shake'); }, t9);
        setTimeout(() => {
          cards.forEach((c, i) => { if (i < 9) c.classList.add('fade'); });
          cards[9].classList.add('flip', 'big'); tip.innerHTML = '恭喜抽到稀有款：<b>普通人</b>'; onFlip && onFlip('ssr');
        }, t9 + 1300);
        setTimeout(() => { el.classList.remove('on'); delete el.dataset.done; res(); }, t9 + 4600);
      };
      const onKey = (e) => { if (['Space', 'Enter', 'Digit1', 'Digit2', 'Digit3'].includes(e.code)) go(); };
      el.addEventListener('click', go); addEventListener('keydown', onKey);
      if (auto) setTimeout(go, 1200);
    });
  }

  // ---------- 任务列表：右边一列，做完打勾 ----------
  quests(list, cur, note, title = '人生任务') {
    const el = $('quests');
    const key = title + list.map((q) => q.done + (q.note || '')).join() + cur + note;
    if (key === this._qkey) return; this._qkey = key;
    el.innerHTML = `<h4>${title}</h4>${list.map((q, i) => `${q.head ? `<h5>${q.head}</h5>` : ''}<div class="q ${q.done ? 'done' : ''} ${i === cur ? 'cur' : ''} ${q.side ? 'side' : ''}"><span>${q.done ? '✓' : i === cur ? '▶' : '·'}</span>${q.t}${(i === cur && note) || q.note ? `<em>${q.note || note}</em>` : ''}</div>`).join('')}`;
  }

  // 到地方的大字
  banner(big, small = '') {
    const el = $('banner');
    el.innerHTML = `<b>${big}</b>${small ? `<i>${small}</i>` : ''}`;
    el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
    clearTimeout(this._bt); this._bt = setTimeout(() => el.classList.remove('on'), 2600);
  }

  // 弹窗：降落伞付费、假过场、超速警告都用它
  popup(html, kind = '', dur = 2.6) {
    const el = $('popup');
    el.className = kind; el.innerHTML = html;
    void el.offsetWidth; el.classList.add('on');
    clearTimeout(this._pt); if (dur) this._pt = setTimeout(() => el.classList.remove('on'), dur * 1000);
  }
  popupOff() { $('popup').classList.remove('on'); }

  // ---------- M：全岛大地图 ----------
  bigMap(on, d) {
    const el = $('bigmap');
    el.classList.toggle('on', on);
    if (!on) return;
    const cv = $('bigmap-c'), x = cv.getContext('2d'), W = cv.width, S = W / 580, o = W / 2; // 放大一些，岛占满画面
    const P = (wx, wz) => [o + wx * S, o + wz * S];
    x.clearRect(0, 0, W, W);
    x.fillStyle = '#0d3446'; x.fillRect(0, 0, W, W);
    x.drawImage(this.mapBg, o - 380 * S, o - 380 * S, 760 * S, 760 * S);
    // 街区
    for (const [name, wx, wz, c] of d.areas) {
      const [px, py] = P(wx, wz);
      x.fillStyle = c; x.globalAlpha = 0.22; x.beginPath(); x.arc(px, py, 46 * S * 1.6, 0, 7); x.fill(); x.globalAlpha = 1;
      x.font = '800 22px "PingFang SC"'; x.textAlign = 'center'; x.lineWidth = 5; x.strokeStyle = 'rgba(0,0,0,0.8)';
      x.strokeText(name, px, py); x.fillStyle = '#fff'; x.fillText(name, px, py);
    }
    if (d.route && d.route.length > 1) {
      x.lineJoin = 'round'; x.lineCap = 'round';
      for (const [w, c] of [[10, 'rgba(0,0,0,0.5)'], [6, '#ffc83a']]) {
        x.strokeStyle = c; x.lineWidth = w; x.beginPath();
        d.route.forEach(([wx, wz], i) => { const [px, py] = P(wx, wz); i ? x.lineTo(px, py) : x.moveTo(px, py); }); x.stroke();
      }
    }
    for (const m of d.marks) {
      const [px, py] = P(m.x, m.z);
      x.fillStyle = m.color; x.beginPath(); x.arc(px, py, m.r || 7, 0, 7); x.fill();
      if (m.label) { x.font = '700 18px "PingFang SC"'; x.textAlign = 'center'; x.lineWidth = 4; x.strokeStyle = '#000'; x.strokeText(m.label, px, py - 14); x.fillStyle = m.color; x.fillText(m.label, px, py - 14); }
    }
    const [px, py] = P(d.px, d.pz);
    x.save(); x.translate(px, py); x.rotate(-d.yaw + Math.PI);
    x.fillStyle = '#fff'; x.strokeStyle = '#000'; x.lineWidth = 3;
    x.beginPath(); x.moveTo(0, -16); x.lineTo(-11, 12); x.lineTo(0, 6); x.lineTo(11, 12); x.closePath(); x.stroke(); x.fill();
    x.restore();
    $('bigmap-goal').innerHTML = d.goal ? `现在要做：<b>${d.goal}</b>` : '自由闯荡';
  }

  result(lines, dur = 5, title = '人生任务完成') {
    const el = $('result');
    el.innerHTML = `<h2>${title}</h2>${lines.map((l) => `<p>${l}</p>`).join('')}`;
    el.classList.add('on');
    clearTimeout(this._rt); this._rt = setTimeout(() => el.classList.remove('on'), dur * 1000);
  }

  title(on, big, small) {
    const el = $('finale');
    if (on) el.innerHTML = `<h1>${big}</h1><p>${small}</p>`;
    el.classList.toggle('on', on);
  }

  // 捧腹大笑动图弹窗（动图来自奶蛙艺术圣殿库房，MIT）
  laughPop(on) {
    const el = $('laughpop');
    if (on) { el.classList.remove('on'); void el.offsetWidth; }
    el.classList.toggle('on', on);
  }

  skip(on) { $('skip').classList.toggle('on', on); }
}

// 加载画面轮播小贴士
export function loadingTips(tips) {
  const el = $('load-tip');
  let i = Math.floor(Math.random() * tips.length);
  el.textContent = tips[i];
  return setInterval(() => { i = (i + 1) % tips.length; el.textContent = tips[i]; }, 3200);
}
