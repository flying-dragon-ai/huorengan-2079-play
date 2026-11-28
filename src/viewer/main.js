// 主入口：场景装配、相机、加载进度、渲染循环
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildEnvironment } from './environment.js';
import { buildPlaza } from './components/plaza.js';
import { buildTokyo, buildShanghai, buildBeach, buildParis } from './components/districts.js';
import { buildIceland } from './components/iceland.js';
import { buildPyramid } from './components/pyramid.js';
import { buildHometown } from './components/hometown.js';
import { brickTex } from './kit.js';

const $ = (id) => document.getElementById(id);
const raf = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));

async function boot() {
  const canvas = $('c');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 4000);
  camera.position.set(60, 42, 80);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.maxPolarAngle = Math.PI / 2 - 0.03;
  controls.minDistance = 6;
  controls.maxDistance = 500;
  controls.target.set(0, 6, 0);

  const updatables = [];
  const steps = [
    ['准备环境…', () => {
      window.__env = buildEnvironment(scene, renderer);
      // 全岛地面
      const t = brickTex({ base: '#b9a48a', mortar: '#8a7660' }); t.repeat.set(60, 60);
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }));
      ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05;
      ground.receiveShadow = true; scene.add(ground);
    }],
    ['搭建中央广场…', () => {
      const plaza = buildPlaza();
      scene.add(plaza.group); updatables.push(plaza);
    }],
    ['搭建魔都弄堂…', () => {
      const d = buildShanghai(); d.group.position.set(-110, 0, -110);
      scene.add(d.group); updatables.push(d);
    }],
    ['搭建东京便利店街…', () => {
      const d = buildTokyo(); d.group.position.set(110, 0, -110);
      scene.add(d.group); updatables.push(d);
    }],
    ['搭建巴黎…', () => {
      const d = buildParis(); d.group.position.set(110, 0, 0);
      scene.add(d.group); updatables.push(d);
    }],
    ['搭建金字塔工地…', () => {
      const d = buildPyramid(); d.group.position.set(-110, 0, 0);
      scene.add(d.group); updatables.push(d);
    }],
    ['搭建老家县城…', () => {
      const d = buildHometown(); d.group.position.set(-110, 0, 110);
      scene.add(d.group); updatables.push(d);
    }],
    ['搭建冰岛温泉…', () => {
      const d = buildIceland(); d.group.position.set(0, 0, -210);
      scene.add(d.group); updatables.push(d);
    }],
    ['搭建热带海滩…', () => {
      const d = buildBeach(); d.group.position.set(0, 0, 230);
      scene.add(d.group); updatables.push(d);
    }],
    ['准备灯光与后期…', () => {
      // 预留：后期在下方统一创建
    }],
  ];

  for (let i = 0; i < steps.length; i++) {
    $('load-txt').textContent = steps[i][0];
    $('load-bar').value = i / steps.length;
    await raf();
    steps[i][1]();
  }

  // 后期：辉光 + 输出
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.35, 0.6, 1.2);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  $('load-bar').value = 1;
  $('load-txt').textContent = '准备就绪';
  await raf();
  $('loading').classList.add('off');
  $('hud').style.opacity = 1;

  // 视角预设
  const views = {
    overview: { pos: [60, 42, 80], target: [0, 6, 0], name: '全岛总览' },
    plaza: { pos: [26, 12, 30], target: [0, 8, 0], name: '中央广场' },
    tokyo: { pos: [110, 10, -70], target: [110, 10, -110], name: '东京' },
    shanghai: { pos: [-110, 10, -70], target: [-110, 8, -110], name: '魔都弄堂' },
    paris: { pos: [110, 14, 40], target: [102, 14, -6], name: '巴黎铁塔' },
    pyramid: { pos: [-110, 16, 40], target: [-116, 12, -6], name: '金字塔' },
    hometown: { pos: [-110, 12, 150], target: [-124, 6, 96], name: '老家县城' },
    iceland: { pos: [0, 10, -160], target: [0, 16, -215], name: '冰岛极光' },
    beach: { pos: [0, 10, 190], target: [20, 12, 250], name: '热带海滩' },
  };
  const sel = $('view-select');
  for (const [id, v] of Object.entries(views)) sel.add(new Option(v.name, id));
  sel.onchange = () => {
    const v = views[sel.value];
    camera.position.set(...v.pos);
    controls.target.set(...v.target);
    controls.update();
  };

  // 时间切换
  const times = [['golden', '黄昏'], ['day', '正午'], ['night', '夜晚']];
  let ti = 0;
  $('time-btn').onclick = () => {
    ti = (ti + 1) % times.length;
    $('time-btn').textContent = times[ti][1];
    window.__env.apply(times[ti][0]);
  };

  // 画质切换
  let hi = true;
  $('quality-btn').onclick = () => {
    hi = !hi;
    renderer.setPixelRatio(hi ? Math.min(window.devicePixelRatio, 1.5) : 1);
    renderer.shadowMap.enabled = hi;
    bloom.enabled = hi;
    $('quality-btn').textContent = hi ? '高画质' : '流畅模式';
  };

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
  });

  // 帧率显示（用 performance.now 计帧，不用 THREE.Clock，r180 已弃用）
  let fpsT = 0, frames = 0, lastNow = performance.now(), elapsed = 0;
  function loop() {
    requestAnimationFrame(loop);
    const now = performance.now();
    const dt = Math.min((now - lastNow) / 1000, 0.05);
    lastNow = now; elapsed += dt;
    const t = elapsed;
    controls.update();
    for (const u of updatables) u.update?.(dt, t);
    composer.render();
    frames++; fpsT += dt;
    if (fpsT >= 0.5) {
      $('fps').textContent = Math.round(frames / fpsT) + ' FPS';
      frames = 0; fpsT = 0;
    }
  }
  loop();
}

boot().catch((e) => {
  $('load-txt').textContent = '出错了：' + e.message;
  console.error(e);
});
