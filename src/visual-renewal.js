// Runtime integration only. Builders receive the bundled Three namespace, never fetch assets.
export function installVisualRenewal(game, THREE, builders, options = {}) {
  if (game.params?.get('visualRenewal') === '0') return null;
  if (game.visualRenewal) return game.visualRenewal;
  const anisotropy = Math.min(4, game.pipe.renderer.capabilities.getMaxAnisotropy());
  const layerOptions = { ...options, anisotropy };
  const town = builders.buildTownRenewal(game.island, THREE, layerOptions);
  const coast = builders.buildCoastalRenewal(game.island, THREE, { ...layerOptions, replaceLegacy: true });
  const player = game.player, originalModel = player.model;
  const hero = builders.createHeroModel(THREE, { height: 1.68, receiveShadow: true });
  // Keep all movement/state/outer pose ownership in Player. Only its display model changes.
  player.mixer?.stopAllAction();
  player.mixer?.uncacheRoot(originalModel);
  originalModel.removeFromParent(); player.model = hero; player.root.add(hero);
  player.action = null; player.initAnimation();
  const originalPose = player.pose;
  player.pose = function renewedPose(dt) {
    const result = originalPose.call(this, dt);
    const speed = this.mode === 'bike' ? Math.abs(this.speed) : Math.hypot(this.vel.x, this.vel.z);
    if (this.mode === 'foot') {
      // Replace the old fast toy-bob with a quieter gait; jumps, flips and squash are retained.
      const k = Math.min(1, speed / 6);
      this.model.position.y += (Math.abs(Math.sin(this.phase)) * .045 - Math.abs(Math.sin(this.phase * 3)) * .14) * k;
      this.model.rotation.z += (Math.sin(this.phase) * .03 - Math.sin(this.phase * 3) * .1) * k;
      this.model.rotation.x -= .065 * k;
    }
    const mode = this.mode === 'foot' && this.air ? 'jump' : this.mode;
    hero.userData.animate(mode, this.phase, speed, dt);
    return result;
  };
  player.pose(0);

  // Environment.apply owns the clock/sky/PMREM updates. Retune AFTER it on every call,
  // not once at startup (photo presets and time changes would otherwise restore the glare).
  const env = game.env, pipe = game.pipe, originalApply = env.apply;
  function lighting() {
    const night = Math.max(0, Math.min(1, env.night || 0));
    const highSun = Math.max(0, Math.min(1, ((env.sunDir?.y || 0) - .18) / .57));
    env.sun.intensity *= .76;
    env.hemi.intensity = .64 * (1 - night) + .42 * night;
    env.moon.intensity = .85 * night;
    env.scene.environmentIntensity = (.27 * (1 - night) + .26 * night) * (1 - .27 * highSun);
    pipe.renderer.toneMappingExposure = (.91 * (1 - night) + 1.02 * night) * (1 - .07 * highSun);
    for (const window of env.windows || []) window.emissiveIntensity *= .82;
    for (const neon of env.neon || []) neon.mat.color.multiplyScalar(.78 + .12 * night);
    const water = env.water?.material?.uniforms;
    if (water?.waterColor) water.waterColor.value.set(0x165e68);
    if (water?.distortionScale) water.distortionScale.value = 1.35;
    if (water?.sunColor) water.sunColor.value.multiplyScalar(.64);
  }
  env.apply = function applyRenewedLighting(...args) {
    const result = originalApply.apply(this, args); lighting(); return result;
  };
  pipe.bloom.strength = .17; pipe.bloom.radius = .42; pipe.bloom.threshold = 1.65;
  // Photo-hour presets and updateGrade also set bloom. Apply the art cap at the last
  // possible moment, but leave the story's gray-mode / upgrade reveal completely intact.
  const originalRender = pipe.render;
  pipe.render = function renderRenewedArt(dt, time) {
    if (this.scene === game.world && !this.g.uLow.value && !(game.upT > 0)) {
      this.bloom.strength = .16 + (env.night || 0) * .12;
    }
    return originalRender.call(this, dt, time);
  };
  const g = pipe.g;
  for (const [key, value] of Object.entries({ uSat: 1.025, uVig: .32, uGrain: .004, uCA: .025, uWarm: .35 })) {
    if (g[key]) g[key].value = value;
  }
  // Soft, tighter local shadows retain detail on the frog and the shop mouldings.
  pipe.renderer.shadowMap.type = THREE.PCFSoftShadowMap ?? 2;
  env.sun.shadow.camera.left = env.sun.shadow.camera.bottom = -58;
  env.sun.shadow.camera.right = env.sun.shadow.camera.top = 58;
  env.sun.shadow.camera.updateProjectionMatrix();
  env.sun.shadow.normalBias = .035; env.sun.shadow.bias = -.00025;
  env.apply();
  const result = { hero, town, coast, version: 'coastal-art-renewal-v1' };
  game.visualRenewal = result;
  return result;
}
