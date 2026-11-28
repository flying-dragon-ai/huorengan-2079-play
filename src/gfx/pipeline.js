// 渲染管线：HDR、ACES、阴影、天空、环境反射、海、后期、调色
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SanitizeShader, GradeShader } from './shaders.js';
import { Environment as EnvironmentClass } from './environment.js';

// 防黑屏一：粗糙度太低时，太阳在光滑表面（电驴车漆、湿路面、水池）上的高光会超过半精度浮点的上限 65504，
// 变成无穷大；辉光一糊、色调映射一算就成了 NaN，画面会突然黑掉一大块。所以统一把粗糙度下限抬到 0.1
THREE.ShaderChunk.roughnessmap_fragment += '\nroughnessFactor = max( roughnessFactor, 0.1 );';

export const PERF_TIERS = {
  eco: { label: '省电', maxPr: 0.85, bloom: false, shadows: false, fpsCap: 45 },
  balanced: { label: '均衡', maxPr: 1.0, bloom: true, shadows: true, fpsCap: 60 },
  high: { label: '高清', maxPr: 1.4, bloom: true, shadows: true, fpsCap: 60 },
};

/**
 * 渲染管线：WebGLRenderer + EffectComposer（RenderPass → Sanitize → Bloom → Output → Grade）。
 * 负责分辨率/像素比、性能档位（控制 CPU/GPU 占用）、镜头抖动，以及调色 uniforms 的每帧写入。
 */
export class Pipeline {
  /** @param {HTMLCanvasElement} canvas 画布 */
  constructor(canvas) {
    const r = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'default' });
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.shadowMap.autoUpdate = false;
    r.shadowMap.needsUpdate = true;
    this.renderer = r;
    this.pmrem = new THREE.PMREMGenerator(r);
    this.camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.25, 4500);
    this.scene = null;
    this.tier = 'balanced';

    // 取消 4x MSAA HalfFloat 离屏采样，改用低功耗 RT + 半分辨率辉光，显存带宽与 GPU 发热直降一半以上
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 0 });
    this.composer = new EffectComposer(r, rt);
    this.renderPass = new RenderPass(null, this.camera);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(Math.max(1, innerWidth >> 1), Math.max(1, innerHeight >> 1)), 0.32, 0.55, 1.35);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(new ShaderPass(SanitizeShader));
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.composer.addPass(this.grade);
    this.shake = 0;
    this._resizeTimer = 0;
    addEventListener('resize', () => {
      clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(() => this.resize(), 80);
    });
    this.resize();
  }

  /** 切换性能档位：eco（省电）/ balanced（均衡，默认）/ high（高清）。 */
  setTier(tier) {
    if (!PERF_TIERS[tier]) return;
    this.tier = tier;
    const cfg = PERF_TIERS[tier];
    this.bloom.enabled = cfg.bloom;
    this.renderer.shadowMap.enabled = cfg.shadows;
    this.renderer.shadowMap.needsUpdate = cfg.shadows;
    this.resize();
  }

  /** 循环切换性能档位并返回新档位信息。 */
  cycleTier() {
    const order = ['balanced', 'eco', 'high'];
    const next = order[(order.indexOf(this.tier) + 1) % order.length];
    this.setTier(next);
    return PERF_TIERS[next];
  }

  /** 调色 shader 的 uniforms（uTime / uRes / uLow / uReveal / uPix / uSat / uVig / uGrain / uCA / uFlash / uLetter / uWarm / uDesat / uGlitch）。 @returns {Record<string, {value: any}>} */
  get g() { return this.grade.uniforms; }

  /** 按窗口大小与当前性能档位重设像素比、渲染尺寸、相机宽高比与调色分辨率。 @returns {void} */
  resize() {
    const w = innerWidth, h = innerHeight;
    const cfg = PERF_TIERS[this.tier] || PERF_TIERS.balanced;
    const pr = Math.min(window.devicePixelRatio || 1, cfg.maxPr, Math.sqrt((1600 * 900) / Math.max(1, w * h)));
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    this.bloom.setSize(Math.max(1, Math.floor((w * pr) / 2)), Math.max(1, Math.floor((h * pr) / 2)));
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.g.uRes.value.set(w * pr, h * pr);
    this.g.uPix.value = Math.max(2, (h * pr) / 360);
  }

  /** 换场景。 @param {THREE.Scene} scene 主场景 @returns {void} */
  setScene(scene) { this.scene = scene; this.renderPass.scene = scene; this.renderer.shadowMap.needsUpdate = true; }

  /**
   * 渲染一帧。
   * @param {number} dt 帧间隔（秒）
   * @param {number} t 全局时间（秒），写进 uTime 做颗粒动画
   * @returns {void}
   */
  render(dt, t) {
    this.g.uTime.value = t;
    const cfg = PERF_TIERS[this.tier] || PERF_TIERS.balanced;
    this.bloom.enabled = cfg.bloom && this.bloom.strength > 0.02;
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2.5);
      const s = this.shake * this.shake * 0.6;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
    }
    this.composer.render(dt);
  }
}

/**
 * 室外环境。类本体在 ./environment.js，这里原样再导出（同一个类，不是副本），
 * 保证 `import { Pipeline, Environment } from '../gfx/pipeline.js'` 继续可用。
 * @type {typeof import('./environment.js').Environment}
 */
export const Environment = EnvironmentClass;
