// 室外环境：天空、太阳、星星、雾、轻量化单通道海面、环境反射，按时间与重启代价推进
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { clamp, lerp, smooth } from '../core/util.js';

/** 轻量化单通道海面着色器：无平面二次渲染，GPU 占用骤降同时保留波纹高光与地平线反射。 */
function createLiteWater() {
  const uniforms = {
    time: { value: 0 },
    sunDirection: { value: new THREE.Vector3(0, 0.4, -1) },
    sunColor: { value: new THREE.Color(0xffe2b0) },
    waterColor: { value: new THREE.Color(0x0c3c4f) },
    skyColor: { value: new THREE.Color(0xd9a777) },
    fogColor: { value: new THREE.Color(0xd9a777) },
    fogDensity: { value: 0.0016 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform float time, fogDensity;
      uniform vec3 sunDirection, sunColor, waterColor, skyColor, fogColor;
      varying vec3 vWorldPos;
      void main() {
        vec2 p = vWorldPos.xz * 0.045;
        float w1 = sin(p.x * 2.1 + time * 1.4) * cos(p.y * 1.7 - time * 1.1);
        float w2 = sin((p.x - p.y) * 3.3 - time * 1.8) * 0.5;
        vec3 n = normalize(vec3((w1 + w2) * 0.12, 1.0, (w1 - w2) * 0.12));
        vec3 v = normalize(cameraPosition - vWorldPos);
        float fresnel = pow(1.0 - max(dot(v, n), 0.0), 3.2);
        vec3 h = normalize(normalize(sunDirection) + v);
        float spec = pow(max(dot(n, h), 0.0), 96.0) * 1.4;
        float dist = length(cameraPosition - vWorldPos);
        vec3 base = mix(waterColor, skyColor * 0.85, clamp(fresnel * 0.85, 0.0, 0.9));
        base += sunColor * spec;
        float fogF = 1.0 - exp(-fogDensity * fogDensity * dist * dist);
        vec3 col = mix(base, fogColor, clamp(fogF, 0.0, 1.0));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(5200, 5200, 1, 1), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -0.6;
  return mesh;
}

/**
 * 室外环境：两套 Sky（一套上屏、一套烘环境反射）、太阳/月亮/半球光、星星、雾、单通道海面，
 * 按 this.hour（小时）推进昼夜，并定期重烘 PMREM 环境贴图。
 */
export class Environment {
  /**
   * @param {import('./pipeline.js').Pipeline} pipe 渲染管线（要用它的 renderer / pmrem）
   * @param {THREE.Scene} scene 主场景
   */
  constructor(pipe, scene) {
    this.pipe = pipe; this.scene = scene;
    this.sky = new Sky(); this.sky.scale.setScalar(4200);
    scene.add(this.sky);
    this.envSky = new Sky(); this.envSky.scale.setScalar(4200);
    this.envScene = new THREE.Scene(); this.envScene.add(this.envSky);
    for (const s of [this.sky, this.envSky]) {
      const u = s.material.uniforms;
      u.turbidity.value = 4; u.rayleigh.value = 1.8; u.mieCoefficient.value = 0.0025; u.mieDirectionalG.value = 0.78;
      // 关掉昂贵的逐像素体积云射线步进，场景里已有轻量化云朵精灵
      if (u.cloudCoverage) u.cloudCoverage.value = 0;
      if (u.cloudDensity) u.cloudDensity.value = 0;
      s.material.fragmentShader = s.material.fragmentShader.replace('// Clouds', `
        float dusk = (1.0 - smoothstep(.05,.32,abs(vSunDirection.y))) * smoothstep(-.19,-.03,vSunDirection.y);
        float altitude = smoothstep(0.0,.82,max(direction.y,0.0));
        vec3 afterglow = mix(vec3(1.02,.40,.22),vec3(.17,.22,.49),sqrt(altitude));
        texColor = mix(texColor,afterglow,.79*dusk);
        // Clouds`);
    }
    this.envSky.material.uniforms.showSunDisc.value = 0;
    this.sky.material.uniforms.showSunDisc.value = 0;
    this.sky.material.fragmentShader = this.sky.material.fragmentShader.replace(
      'gl_FragColor = vec4( texColor, 1.0 );',
      'texColor = texColor / (1.0 + max(dot(texColor, vec3(0.33)) - 0.6, 0.0) * 1.5); gl_FragColor = vec4( texColor, 1.0 );');
    this.sunDisc = new THREE.Mesh(new THREE.CircleGeometry(40, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.0, 1.2), fog: false, depthWrite: false }));
    scene.add(this.sunDisc);

    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    const sc = this.sun.shadow.camera;
    sc.left = -58; sc.right = 58; sc.top = 58; sc.bottom = -58; sc.near = 10; sc.far = 480;
    this.sun.shadow.bias = -0.0005; this.sun.shadow.normalBias = 0.04;
    scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x6b5136, 0.5);
    scene.add(this.hemi);
    this.moon = new THREE.DirectionalLight(0x8fa8ff, 0);
    this.moon.position.set(-200, 300, 100);
    scene.add(this.moon);

    scene.fog = new THREE.FogExp2(0xd9a777, 0.0016);

    // 星星（减量至 1200 颗，夜空效果一致且省顶点）
    const N = 1200, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 0.95);
      pos[i * 3] = Math.sin(ph) * Math.cos(th) * 2800; pos[i * 3 + 1] = Math.cos(ph) * 2800; pos[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * 2800;
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2.0, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
    scene.add(new THREE.Points(sg, this.starMat));

    // 单通道轻量化海面（避免 THREE.Water 每帧重复渲染整座岛）
    this.water = createLiteWater();
    scene.add(this.water);

    this.hour = 18.2; // 黄昏
    this.speed = 0;
    this.night = 0;
    this.coldMode = 0; // 抵押「色彩与天气」后的冰冷算力模式（0..1）
    this.lastEnvHour = -99;
    this.neon = [];
    this.windows = [];
    this.sunDir = new THREE.Vector3();
    this.envRT = null;
    this._lastShadowPos = new THREE.Vector3(9999, 0, 9999);
    this._shadowFrame = 0;
    this.apply(true);
  }

  /**
   * 按 this.hour 重算太阳方向、光色、雾、海面、霓虹与窗户亮度；必要时重烘环境贴图。
   * @param {boolean} [forceEnv] 强制重烘 PMREM 环境贴图
   * @returns {void}
   */
  apply(forceEnv = false) {
    const h = this.hour;
    const dayT = (h - 6) / 12.8;
    const elev = Math.sin(clamp(dayT, -0.3, 1.3) * Math.PI) * 62 * Math.PI / 180;
    const azim = THREE.MathUtils.degToRad(90 + dayT * 180);
    this.sunDir.set(Math.cos(elev) * Math.sin(azim), Math.sin(elev), Math.cos(elev) * Math.cos(azim)).normalize();
    for (const s of [this.sky, this.envSky]) s.material.uniforms.sunPosition.value.copy(this.sunDir);
    const e = this.sunDir.y;
    this.night = smooth(0.02, -0.12, e);
    const golden = (1 - smooth(0.05, 0.35, e)) * (1 - this.coldMode);
    const sunCol = new THREE.Color().setRGB(
      lerp(1, 0.78, this.coldMode),
      lerp(lerp(0.95, 0.62, golden), 0.88, this.coldMode),
      lerp(lerp(0.9, 0.38, golden), 0.98, this.coldMode),
    );
    this.sun.color.copy(sunCol);
    this.sun.intensity = lerp(3.2, 2.5, golden) * (1 - this.night) * smooth(-0.03, 0.04, e);
    this.hemi.intensity = lerp(0.55, 0.38, this.night);
    this.hemi.color.set(this.coldMode > 0.5 ? 0x8fb4d0 : this.night > 0.5 ? 0x34406a : 0xbfd8ff);
    this.moon.intensity = this.night * 1.1;
    this.starMat.opacity = this.night * (1 - this.coldMode * 0.85);
    const fogDay = new THREE.Color(0xc9d8e8), fogGold = new THREE.Color(0xe9a58c), fogNight = new THREE.Color(0x0d1426), fogCold = new THREE.Color(0x526474);
    const fc = fogDay.clone().lerp(fogGold, golden).lerp(fogNight, this.night).lerp(fogCold, this.coldMode * 0.85);
    this.scene.fog.color.copy(fc);
    this.scene.fog.density = lerp(0.0015, 0.0024, Math.max(this.night, this.coldMode * 0.5));
    const wu = this.water.material.uniforms;
    wu.sunDirection.value.copy(this.sunDir);
    wu.sunColor.value.copy(sunCol).multiplyScalar(1 - this.night);
    wu.skyColor.value.copy(fc);
    wu.fogColor.value.copy(fc);
    wu.fogDensity.value = this.scene.fog.density;
    wu.waterColor.value.set(this.coldMode > 0.5 ? 0x1e2c36 : 0x0a3442);
    this.pipe.renderer.toneMappingExposure = lerp(0.84, 1.0, this.night) * lerp(1.0, 0.84, smooth(0.2, 0.75, this.sunDir.y));
    for (const n of this.neon) n.mat.color.copy(n.base).multiplyScalar(lerp(0.86, 1.10, this.night));
    for (const m of this.windows) m.emissiveIntensity = lerp(0.035, 0.80, smooth(0.0, 0.7, this.night + golden * 0.25));
    if (forceEnv || Math.abs(this.hour - this.lastEnvHour) > 0.25) {
      if (this.envRT) this.envRT.dispose();
      this.envRT = this.pipe.pmrem.fromScene(this.envScene, 0, 0.1, 4200);
      this.scene.environment = this.envRT.texture;
      const highSun = smooth(0.18, 0.75, this.sunDir.y);
      this.scene.environmentIntensity = lerp(0.72, 0.48, this.night) * lerp(1.0, 0.22, highSun);
      this.lastEnvHour = this.hour;
    }
    this.pipe.renderer.shadowMap.needsUpdate = true;
  }

  /**
   * 每帧推进时间、海面动画，并按位移节流更新阴影相机。
   * @param {number} dt 帧间隔（秒）
   * @param {THREE.Vector3} focus 焦点（一般是玩家位置）
   * @returns {void}
   */
  update(dt, focus) {
    if (this.speed) { this.hour += this.speed * dt; this.apply(); }
    this.water.material.uniforms.time.value += dt * (1 - this.coldMode * 0.8);
    this.sunDisc.position.copy(focus).addScaledVector(this.sunDir, 2800);
    this.sunDisc.lookAt(focus);
    this.sunDisc.visible = this.sunDir.y > -0.05 && this.coldMode < 0.7;
    // 阴影按需更新：玩家移动超过 0.75m 或每隔 3 帧更新一次，显著省 GPU
    this._shadowFrame = (this._shadowFrame + 1) % 3;
    if (this.pipe.renderer.shadowMap.enabled && (this._shadowFrame === 0 || focus.distanceToSquared(this._lastShadowPos) > 0.56)) {
      this._lastShadowPos.copy(focus);
      this.sun.position.copy(focus).addScaledVector(this.sunDir, 240);
      this.sun.target.position.copy(focus);
      this.sun.target.updateMatrixWorld();
      this.pipe.renderer.shadowMap.needsUpdate = true;
    }
  }
}
