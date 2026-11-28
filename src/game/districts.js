// 街区管理：进街区的大字、只在当地出现的笑点、街区任务（接任务 → 计时 → 结算活人感）
// 每个街区自己是一个组件（src/world/districts/*.js），这里只负责把它们接进游戏流程。
import * as THREE from 'three';
import { questRing, inRect, flat } from '../world/districts/kit.js';
import { bubble } from '../gfx/fx.js';

// 主线在跑计时任务或重启循环时，支线光圈退居幕后（自由闯荡时全部可接）
const MAIN_BUSY = ['pickup', 'deliver', 'order', 'loop'];

export class Districts {
  constructor(game) {
    this.g = game;
    this.list = game.island.districts || [];
    this.here = null; this.active = null; this.done = new Set(); this.tried = new Set();
    this.gags = 0; this.gagSeen = new Set(); this.bubs = [];
    for (const d of this.list) {
      d.ctx = game;
      if (d.quest) { d.ring = questRing(game.world, d.color, d.quest.short || d.quest.title); d.ring.g.position.copy(d.quest.at); }
      d.init?.(game);
    }
  }

  // 主线空着的时候才能接街区任务
  sideOk() {
    const g = this.g;
    return (g.state === 'roam' || g.state === 'free') && !MAIN_BUSY.includes(g.phase) && g.phase !== 'laughing'
      && ['foot', 'bike'].includes(g.player.mode) && !!g.mounted;
  }

  gagFired(id) { this.gags++; this.gagSeen.add(id); }

  // 挂在物体头顶的气泡
  bubble(obj, text, dur = 2.8, y = 2.6) {
    const b = bubble(text); b.position.y = y; obj.add(b); this.bubs.push({ b, obj, t: dur });
  }

  // 把奶蛙（和电驴）一起挪过去
  teleport(x, z, yaw) {
    const g = this.g, p = g.player;
    p.pos.set(x, g.island.heightAt(x, z), z); p.vel.set(0, 0, 0); p.speed = 0; p.vy = 0; p.air = false; p.yaw = yaw;
    if (p.mode === 'bike') p.bike.position.copy(p.pos);
    else { p.bike.position.set(x + Math.cos(yaw) * 2, p.pos.y, z - Math.sin(yaw) * 2); p.bike.rotation.set(0, yaw, 0); }
    g.rig.yaw = yaw; g.rig.init = false;
  }

  update(dt) {
    const g = this.g, p = g.player, t = g.time;
    for (let i = this.bubs.length - 1; i >= 0; i--) { const o = this.bubs[i]; if ((o.t -= dt) <= 0) { o.obj.remove(o.b); o.b.material.map.dispose(); o.b.material.dispose(); this.bubs.splice(i, 1); } }
    const live = (g.state === 'roam' || g.state === 'free') && ['foot', 'bike'].includes(p.mode);
    if (!live) { if (this.active && g.state === 'finale') this.abort(); return; }
    // 进了哪个街区
    const here = this.list.find((d) => inRect(p.pos, d.bounds)) || null;
    if (here !== this.here) {
      this.here = here;
      if (here && !this.active) { g.ui.banner(here.name, here.tagline); g.audio.ding(); here.onEnter?.(g); }
    }
    for (const d of this.list) d.update?.(g, dt, d === here);
    // 任务光圈
    const ok = this.sideOk();
    let hint = '';
    for (const d of this.list) {
      if (!d.ring) continue;
      const show = ok && !this.done.has(d.id) && !this.active;
      d.ring.g.visible = show;
      if (!show) continue;
      d.ring.spin(dt, t);
      const dq = flat(p.pos, d.quest.at);
      d.ring.tag.visible = dq > 9; // 走近了就不挡镜头
      if (dq < 4.5) {
        hint = `按 <b>E</b> 接街区任务：${d.quest.title}（${d.quest.kind}）`;
      }
    }
    if (this.active) {
      const a = this.active, q = a.d.quest;
      a.t -= dt;
      const r = q.update(g, dt, a) || {};
      a.note = r.note || '';
      g.ui.setTimer(a.t);
      if (r.win) this.finish(true);
      else if (a.t <= 0 || r.fail) this.finish(false);
    }
    if (hint) g.ui.setHint(hint);
  }

  // E 键：站在光圈里就接任务。返回 true 表示这次 E 被用掉了
  tryInteract() {
    if (this.active || !this.sideOk()) return false;
    const p = this.g.player;
    const d = this.list.find((d) => d.quest && !this.done.has(d.id) && flat(p.pos, d.quest.at) < 4.5);
    if (!d) return false;
    this.start(d);
    return true;
  }

  start(d) {
    const g = this.g, q = d.quest;
    this.active = { d, t: q.time, note: '', score: 0, startAt: g.time };
    this.tried.add(d.id);
    g.ui.banner(q.title, `${q.kind} · 限时 ${q.time} 秒`);
    g.line(q.intro, 5); g.audio.ding();
    g.ui.objective(q.goal);
    q.start(g, this.active);
  }

  finish(win) {
    const g = this.g, a = this.active, q = a.d.quest;
    this.active = null; g.ui.setTimer(null);
    const lines = q.end(g, win, a) || [];
    const gain = win ? (q.gain || 12) : 4;
    const before = g.meter;
    g.meter = Math.min(100, g.meter + gain); g.ui.setMeter(g.meter);
    const over = before + gain - 100;
    lines.push(`<b>活人感 +${gain}%</b>${over > 0 ? `（溢出 ${over}%，已存进下辈子）` : ''}`);
    if (win) { this.done.add(a.d.id); lines.push(`街区任务 ${this.done.size} / ${this.list.filter((d) => d.quest).length}`); }
    else lines.push('没完成也没关系：失败也算活过（光圈还在，可以再来）');
    g.ui.result(lines, 6, win ? `${a.d.name} · 任务完成` : `${a.d.name} · 任务失败（但很好笑）`);
    g.laugh += win ? 20 : 8;
    if (win) { g.fx.confetti(g.player.pos.clone().setY(3), 160); g.audio.coin(); g.ui.burst(q.cheer || ['活人感涨了', '这任务有毒', '哈哈哈哈'], 6); }
    else { g.audio.crash(); g.ui.burst(['失败也好笑', '再来一次', '已截图', '这也能输'], 5); }
    g.ui.objective(g.phase === 'free' ? '自由闯荡' : g.phase === 'night' ? '夜游地球村，笑点充满后按 Q' : g.phase === 'laughReady' ? '按 Q 捧腹大笑' : '');
  }

  abort() { const a = this.active; this.active = null; this.g.ui.setTimer(null); a.d.quest.end(this.g, false, a); }

  // 导航：有街区任务在做就指它；主线没目标时指最近的没做完的光圈
  navTarget() {
    if (this.active) return this.active.nav || null;
    const g = this.g;
    if (!this.sideOk() || !['night', 'free'].includes(g.phase)) return null;
    const best = this.nearestQuest();
    return best ? { pos: best.quest.at, label: `${best.name} · ${best.quest.short}` } : null;
  }

  nearestQuest() {
    const g = this.g;
    let best = null, bd = 1e9;
    for (const d of this.list) {
      if (!d.quest || this.done.has(d.id)) continue;
      const dd = flat(g.player.pos, d.quest.at);
      if (dd < bd) { bd = dd; best = d; }
    }
    return best;
  }

  // 右边任务列表里的街区任务
  questItems() {
    return this.list.filter((d) => d.quest).map((d) => ({
      id: d.id, t: `${d.name}：${d.quest.short}`, done: this.done.has(d.id), side: true,
      note: this.active && this.active.d === d ? (this.active.note || '') : '',
    }));
  }

  mapAreas() { return this.list.map((d) => [d.name, d.center[0], d.center[1], d.color]); }
  mapMarks() {
    const out = [];
    for (const d of this.list) {
      if (d.quest && !this.done.has(d.id)) out.push({ x: d.quest.at.x, z: d.quest.at.z, color: d.color, r: 7, label: d.quest.short });
      for (const m of d.marks || []) out.push(m);
    }
    return out;
  }
}

// 开发用：?dev=1 时 __game.dev.jump(x, z) 直接跳过开场，骑着电驴站在 (x,z)
export function devTools(game) {
  return {
    jump(x = 0, z = 50, phase = 'free', yaw = Math.PI) {
      const g = game, p = g.player;
      g.tl.clear?.();
      document.getElementById('title').classList.add('off');
      document.getElementById('cards').classList.remove('on');
      g.audio.start?.();
      g.pipe.setScene(g.world); g.pipe.g.uLetter.value = 0; g.pipe.g.uLow.value = 0; g.upT = 0;
      g.state = phase === 'free' ? 'free' : 'roam'; g.phase = phase; g.mounted = true;
      g.ui.showHud(true); g.ui.setQuality('画质：全特效'); g.meter = 60; g.ui.setMeter(60);
      g.ui.objective(phase === 'free' ? '自由闯荡' : '');
      p.root.visible = true; p.mode = 'bike';
      g.districts.teleport(x, z, yaw);
      for (const id of ['dive', 'walk', 'look', 'jump', 'mount', 'ride', 'nav', 'map', 'stack', 'race', 'wanted', 'laugh', 'q']) g.guide.finished.add(id);
      return 'ok';
    },
    // 让电驴自己骑向某个点（测试用）
    ride(x, z) { game.devVirt = x == null ? null : { target: new THREE.Vector3(x, 0, z) }; },
    tp(x, z, yaw = 0) { game.districts.teleport(x, z, yaw); },
  };
}
