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

/**
 * 渲染管线：WebGLRenderer + EffectComposer（RenderPass → Sanitize → Bloom → Output → Grade）。
 * 负责分辨率/像素比、镜头抖动，以及调色 uniforms 的每帧写入。
 */
export class Pipeline {
  /** @param {HTMLCanvasElement} canvas 画布 */
  constructor(canvas) {
    const r = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.setSize(innerWidth, innerHeight);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    this.renderer = r;
    this.pmrem = new THREE.PMREMGenerator(r);
    this.camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 6000);
    this.scene = null;

    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(r, rt);
    this.renderPass = new RenderPass(null, this.camera);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.4, 0.6, 1.35);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(new ShaderPass(SanitizeShader));
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.composer.addPass(this.grade);
    this.shake = 0;
    addEventListener('resize', () => this.resize());
    this.resize();
  }

  /** 调色 shader 的 uniforms（uTime / uRes / uLow / uReveal / uPix / uSat / uVig / uGrain / uCA / uFlash / uLetter / uWarm）。 @returns {Record<string, {value: any}>} */
  get g() { return this.grade.uniforms; }

  /** 按窗口大小重设像素比、渲染尺寸、相机宽高比与调色分辨率。 @returns {void} */
  resize() {
    const w = innerWidth, h = innerHeight;
    // 最多按约 1440p 的像素量渲染：4K 屏也能稳住帧率
    const pr = Math.min(window.devicePixelRatio, 1.5, Math.sqrt((1920 * 1080) / (w * h)));
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.g.uRes.value.set(w * pr, h * pr);
    this.g.uPix.value = Math.max(2, (h * pr) / 360);
  }

  /** 换场景。 @param {THREE.Scene} scene 主场景 @returns {void} */
  setScene(scene) { this.scene = scene; this.renderPass.scene = scene; }

  /**
   * 渲染一帧。
   * @param {number} dt 帧间隔（秒）
   * @param {number} t 全局时间（秒），写进 uTime 做颗粒动画
   * @returns {void}
   */
  render(dt, t) {
    this.g.uTime.value = t;
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
