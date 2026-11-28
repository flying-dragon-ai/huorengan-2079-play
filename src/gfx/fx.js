// 粒子：烟花、尘土、彩带；冲击波；头顶气泡字
import * as THREE from 'three';
import { makeCanvas } from '../core/util.js';

/**
 * GPU 粒子池：烟花、尘土、彩带。固定容量，死掉的粒子用尾部覆盖压缩。
 */
export class Particles {
  /**
   * @param {THREE.Scene} scene 主场景
   * @param {number} [max] 粒子池容量，默认 6000
   */
  constructor(scene, max = 6000) {
    this.max = max; this.n = 0;
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3); this.size = new Float32Array(max); this.alpha = new Float32Array(max);
    this.vel = new Float32Array(max * 3); this.life = new Float32Array(max); this.maxLife = new Float32Array(max); this.drag = new Float32Array(max); this.grav = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vC; varying float vA;
        void main(){ vC=color; vA=alpha; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=size*600.0/-mv.z; gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `varying vec3 vC; varying float vA; void main(){ float d=length(gl_PointCoord-0.5); if(d>0.5) discard; float a=smoothstep(0.5,0.0,d); gl_FragColor=vec4(vC*a*vA, a*vA); }`,
    });
    this.points = new THREE.Points(g, m); this.points.frustumCulled = false;
    scene.add(this.points);
  }

  /**
   * 发一个粒子。
   * @param {THREE.Vector3} p 位置
   * @param {THREE.Vector3} v 初速度
   * @param {THREE.Color} color 颜色
   * @param {{life?: number, size?: number, drag?: number, grav?: number}} [opts] 寿命 / 大小 / 阻力 / 重力
   * @returns {void}
   */
  emit(p, v, color, { life = 1.5, size = 0.5, drag = 0.5, grav = 9 } = {}) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.pos.set([p.x, p.y, p.z], i * 3); this.vel.set([v.x, v.y, v.z], i * 3);
    this.col.set([color.r, color.g, color.b], i * 3);
    this.size[i] = size; this.life[i] = life; this.maxLife[i] = life; this.drag[i] = drag; this.grav[i] = grav; this.alpha[i] = 1;
  }

  /**
   * 一发烟花（260 颗，两种色相）。
   * @param {THREE.Vector3} p 爆心
   * @param {number} [hue] 色相 0..1，默认随机
   * @returns {void}
   */
  firework(p, hue = Math.random()) {
    const c = new THREE.Color().setHSL(hue, 1, 0.6).multiplyScalar(6);
    const c2 = new THREE.Color().setHSL((hue + 0.1) % 1, 1, 0.7).multiplyScalar(5);
    const v = new THREE.Vector3();
    for (let i = 0; i < 260; i++) {
      v.randomDirection().multiplyScalar(18 + Math.random() * 10);
      this.emit(p, v, i % 3 ? c : c2, { life: 1.6 + Math.random() * 0.8, size: 1.1, drag: 1.2, grav: 6 });
    }
  }

  /**
   * 一团尘土。
   * @param {THREE.Vector3} p 中心
   * @param {number} [n] 粒子数，默认 20
   * @param {THREE.Color} [color] 颜色
   * @param {number} [spread] 扩散半径
   * @returns {void}
   */
  puff(p, n = 20, color = new THREE.Color(0.9, 0.8, 0.65), spread = 4) {
    const v = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      v.set((Math.random() - 0.5) * spread, Math.random() * spread * 0.6, (Math.random() - 0.5) * spread);
      this.emit(p, v, color, { life: 0.8 + Math.random() * 0.6, size: 0.6 + Math.random() * 0.6, drag: 2.5, grav: -0.5 });
    }
  }

  /**
   * 一把彩带。
   * @param {THREE.Vector3} p 中心
   * @param {number} [n] 粒子数，默认 120
   * @returns {void}
   */
  confetti(p, n = 120) {
    const v = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      v.set((Math.random() - 0.5) * 10, 8 + Math.random() * 10, (Math.random() - 0.5) * 10);
      this.emit(p, v, new THREE.Color().setHSL(Math.random(), 1, 0.6).multiplyScalar(2.5), { life: 2.5, size: 0.35, drag: 1.5, grav: 7 });
    }
  }

  /** 推进所有粒子：寿命、阻力、重力、压缩存活区，并上传属性。 @param {number} dt 帧间隔（秒） @returns {void} */
  update(dt) {
    let j = 0;
    for (let i = 0; i < this.n; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) continue;
      if (j !== i) {
        this.pos.copyWithin(j * 3, i * 3, i * 3 + 3); this.vel.copyWithin(j * 3, i * 3, i * 3 + 3); this.col.copyWithin(j * 3, i * 3, i * 3 + 3);
        this.size[j] = this.size[i]; this.life[j] = this.life[i]; this.maxLife[j] = this.maxLife[i]; this.drag[j] = this.drag[i]; this.grav[j] = this.grav[i];
      }
      const k = Math.exp(-this.drag[j] * dt);
      this.vel[j * 3] *= k; this.vel[j * 3 + 1] = this.vel[j * 3 + 1] * k - this.grav[j] * dt; this.vel[j * 3 + 2] *= k;
      this.pos[j * 3] += this.vel[j * 3] * dt; this.pos[j * 3 + 1] += this.vel[j * 3 + 1] * dt; this.pos[j * 3 + 2] += this.vel[j * 3 + 2] * dt;
      this.alpha[j] = Math.min(1, this.life[j] / (this.maxLife[j] * 0.5));
      j++;
    }
    this.n = j;
    const g = this.points.geometry;
    g.setDrawRange(0, j);
    for (const a of ['position', 'color', 'size', 'alpha']) g.attributes[a].needsUpdate = true;
  }
}

/**
 * 地面冲击波环：生成后 1.2 秒内扩大并淡出。
 */
export class Shockwaves {
  /** @param {THREE.Scene} scene 主场景 */
  constructor(scene) { this.scene = scene; this.list = []; }
  /**
   * 在一点生成一个冲击波环。
   * @param {THREE.Vector3} p 中心
   * @param {number} [maxR] 最大半径（米），默认 40
   * @param {THREE.Color} [color] 颜色
   * @returns {void}
   */
  spawn(p, maxR = 40, color = new THREE.Color(1.5, 2.5, 3)) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 96), new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.rotation.x = -Math.PI / 2; m.position.copy(p).setY(p.y + 0.3);
    this.scene.add(m); this.list.push({ m, t: 0, maxR });
  }
  /** 推进所有冲击波，放完的摘掉并释放几何体。 @param {number} dt 帧间隔（秒） @returns {void} */
  update(dt) {
    this.list = this.list.filter((s) => {
      s.t += dt; const k = s.t / 1.2;
      s.m.scale.setScalar(1 + k * s.maxR); s.m.material.opacity = 1 - k;
      if (k >= 1) { this.scene.remove(s.m); s.m.geometry.dispose(); return false; }
      return true;
    });
  }
}

// 头顶气泡字
/**
 * 头顶气泡字：一张画好字的 Sprite，字多会自动缩小。
 * @param {string} text 文字
 * @param {string} [color] 文字颜色，默认 '#fff'
 * @returns {THREE.Sprite} 气泡精灵
 */
export function bubble(text, color = '#fff') {
  const [c, x] = makeCanvas(512, 128);
  // 字多就把字缩小，整句都放得下
  let size = 54;
  x.font = `800 ${size}px "PingFang SC", sans-serif`;
  const tw = x.measureText(text).width;
  if (tw > 450) { size = Math.max(26, Math.floor(size * 450 / tw)); x.font = `800 ${size}px "PingFang SC", sans-serif`; }
  const w = Math.min(500, x.measureText(text).width + 50);
  x.fillStyle = 'rgba(255,255,255,0.95)';
  x.beginPath(); x.roundRect((512 - w) / 2, 8, w, 96, 40); x.fill();
  x.fillStyle = '#111'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 256, 58);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(4, 1, 1); s.renderOrder = 10;
  return s;
}
