// 室外环境：天空、太阳、星星、雾、海、环境反射，按时间推进
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { Water } from 'three/addons/objects/Water.js';
import { pbr } from './textures.js';
import { clamp, lerp, smooth } from '../core/util.js';

/**
 * 室外环境：两套 Sky（一套上屏、一套烘环境反射）、太阳/月亮/半球光、星星、雾、海面，
 * 按 this.hour（小时）推进昼夜，并定期重烘 PMREM 环境贴图。
 */
export class Environment {
  /**
   * @param {import('./pipeline.js').Pipeline} pipe 渲染管线（要用它的 renderer / pmrem）
   * @param {THREE.Scene} scene 主场景
   */
  constructor(pipe, scene) {
    this.pipe = pipe; this.scene = scene;
    this.sky = new Sky(); this.sky.scale.setScalar(5000);
    scene.add(this.sky);
    this.envSky = new Sky(); this.envSky.scale.setScalar(5000);
    this.envScene = new THREE.Scene(); this.envScene.add(this.envSky);
    for (const s of [this.sky, this.envSky]) {
      const u = s.material.uniforms;
      u.turbidity.value = 4; u.rayleigh.value = 1.8; u.mieCoefficient.value = 0.0025; u.mieDirectionalG.value = 0.78;
      u.cloudCoverage.value = 0.56; u.cloudDensity.value = 0.68; u.cloudScale.value = 0.00062;
      // 将晚霞混入天空散射和云底，两套天空同步参与物体反射。
      s.material.fragmentShader = s.material.fragmentShader.replace('// Clouds', `
        float dusk = (1.0 - smoothstep(.05,.32,abs(vSunDirection.y))) * smoothstep(-.19,-.03,vSunDirection.y);
        float altitude = smoothstep(0.0,.82,max(direction.y,0.0));
        vec3 afterglow = mix(vec3(1.02,.40,.22),vec3(.17,.22,.49),sqrt(altitude));
        texColor = mix(texColor,afterglow,.79*dusk);
        // Clouds`).replace('texColor = mix( texColor, cloudAerial, alpha );', `
        cloudAerial = mix(cloudAerial, mix(vec3(.33,.18,.30),vec3(1.45,.61,.32),clamp(1.0-depth*3.6,0.0,1.0)), dusk*.9);
        texColor = mix(texColor,cloudAerial,alpha);`);
    }
    this.envSky.material.uniforms.showSunDisc.value = 0;
    this.sky.material.uniforms.showSunDisc.value = 0;
    // 压住太阳附近的天空亮度，否则黄昏迎着太阳会整屏发白
    this.sky.material.fragmentShader = this.sky.material.fragmentShader.replace(
      'gl_FragColor = vec4( texColor, 1.0 );',
      'texColor = texColor / (1.0 + max(dot(texColor, vec3(0.33)) - 0.6, 0.0) * 1.5); gl_FragColor = vec4( texColor, 1.0 );');
    // 太阳用一个不太亮的圆片，避免辉光把整屏吃白
    this.sunDisc = new THREE.Mesh(new THREE.CircleGeometry(40, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.2, 1.3), fog: false, depthWrite: false }));
    scene.add(this.sunDisc);

    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -80; sc.right = 80; sc.top = 80; sc.bottom = -80; sc.near = 1; sc.far = 600;
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.04;
    scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x6b5136, 0.5);
    scene.add(this.hemi);
    this.moon = new THREE.DirectionalLight(0x8fa8ff, 0);
    this.moon.position.set(-200, 300, 100);
    scene.add(this.moon);

    scene.fog = new THREE.FogExp2(0xd9a777, 0.0016);

    // 星星
    const N = 2500, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 0.95);
      pos[i * 3] = Math.sin(ph) * Math.cos(th) * 3000; pos[i * 3 + 1] = Math.cos(ph) * 3000; pos[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * 3000;
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
    scene.add(new THREE.Points(sg, this.starMat));

    // 海
    const wn = pbr('water').normalMap; wn.repeat.set(1, 1);
    this.water = new Water(new THREE.PlaneGeometry(6000, 6000), {
      textureWidth: 512, textureHeight: 512, waterNormals: wn,
      sunDirection: new THREE.Vector3(), sunColor: 0xffe2b0, waterColor: 0x0a3442, distortionScale: 2.6, fog: true,
    });
    this.water.rotation.x = -Math.PI / 2; this.water.position.y = -0.6;
    this.water.material.uniforms.size.value = 3.0;
    scene.add(this.water);

    this.hour = 18.2; // 黄昏
    this.speed = 0;   // 每秒前进多少小时
    this.night = 0;
    this.lastEnvHour = -99;
    this.neon = [];   // { mat, base }
    this.windows = [];
    this.sunDir = new THREE.Vector3();
    this.envRT = null;
    this.apply(true);
  }

  /**
   * 按 this.hour 重算太阳方向、光色、雾、海面、霓虹与窗户亮度；必要时重烘环境贴图。
   * @param {boolean} [forceEnv] 强制重烘 PMREM 环境贴图
   * @returns {void}
   */
  apply(forceEnv = false) {
    // 太阳高度：6 点升起，18.8 点落下
    const h = this.hour;
    const dayT = (h - 6) / 12.8;
    const elev = Math.sin(clamp(dayT, -0.3, 1.3) * Math.PI) * 62 * Math.PI / 180;
    const azim = THREE.MathUtils.degToRad(90 + dayT * 180); // 早上在东，黄昏在西
    this.sunDir.set(Math.cos(elev) * Math.sin(azim), Math.sin(elev), Math.cos(elev) * Math.cos(azim)).normalize();
    for (const s of [this.sky, this.envSky]) s.material.uniforms.sunPosition.value.copy(this.sunDir);
    const e = this.sunDir.y;
    this.night = smooth(0.02, -0.12, e);
    const golden = 1 - smooth(0.05, 0.35, e);
    const sunCol = new THREE.Color().setRGB(1, lerp(0.95, 0.62, golden), lerp(0.9, 0.38, golden));
    this.sun.color.copy(sunCol);
    this.sun.intensity = lerp(3.4, 2.6, golden) * (1 - this.night) * smooth(-0.03, 0.04, e);
    this.hemi.intensity = lerp(0.55, 0.35, this.night);
    this.hemi.color.set(this.night > 0.5 ? 0x34406a : 0xbfd8ff);
    this.moon.intensity = this.night * 1.1;
    this.starMat.opacity = this.night;
    const fogDay = new THREE.Color(0xc9d8e8), fogGold = new THREE.Color(0xe9a58c), fogNight = new THREE.Color(0x0d1426);
    const fc = fogDay.clone().lerp(fogGold, golden).lerp(fogNight, this.night);
    this.scene.fog.color.copy(fc);
    this.scene.fog.density = lerp(0.0015, 0.0025, this.night);
    this.water.material.uniforms.sunDirection.value.copy(this.sunDir);
    this.water.material.uniforms.sunColor.value.copy(sunCol).multiplyScalar(1 - this.night);
    this.pipe.renderer.toneMappingExposure = lerp(0.82, 1.0, this.night) * lerp(1.0, 0.82, smooth(0.2, 0.75, this.sunDir.y));
    for (const n of this.neon) n.mat.color.copy(n.base).multiplyScalar(lerp(0.86, 1.10, this.night));
    for (const m of this.windows) m.emissiveIntensity = lerp(0.035, 0.80, smooth(0.0, 0.7, this.night + golden * 0.25));
    if (forceEnv || Math.abs(this.hour - this.lastEnvHour) > 0.15) {
      if (this.envRT) this.envRT.dispose();
      this.envRT = this.pipe.pmrem.fromScene(this.envScene, 0, 0.1, 6000);
      this.scene.environment = this.envRT.texture;
      // 正午太阳高、环境反射最亮，直接按 0.75 会把雪地、浅色路面照到纯白；随太阳高度压低
      const highSun = smooth(0.18, 0.75, this.sunDir.y);
      this.scene.environmentIntensity = lerp(0.75, 0.5, this.night) * lerp(1.0, 0.22, highSun);
      this.lastEnvHour = this.hour;
    }
  }

  /**
   * 每帧推进时间、海面与天空动画，并让阴影相机跟着焦点走。
   * @param {number} dt 帧间隔（秒）
   * @param {THREE.Vector3} focus 焦点（一般是玩家位置）
   * @returns {void}
   */
  update(dt, focus) {
    if (this.speed) { this.hour += this.speed * dt; this.apply(); }
    this.water.material.uniforms.time.value += dt * 0.6;
    this.sky.material.uniforms.time.value += dt;
    // 阴影相机跟着玩家走
    this.sun.position.copy(focus).addScaledVector(this.sunDir, 300);
    this.sun.target.position.copy(focus);
    this.sunDisc.position.copy(focus).addScaledVector(this.sunDir, 3000);
    this.sunDisc.lookAt(focus);
    this.sunDisc.visible = this.sunDir.y > -0.05;
  }
}
