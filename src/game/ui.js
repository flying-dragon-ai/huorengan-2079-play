// DOM 覆盖层：极简 HUD、人性完整度筹码、3 锚点追踪、大地图、弹幕/AI 日志、重启抵押协议、贩卖机键盘、早读问答、记忆笔记本、三重结局
import { DANMAKU } from '../data/text.js';
import {
  HUMANITY_MODULES, ANCHOR_DEFS, DROP_HUBS, AI_LOGS, HOMETOWN_QUIZ, ENDINGS,
} from '../data/reboot-config.js';
import { XR, ZR, BEACH_Z } from '../core/config.js';
import { shoreEdge } from '../world/terrain.js';

const $ = (id) => document.getElementById(id);

function fmtClock(sec) {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export class UI {
  constructor() {
    this.sub = $('sub'); this.obj = $('objective'); this.timer = $('timer');
    this.loopBadge = $('loop-badge'); this.anchorCount = $('anchor-count');
    this.meter = $('meter-fill'); this.meterTxt = $('meter-txt'); this.stars = $('stars');
    this.chips = $('module-chips'); this.anchorList = $('anchor-list'); this.anchorCard = $('anchor-card');
    this.phone = $('phone'); this.dm = $('danmaku'); this.mm = $('minimap'); this.hint = $('hint');
    this.quality = $('quality'); this.hud = $('hud');
    this.mctx = this.mm ? this.mm.getContext('2d') : null;
    this.subT = 0; this.dmT = 2.6; this.dmRate = 3.2;
    this.aiLogMode = false;
    this._mmLast = 0;
    this.mapBg = this.mm ? this.drawMapBg() : null;
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

  setLoopClock(sec, loop, anchorsDone) {
    if (this.loopBadge) this.loopBadge.textContent = `第 ${loop} 世`;
    if (this.anchorCount) this.anchorCount.textContent = `锚点 ${anchorsDone} / 3`;
    if (this.timer) {
      if (sec == null) { this.timer.textContent = '自由闯荡'; this.timer.classList.remove('danger'); }
      else {
        this.timer.textContent = `⏱ ${fmtClock(sec)}`;
        this.timer.classList.toggle('danger', sec <= 30);
      }
    }
  }

  setTimer(s) {
    if (s == null) return;
    if (this.timer) {
      this.timer.textContent = `⏱ ${fmtClock(s)}`;
      this.timer.classList.toggle('danger', s <= 25);
    }
  }

  setMeter(v) {
    this.meter.style.width = `${v}%`;
    this.meterTxt.textContent = `人性完整度 ${Math.round(v)}%`;
  }

  /** 刷新右上人性完整度条与 5 枚活人模块状态筹码。 */
  setHumanity(rb) {
    const score = rb.humanityScore();
    this.meter.style.width = `${score}%`;
    this.meter.classList.toggle('cold', score <= 40);
    this.meterTxt.textContent = `人性完整度 ${score}%`;
    if (!this.chips) return;
    this.chips.innerHTML = HUMANITY_MODULES.map((m) => {
      const mort = rb.isMortgaged(m.id);
      const rec = rb.isReclaimed(m.id);
      const cls = rec ? 'mchip reclaimed' : mort ? 'mchip mortgaged' : 'mchip';
      const title = rec ? `${m.name}（已从回收站夺回！）` : mort ? `${m.name}（已抵押：${m.cost}）` : `${m.name}（完好）`;
      return `<div class="${cls}" title="${title}">${m.icon}${m.short}</div>`;
    }).join('');
  }

  /** 刷新左侧 3 枚锚点简洁追踪卡（点击或按 1/2/3 切换追踪）。 */
  renderAnchorTracker({ collected, tracked, intel, vaultActive, mortgagedCount, kangarooState }, onPick) {
    if (!this.anchorList) return;
    if (onPick) this._onPickTrack = onPick;
    const rows = ANCHOR_DEFS.map((a) => {
      const done = collected.has(a.id);
      const act = tracked === a.id && !done;
      let sub = a.hintLoop1;
      if (done) sub = '已入手！';
      else if (a.id === 'absurd') sub = intel.cafeCodeFound ? `维护码 ${intel.cafeCode} 已记住 → 东京贩卖机` : '①魔都加油咖啡查维护码 → ②东京贩卖机';
      else if (a.id === 'memory') sub = intel.quizSolved ? '答案已背熟 → 老家县一中秒答（大苹果地铁直达）' : '老家县一中班主任 3 题问答（大苹果地铁可秒传）';
      else if (a.id === 'pain') sub = kangarooState === 'locked' ? '袋鼠已锁进金字塔快递柜！快去按 E 撬柜' : '袋鼠正沿东线偷运！高速撞翻它截胡';
      return `<div class="arow ${done ? 'done' : ''} ${act ? 'active' : ''}" data-track="${a.id}">
        <div class="atitle"><span>[${a.index}] ${a.short}</span><span>${done ? '✓' : act ? '▶ 追踪中' : '未获取'}</span></div>
        <div class="asub">${sub}</div>
      </div>`;
    });
    if (vaultActive && mortgagedCount > 0) {
      const act = tracked === 'vault';
      rows.push(`<div class="arow vault ${act ? 'active' : ''}" data-track="vault">
        <div class="atitle"><span>[4] 算力回收站</span><span>剩余 ${mortgagedCount} 胶囊</span></div>
        <div class="asub">中央广场北侧！撞碎胶囊抢回你抵押的人性！</div>
      </div>`);
    }
    this.anchorList.innerHTML = rows.join('');
    this.anchorList.querySelectorAll('.arow').forEach((el) => {
      el.onclick = () => this._onPickTrack?.(el.dataset.track);
    });
  }

  setAnchorCardVisible(show) {
    if (this.anchorCard) this.anchorCard.style.display = show ? '' : 'none';
  }

  setStars(n) { this.stars.innerHTML = '★★★★★'.split('').map((s, i) => `<span class="${i < n ? 'lit' : ''}">${s}</span>`).join(''); }
  setQuality(t, low) { if (this.quality) { this.quality.textContent = t; this.quality.classList.toggle('low', !!low); } }
  setHint(t) { this.hint.innerHTML = t || ''; this.hint.classList.toggle('on', !!t); }

  phoneMsg(from, text) {
    const d = document.createElement('div');
    d.className = 'msg'; d.innerHTML = `<b>${from}</b>${text}`;
    this.phone.prepend(d);
    this.phone.classList.add('ring'); setTimeout(() => this.phone.classList.remove('ring'), 550);
    while (this.phone.children.length > 2) this.phone.lastChild.remove();
    setTimeout(() => d.classList.add('old'), 7000);
  }

  danmaku(text, big = false) {
    const d = document.createElement('div');
    const useLog = this.aiLogMode && !text;
    d.className = 'dm' + (big ? ' big' : '') + (useLog || (this.aiLogMode && text?.startsWith('[')) ? ' log' : '');
    const pool = this.aiLogMode ? AI_LOGS : DANMAKU;
    d.textContent = text || pool[Math.floor(Math.random() * pool.length)];
    this.dmLane = ((this.dmLane ?? -1) + 1) % 4;
    d.style.top = `${6 + this.dmLane * 22}%`;
    d.style.animationDuration = `${7.5 + Math.random() * 3.5}s`;
    if (!this.aiLogMode && Math.random() < 0.22) d.style.color = ['#ffd84a', '#7ef6ff', '#ff8ad8'][Math.floor(Math.random() * 3)];
    this.dm.appendChild(d);
    while (this.dm.children.length > 10) this.dm.firstChild.remove();
    setTimeout(() => d.remove(), 11500);
  }
  burst(list, n = 6) {
    const src = this.aiLogMode ? AI_LOGS : list;
    for (let i = 0; i < n; i++) setTimeout(() => this.danmaku(src ? src[i % src.length] : null, !this.aiLogMode && i % 3 === 0), i * 160);
  }

  update(dt, active) {
    if (this.subT > 0) { this.subT -= dt; if (this.subT <= 0) this.sub.classList.remove('on'); }
    if (active) { this.dmT -= dt; if (this.dmT <= 0) { this.danmaku(); this.dmT = this.dmRate * (0.7 + Math.random() * 0.8); } }
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

  // 小地图节流至 12 Hz（每 80ms 绘一次），避免 60/120Hz 空耗 CPU
  minimap(px, pz, yaw, marks, route) {
    if (!this.mctx) return;
    const now = performance.now();
    if (now - this._mmLast < 80) return;
    this._mmLast = now;
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
      if (m.edge && d > lim) { mx *= lim / d; mz *= lim / d; }
      x.fillStyle = m.color; x.beginPath(); x.arc(mx, mz, m.r || 4, 0, 7); x.fill();
    }
    x.restore();
    x.fillStyle = '#fff'; x.beginPath(); x.moveTo(W / 2, W / 2 - 9); x.lineTo(W / 2 - 6, W / 2 + 7); x.lineTo(W / 2 + 6, W / 2 + 7); x.fill();
  }

  drawCards(result, auto, rich, onFlip) {
    return new Promise((res) => {
      const el = $('cards'); el.classList.add('on');
      if (document.pointerLockElement) document.exitPointerLock();
      const card = (i, front) => `<div class="card mini" data-i="${i}"><div class="inner"><div class="back">?</div><div class="front">${front}</div></div></div>`;
      const nine = rich.slice(0, 9).map((r, i) => card(i, `<small>人生卡</small><b>富二代</b><i>${r}</i>`)).join('');
      const last = card(9, `<small>✨ 稀有款 ✨</small><b>${result.role}</b><small>出生地</small><b>${result.place}</b><small>天赋</small><i>${result.talent}</i>`);
      el.innerHTML = `<h2>人生十连抽</h2><div class="row grid10">${nine}${last}</div><p class="tip" id="cards-tip">点一下开始十连（或按空格）</p>`;
      const cards = el.querySelectorAll('.card'), tip = $('cards-tip');
      const go = () => {
        if (el.dataset.done) return; el.dataset.done = 1;
        removeEventListener('keydown', onKey); el.removeEventListener('click', go);
        tip.textContent = '抽卡中…';
        cards.forEach((c, i) => { if (i < 9) setTimeout(() => { c.classList.add('flip'); onFlip && onFlip(i); }, 180 + i * 160); });
        const t9 = 180 + 9 * 160;
        setTimeout(() => { tip.textContent = '最后一张……'; cards[9].classList.add('shake'); onFlip && onFlip('shake'); }, t9);
        setTimeout(() => {
          cards.forEach((c, i) => { if (i < 9) c.classList.add('fade'); });
          cards[9].classList.add('flip', 'big'); tip.innerHTML = '恭喜抽到稀有款：<b>普通人（活人感 100%）</b>'; onFlip && onFlip('ssr');
        }, t9 + 750);
        setTimeout(() => { el.classList.remove('on'); delete el.dataset.done; res(); }, t9 + 2400);
      };
      const onKey = (e) => { if (['Space', 'Enter', 'Digit1', 'Digit2', 'Digit3'].includes(e.code)) go(); };
      el.addEventListener('click', go); addEventListener('keydown', onKey);
      if (auto) setTimeout(go, 600);
    });
  }

  quests(list, cur, note, title = '街区任务') {
    const el = $('quests');
    const key = title + list.map((q) => q.done + (q.note || '')).join() + cur + note;
    if (key === this._qkey) return; this._qkey = key;
    el.innerHTML = `<h4>${title}</h4>${list.map((q, i) => `${q.head ? `<h5>${q.head}</h5>` : ''}<div class="q ${q.done ? 'done' : ''} ${i === cur ? 'cur' : ''} ${q.side ? 'side' : ''}"><span>${q.done ? '✓' : i === cur ? '▶' : '·'}</span>${q.t}${(i === cur && note) || q.note ? `<em>${q.note || note}</em>` : ''}</div>`).join('')}`;
  }

  banner(big, small = '') {
    const el = $('banner');
    el.innerHTML = `<b>${big}</b>${small ? `<i>${small}</i>` : ''}`;
    el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
    clearTimeout(this._bt); this._bt = setTimeout(() => el.classList.remove('on'), 2600);
  }

  popup(html, kind = '', dur = 2.6) {
    const el = $('popup');
    el.className = kind; el.innerHTML = html;
    void el.offsetWidth; el.classList.add('on');
    clearTimeout(this._pt); if (dur) this._pt = setTimeout(() => el.classList.remove('on'), dur * 1000);
  }
  popupOff() { $('popup').classList.remove('on'); }

  /** 清爽大地图：分层绘制街区底名 + 清晰不重叠的锚点/回收站/幽灵图标。 */
  bigMap(on, d) {
    const el = $('bigmap');
    el.classList.toggle('on', on);
    if (!on) return;
    const cv = $('bigmap-c'), x = cv.getContext('2d'), W = cv.width, S = W / 580, o = W / 2;
    const P = (wx, wz) => [o + wx * S, o + wz * S];
    x.clearRect(0, 0, W, W);
    x.fillStyle = '#0d3446'; x.fillRect(0, 0, W, W);
    x.drawImage(this.mapBg, o - 380 * S, o - 380 * S, 760 * S, 760 * S);
    // 街区底名：偏柔和半透明，不与任务标打架
    for (const [name, wx, wz, c] of d.areas) {
      const [px, py] = P(wx, wz);
      x.fillStyle = c; x.globalAlpha = 0.16; x.beginPath(); x.arc(px, py, 44 * S * 1.5, 0, 7); x.fill();
      x.globalAlpha = 0.62;
      x.font = '800 21px "PingFang SC"'; x.textAlign = 'center'; x.lineWidth = 4; x.strokeStyle = 'rgba(0,0,0,0.75)';
      x.strokeText(name, px, py + 24); x.fillStyle = '#e8f0f8'; x.fillText(name, px, py + 24);
      x.globalAlpha = 1;
    }
    if (d.route && d.route.length > 1) {
      x.lineJoin = 'round'; x.lineCap = 'round';
      for (const [w, c] of [[10, 'rgba(0,0,0,0.5)'], [6, '#ffc83a']]) {
        x.strokeStyle = c; x.lineWidth = w; x.beginPath();
        d.route.forEach(([wx, wz], i) => { const [px, py] = P(wx, wz); i ? x.lineTo(px, py) : x.moveTo(px, py); }); x.stroke();
      }
    }
    // 防重叠标记标签布局
    const placed = [];
    for (const m of d.marks) {
      const [px, py] = P(m.x, m.z);
      x.fillStyle = m.color; x.beginPath(); x.arc(px, py, m.r || 7, 0, 7); x.fill();
      x.strokeStyle = '#000'; x.lineWidth = 2.5; x.stroke();
      if (m.label) {
        let ly = py - 16;
        for (const p of placed) if (Math.abs(p[0] - px) < 110 && Math.abs(p[1] - ly) < 24) ly -= 24;
        placed.push([px, ly]);
        x.font = '800 18px "PingFang SC"'; x.textAlign = 'center'; x.lineWidth = 4.5; x.strokeStyle = 'rgba(0,0,0,0.92)';
        x.strokeText(m.label, px, ly); x.fillStyle = m.color; x.fillText(m.label, px, ly);
      }
    }
    const [px, py] = P(d.px, d.pz);
    x.save(); x.translate(px, py); x.rotate(-d.yaw + Math.PI);
    x.fillStyle = '#fff'; x.strokeStyle = '#000'; x.lineWidth = 3;
    x.beginPath(); x.moveTo(0, -16); x.lineTo(-11, 12); x.lineTo(0, 6); x.lineTo(11, 12); x.closePath(); x.stroke(); x.fill();
    x.restore();
    $('bigmap-goal').innerHTML = d.goal ? `当前目标：<b>${d.goal}</b>` : '自由闯荡';
  }

  /** 《重启算力抵押协议》弹窗。 */
  showRebootModal({ open, reason, rb, canCancel, onConfirm, onCancel }) {
    const el = $('reboot-modal'), body = $('reboot-body');
    el.classList.toggle('on', open);
    if (!open) return;
    const avail = rb.availableToMortgage();
    let sel = avail[0]?.id || null;
    let hub = rb.spawnHub || 'plaza';

    const intelTags = [];
    if (rb.intel.cafeCodeFound) intelTags.push(`✓ 东京维护码：${rb.intel.cafeCode}`);
    if (rb.intel.subwayFound) intelTags.push('✓ 大苹果→铁岭地铁捷径');
    if (rb.intel.quizSolved) intelTags.push('✓ 班主任早读 3 题答案');
    if (rb.intel.kangarooAmbushFound) intelTags.push('✓ 袋鼠偷运路线');
    if (!intelTags.length) intelTags.push('暂未记下捷径线索（下世可继续探索）');

    const render = () => {
      const nextScore = sel ? Math.max(0, rb.humanityScore() - 20) : rb.humanityScore();
      const showHubs = sel === 'memory' || rb.isMortgaged('memory');
      body.innerHTML = `
        <h2>↺ 重启算力抵押协议 · 第 ${rb.loop} → ${rb.loop + 1} 世</h2>
        <p class="modal-sub">${reason}<br>大肥鱼 AI 客服：<b>「所有情报都会为您永久保留！只需交出 1 枚低效活人模块作为重启算力税。」</b></p>
        <div class="intel-pills">${intelTags.map((t) => `<span class="ipill">${t}</span>`).join('')}</div>
        ${avail.length ? `
          <div class="mgrid">${avail.map((m) => `
            <button type="button" class="mcard ${sel === m.id ? 'sel' : ''}" data-mid="${m.id}">
              <div class="mhead">${m.icon} 抵押：${m.name}</div>
              <div class="mgain">▲ AI 甜头：${m.sweetener}</div>
              <div class="mcost">▼ 永久代价：${m.cost}</div>
            </button>`).join('')}
          </div>` : `<p class="modal-sub" style="color:#ff9a9e">你已交出全部 5 枚活人模块，你的「空壳」将带着满城旧自己幽灵开启下一世。</p>`}
        ${showHubs ? `
          <div class="hub-row"><span style="font-size:12px;color:#7ef6ff;font-weight:700">定点空降特权：</span>
            ${DROP_HUBS.map((h) => `<button type="button" class="hub-btn ${hub === h.id ? 'sel' : ''}" data-hub="${h.id}">${h.name}</button>`).join('')}
          </div>` : ''}
        <div class="modal-foot">
          <div style="font-size:13px;color:#c9dce8">
            人性完整度：<b>${rb.humanityScore()}% → <span style="color:#ff8a90">${nextScore}%</span></b> ·
            第 ${rb.loop} 世轨迹将化作 <b>AI 托管幽灵</b>留在岛上
          </div>
          <div style="display:flex;gap:10px">
            ${canCancel ? '<button type="button" class="btn-secondary" id="rb-cancel">继续本轮</button>' : ''}
            <button type="button" class="btn-primary" id="rb-confirm">签署抵押 · 重启第 ${rb.loop + 1} 世</button>
          </div>
        </div>`;
      body.querySelectorAll('.mcard').forEach((b) => { b.onclick = () => { sel = b.dataset.mid; render(); }; });
      body.querySelectorAll('.hub-btn').forEach((b) => { b.onclick = () => { hub = b.dataset.hub; render(); }; });
      const cc = $('rb-cancel'); if (cc) cc.onclick = () => onCancel?.();
      $('rb-confirm').onclick = () => onConfirm?.(sel, hub);
    };
    render();
  }

  /** 东京「人生贩卖机」3 位维护码互动键盘。 */
  showVendorModal({ open, expectedCode, known, onSuccess, onWrong, onClose }) {
    const el = $('vendor-modal'), body = $('vendor-body');
    el.classList.toggle('on', open);
    if (!open) return;
    let typed = '';
    const render = () => {
      body.innerHTML = `
        <h2>🥤 东京 · 人生贩卖机维护口</h2>
        <p class="modal-sub">${known ? `记忆笔记本提示：魔都加油咖啡小票维护码为 <b style="color:#ffd84a">${expectedCode}</b>` : '需要 3 位维护码（提示：魔都弄堂「加油咖啡」¥800 小票背面有写）'}</p>
        <div class="code-disp">${(typed + '___').slice(0, 3)}</div>
        <div class="kp-grid">${['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '✓'].map((k) => `<button type="button" data-k="${k}">${k}</button>`).join('')}</div>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
          ${known ? `<button type="button" class="btn-primary cyan" id="kp-auto">一键填入 ${expectedCode}</button>` : ''}
          <button type="button" class="btn-secondary" id="kp-close">先离开</button>
        </div>`;
      const submit = () => {
        if (typed === expectedCode) { el.classList.remove('on'); onSuccess?.(); }
        else { el.classList.remove('on'); onWrong?.(typed); }
      };
      body.querySelectorAll('.kp-grid button').forEach((b) => {
        b.onclick = () => {
          const k = b.dataset.k;
          if (k === 'C') typed = '';
          else if (k === '✓') { submit(); return; }
          else if (typed.length < 3) typed += k;
          if (typed.length === 3) { render(); setTimeout(submit, 180); return; }
          render();
        };
      });
      const autoBtn = $('kp-auto');
      if (autoBtn) autoBtn.onclick = () => { typed = expectedCode; render(); setTimeout(submit, 150); };
      $('kp-close').onclick = () => { el.classList.remove('on'); onClose?.(); };
    };
    render();
  }

  /** 老家县一中班主任早读 3 题快问快答弹窗。 */
  showQuizModal({ open, known, onPass, onFail, onClose }) {
    const el = $('quiz-modal'), body = $('quiz-body');
    el.classList.toggle('on', open);
    if (!open) return;
    let qi = 0;
    const render = () => {
      const q = HOMETOWN_QUIZ[qi];
      body.innerHTML = `
        <h2>📚 班主任早读抽查（${qi + 1} / ${HOMETOWN_QUIZ.length}）</h2>
        <p class="modal-sub" style="font-size:17px;color:#fff;font-weight:700">${q.q}</p>
        <div class="quiz-opts">
          ${q.options.map((opt, idx) => `
            <button type="button" class="qopt" data-idx="${idx}">
              <span><b>${idx + 1}.</b> ${opt}</span>
              ${known && idx === q.answer ? '<span class="hint-tag">★ 上一世背过</span>' : ''}
            </button>`).join('')}
        </div>
        <div class="modal-foot">
          <span style="font-size:12px;color:#b7ccd9">答错会被班主任训话并扣 8 秒倒计时 · 可按数字键 1/2/3 作答</span>
          <button type="button" class="btn-secondary" id="qz-close">先溜了</button>
        </div>`;
      const pick = (idx) => {
        if (idx === q.answer) {
          qi++;
          if (qi >= HOMETOWN_QUIZ.length) {
            removeEventListener('keydown', onKey);
            el.classList.remove('on');
            onPass?.();
          } else render();
        } else {
          removeEventListener('keydown', onKey);
          el.classList.remove('on');
          onFail?.(q.clue);
        }
      };
      const onKey = (e) => {
        if (e.code === 'Digit1') pick(0);
        else if (e.code === 'Digit2') pick(1);
        else if (e.code === 'Digit3') pick(2);
        else if (e.code === 'Escape') { removeEventListener('keydown', onKey); el.classList.remove('on'); onClose?.(); }
      };
      removeEventListener('keydown', this._quizKey || (() => {}));
      this._quizKey = onKey;
      addEventListener('keydown', onKey);
      body.querySelectorAll('.qopt').forEach((b) => { b.onclick = () => pick(Number(b.dataset.idx)); });
      $('qz-close').onclick = () => { removeEventListener('keydown', onKey); el.classList.remove('on'); onClose?.(); };
    };
    render();
  }

  /** 跨轮次记忆笔记本（Tab 打开）。 */
  showNotebookModal({ open, rb, collected, onClose }) {
    const el = $('notebook-modal'), body = $('notebook-body');
    el.classList.toggle('on', open);
    if (!open) return;
    const intelRows = [
      ['① 魔都→东京维护码', rb.intel.cafeCodeFound ? `已记下：${rb.intel.cafeCode}（下世可直接去东京贩卖机输码）` : '未发现：去魔都「加油咖啡」买那杯 ¥800 咖啡看小票'],
      ['② 大苹果铁岭地铁', rb.intel.subwayFound ? '已发现：大苹果西南角地铁口直传老家县一中门口！' : '未发现：大苹果街区藏着直通老家的神秘地铁口'],
      ['② 老家早读 3 题答案', rb.intel.quizSolved ? '已背熟：下世答题将自动高亮正确答案！' : '未背熟：线索藏在老家菜市场、冰岛考勤机与巴黎面包店'],
      ['③ 袋鼠偷运路线', rb.intel.kangarooAmbushFound ? '已摸清：开局沿海滩→大苹果东线直奔金字塔快递柜，可提前埋伏撞翻！' : '未摸清：去海滩或金字塔快递柜追踪偷锚点的袋鼠'],
      ['★ 隐藏真相：算力回收站', rb.intel.vaultDiscovered ? '已解锁！抵押 ≥2 项活人模块后，中央广场北侧会出现回收站胶囊，撞碎可抢回全部失去的自己！' : '？？？【抵押 ≥2 项活人模块后显现异常】'],
    ];
    body.innerHTML = `
      <h2>📓 跨轮次记忆笔记本 · 第 ${rb.loop} 世</h2>
      <p class="modal-sub">无论重启多少次，笔记本里的情报都不会被 AI 清除——但你抵押掉的人性会留在过去。</p>
      <div class="ending-receipt">
        ${intelRows.map(([k, v]) => `<div><b style="color:#ffd84a">${k}：</b>${v}</div>`).join('')}
      </div>
      <div style="font-size:13px;color:#b7ccd9;margin-bottom:14px">
        本轮已收锚点：<b>${collected.size} / 3</b> · 当前场上旧自己幽灵：<b>${rb.ghostTracks.length} 个</b> · 已解锁结局：<b>${rb.endingsUnlocked.length} / 3</b>
      </div>
      <div class="modal-foot">
        <span style="font-size:12px;opacity:.75">按 Tab 或 Esc 关闭</span>
        <button type="button" class="btn-primary cyan" id="nb-close">继续逃生</button>
      </div>`;
    $('nb-close').onclick = () => onClose?.();
  }

  /** 三重结局结算单弹窗。 */
  showEndingModal({ open, ending, rb, elapsed, onReboot, onFree, onReset }) {
    const el = $('ending-modal'), body = $('ending-body');
    el.classList.toggle('on', open);
    if (!open || !ending) return;
    body.className = `modal-box ending-box ${ending.theme}`;
    const reclaimedList = HUMANITY_MODULES.filter((m) => rb.isReclaimed(m.id));
    const reclaimed = reclaimedList.map((m) => `${m.icon}${m.short}`).join('、') || '无';
    const mortgagedList = HUMANITY_MODULES.filter((m) => rb.isMortgaged(m.id));
    const mortgaged = mortgagedList.map((m) => `${m.icon}${m.short}`).join('、') || (reclaimedList.length ? '无（已全部从回收站暴力夺回！）' : '无（一寸自己都没卖！）');
    const unlocked = Object.values(ENDINGS).map((e) => rb.endingsUnlocked.includes(e.id) ? `✓ ${e.title}` : `🔒 ${e.badge.split('·')[0].trim()}`).join('　');
    body.innerHTML = `
      <div class="ending-badge">${ending.badge}</div>
      <h2 class="ending-title">${ending.title}</h2>
      <p class="modal-sub">${ending.subtitle}</p>
      <div class="ending-receipt">
        <div><b>经历世数：</b>第 ${rb.loop} 世（累计重启 ${rb.totalReboots} 次） · <b>本轮耗时：</b>${Math.round(elapsed)} 秒</div>
        <div><b>最终人性完整度：</b>${rb.humanityScore()}%</div>
        <div><b>仍在 AI 手中的抵押品：</b>${mortgaged}</div>
        <div><b>从回收站暴力夺回：</b>${reclaimed}</div>
        <div style="margin-top:8px;color:#ffd84a"><b>大肥鱼 AI 终审：</b>${ending.bigfishLine}</div>
        <div style="color:#cbe2f0">${ending.verdict}</div>
        <div style="margin-top:8px;font-size:12px;color:#7ef6ff"><b>结局图鉴 (${rb.endingsUnlocked.length}/3)：</b>${unlocked}</div>
      </div>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        <button type="button" class="btn-primary" id="end-reboot">↺ 再启一世（挑战其他结局）</button>
        <button type="button" class="btn-primary cyan" id="end-free">🌴 自由闯荡 8 大街区</button>
        <button type="button" class="btn-secondary" id="end-reset">🗑 重置全新存档</button>
      </div>`;
    $('end-reboot').onclick = () => onReboot?.();
    $('end-free').onclick = () => onFree?.();
    $('end-reset').onclick = () => onReset?.();
  }

  result(lines, dur = 5, title = '街区任务结算') {
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

  laughPop(on) {
    const el = $('laughpop');
    if (on) { el.classList.remove('on'); void el.offsetWidth; }
    el.classList.toggle('on', on);
  }

  skip(on) { $('skip').classList.toggle('on', on); }
}

export function loadingTips(tips) {
  const el = $('load-tip');
  let i = Math.floor(Math.random() * tips.length);
  el.textContent = tips[i];
  return setInterval(() => { i = (i + 1) % tips.length; el.textContent = tips[i]; }, 3200);
}
