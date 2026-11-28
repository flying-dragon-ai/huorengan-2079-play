// 环境氛围组件：天空、太阳、雾、环境反射、时间切换
import * as THREE from 'three';

/**
 * 构建环境氛围：天空穹顶、太阳/半球/月光、指数雾、星空与 PMREM 环境反射，
 * 并返回时间预设切换接口。所有对象直接挂到传入的 scene 上。
 * @param {THREE.Scene} scene 主场景
 * @param {THREE.WebGLRenderer} renderer 渲染器，用于生成 PMREM 环境贴图与设置曝光
 * @returns {{ apply: (name: string) => void, names: string[] }} apply 切换到指定时间预设（未知名称回落到 golden），names 可用预设名列表
 */
export function buildEnvironment(scene, renderer) {
  // 天空穹顶（渐变 + 太阳附近的暖色）
  const skyGeo = new THREE.SphereGeometry(2000, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x2a4a7a) },
      bottomColor: { value: new THREE.Color(0xe9a58c) },
      sunDir: { value: new THREE.Vector3(0.5, 0.3, 0.5) },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform vec3 topColor, bottomColor, sunDir;
      varying vec3 vDir;
      void main(){
        float h = max(vDir.y, 0.0);
        vec3 c = mix(bottomColor, topColor, pow(h, 0.55));
        float sun = pow(max(dot(normalize(vDir), normalize(sunDir)), 0.0), 24.0);
        c += vec3(1.0, 0.6, 0.3) * sun * 0.6;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat); scene.add(sky);

  const sun = new THREE.DirectionalLight(0xffe2c0, 2.8);
  sun.position.set(120, 180, 80);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -200; sun.shadow.camera.right = 200;
  sun.shadow.camera.top = 200; sun.shadow.camera.bottom = -200;
  sun.shadow.camera.far = 600;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05;
  scene.add(sun, sun.target);

  const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x6b5136, 0.55); scene.add(hemi);
  const moon = new THREE.DirectionalLight(0x8fa8ff, 0); moon.position.set(-150, 200, 100); scene.add(moon);

  scene.fog = new THREE.FogExp2(0xe9a58c, 0.0016);

  // 用 PMREM 从天空生成环境贴图（柔和反射）
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(skyGeo.clone(), skyMat.clone()));
  let envRT = null;

  // 星星
  const N = 1500, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 0.95);
    pos[i * 3] = Math.sin(ph) * Math.cos(th) * 1800;
    pos[i * 3 + 1] = Math.cos(ph) * 1800;
    pos[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * 1800;
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
  scene.add(new THREE.Points(sg, starMat));

  const TIMES = {
    golden: { top: 0x2a4a7a, bottom: 0xe9a58c, sun: 0xffd2a0, sunI: 2.6, hemiI: 0.5, fog: 0xe9a58c, fogD: 0.0016, env: 0.75, exposure: 0.85, night: 0, elev: 0.25, azim: 0.8 },
    day:    { top: 0x4a8ad8, bottom: 0xc9d8e8, sun: 0xffffff, sunI: 3.0, hemiI: 0.55, fog: 0xc9d8e8, fogD: 0.0012, env: 0.3, exposure: 0.75, night: 0, elev: 1.0, azim: 0.4 },
    night:  { top: 0x050a1a, bottom: 0x0d1426, sun: 0x8fa8ff, sunI: 0.4, hemiI: 0.25, fog: 0x0d1426, fogD: 0.0024, env: 0.5, exposure: 1.0, night: 1, elev: -0.3, azim: 1.2 },
  };

  function apply(name) {
    const t = TIMES[name] || TIMES.golden;
    skyMat.uniforms.topColor.value.set(t.top);
    skyMat.uniforms.bottomColor.value.set(t.bottom);
    const sd = new THREE.Vector3(Math.cos(t.elev) * Math.cos(t.azim), Math.sin(t.elev), Math.cos(t.elev) * Math.sin(t.azim));
    skyMat.uniforms.sunDir.value.copy(sd);
    sun.position.copy(sd).multiplyScalar(250);
    sun.color.set(t.sun); sun.intensity = t.sunI;
    hemi.intensity = t.hemiI;
    moon.intensity = t.night * 0.9;
    scene.fog.color.set(t.fog); scene.fog.density = t.fogD;
    starMat.opacity = t.night;
    renderer.toneMappingExposure = t.exposure;
    // 环境贴图只需在切换时重建一次
    if (envRT) envRT.dispose();
    envRT = pmrem.fromScene(envScene, 0, 0.1, 2000);
    scene.environment = envRT.texture;
    scene.environmentIntensity = t.env;
  }
  apply('golden');

  return { apply, names: Object.keys(TIMES) };
}
