// Offline, real-browser A/B captures plus physics / movement / challenge-entry regression.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'artifacts/visual-renewal');
const edge = process.env.HUORENGAN_EDGE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'huorengan-art-browser-'));
fs.mkdirSync(out, { recursive: true });
const browser = spawn(edge, ['--headless=new', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', '--disable-background-networking', '--allow-file-access-from-files',
  '--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--remote-debugging-port=0', '--window-size=1440,900', '--user-data-dir=' + profile, 'about:blank'], { stdio: 'ignore' });
let socket, seq = 0;
const pending = new Map(), errors = [], report = { screenshots: {} };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, message, timeout = 180000) {
  const start = Date.now();
  while (Date.now() - start < timeout) { const value = await fn(); if (value) return value; await delay(150); }
  throw new Error(message + ': ' + JSON.stringify(errors));
}
function send(method, params = {}) {
  return new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
}
async function evaluate(expression) {
  const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
  return response.result?.value;
}
async function frames(n = 3) {
  await evaluate(`new Promise(resolve=>{let n=${n};function step(){if(--n<=0)resolve(true);else requestAnimationFrame(step)}requestAnimationFrame(step)})`);
}
async function capture(name) {
  await frames();
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const file = path.join(out, name + '.png'); fs.writeFileSync(file, Buffer.from(data, 'base64'));
  report.screenshots[name] = file; console.log('SCREENSHOT ' + file); return file;
}
async function ready() {
  await until(async () => {
    if (errors.length) throw new Error('Browser startup error: ' + JSON.stringify(errors));
    return evaluate('Boolean(window.__game?.views && window.__game?.player && window.__game?.state !== "loading" && document.getElementById("loading").classList.contains("off"))');
  }, 'Offline game did not initialize');
}
async function fingerprint() {
  return evaluate(`(()=>{const g=window.__game,i=g.island;return JSON.stringify({boxes:i.col.boxes,props:i.props.map(p=>({home:p.home,radius:p.radius,mass:p.mass})),ramps:i.ramps,quests:g.districts.list.map(d=>({id:d.id,at:d.quest.at,time:d.quest.time,goal:d.quest.goal})),heights:[[50,164],[50,203],[145,205],[150,80],[0,250],[94,231]].map(([x,z])=>i.heightAt(x,z))})})()`);
}
async function photo() {
  await evaluate(`(()=>{const g=window.__game;g.startView('shanghai');g.orbit.enableDamping=false;g.photoTime=0;const style=document.createElement('style');style.textContent='body> :not(canvas):not(script):not(style){visibility:hidden!important}';document.head.append(style);g.__artStyle=style;g.updatePhoto=function(){this.orbit.update();this.env.update(0,this.orbit.target);this.pipe.render(0,0)};})()`);
}
async function view({ eye, target, hour = 17.5, fov = 60 }) {
  await evaluate(`(()=>{const g=window.__game;g.env.hour=${hour};g.env.apply();g.pipe.camera.fov=${fov};g.pipe.camera.updateProjectionMatrix();g.pipe.camera.position.set(${eye});g.orbit.target.set(${target});g.orbit.update();g.env.update(0,g.orbit.target);})()`);
}
async function hero(mode, x, z, yaw = 0) {
  await evaluate(`(()=>{const p=window.__game.player;p.mode=${JSON.stringify(mode)};p.pos.set(${x},p.world.heightAt(${x},${z}),${z});p.vel.set(0,0,0);p.speed=0;p.air=false;p.vy=0;p.scale=p.scaleTarget=1;p.sq=1;p.sqv=0;p.phase=0;p.flip=0;p.lean=0;p.yaw=${yaw};p.root.visible=true;p.bike.visible=${mode === 'bike'};p.bike.position.copy(p.pos);p.bike.rotation.set(0,p.yaw,0);p.pose(0);p.model.userData.animate?.(p.mode,0,0,0);})()`);
}
const streetView = { eye: [-128, 6.2, -97.2], target: [-104, 1, -100], hour: 17.5 };
const beachView = { eye: [-95, 8.2, 215], target: [-54, .15, 243], hour: 17.5 };
const heroView = { eye: [-107.4, 1.72, -96.2], target: [-110, .84, -100], hour: 17.5, fov: 35 };
async function main() {
  const portFile = path.join(profile, 'DevToolsActivePort');
  const port = await until(() => {
    try { const value = fs.readFileSync(portFile, 'utf8').split(/\r?\n/)[0]; return /^\d+$/.test(value) ? value : false; }
    catch (e) { if (e.code === 'ENOENT' || e.code === 'EBUSY') return false; throw e; }
  }, 'Edge debugger port was not published');
  const targets = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
  socket = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onmessage = event => {
    const m = JSON.parse(event.data);
    if (m.id) { const p = pending.get(m.id); pending.delete(m.id); if (p) m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails);
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errors.push(m.params.entry);
  };
  await send('Runtime.enable'); await send('Page.enable'); await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  const url = pathToFileURL(path.join(root, 'index.html')).href;
  await send('Page.navigate', { url: url + '?dev=1' }); await ready();
  const dressedPhysics = await fingerprint();
  report.details = await evaluate(`(()=>{const g=window.__game,v=g.visualRenewal;return {installed:!!v,state:g.state,hero:v?.hero.userData.stats,town:v?.town.userData.stats,coast:v?.coast.userData.stats,quests:g.districts.list.length,originalMesh:g.player.model.name}})()`);
  console.log('LIVE_ART_DETAILS ' + JSON.stringify(report.details));
  assert.equal(report.details.installed, true); assert.equal(report.details.quests, 8);
  assert.ok(report.details.hero.triangles < 40000); assert.ok(report.details.town.storefronts >= 12);
  assert.ok(report.details.coast.umbrellas >= 5);
  await photo();
  await hero('foot', -110, -100); await view(heroView); await capture('hero-after');
  await hero('bike', -110, -100, Math.PI / 2);
  await view({ eye: [-114.9, 2.65, -95.8], target: [-108.2, 1.05, -100], fov: 60 }); await capture('riding-after');
  report.pose = await evaluate(`(()=>{const g=window.__game,p=g.player,h=g.visualRenewal.hero;g.world.updateMatrixWorld(true);const points={};for(const key of ['handL','handR','ankleL','ankleR']){const o=h.getObjectByName(h.userData.joints[key]);const v=o.position.clone();o.getWorldPosition(v);points[key]=v.toArray()}return {player:p.pos.toArray(),model:p.model.position.toArray(),scale:p.model.scale.toArray(),joints:points,heroHeight:h.userData.height}})()`);
  await evaluate(`window.__game.player.root.visible=false;window.__game.player.bike.visible=false`);
  await view(streetView); await capture('street-after');
  await view({ eye: [75, 5.7, -98], target: [106, .9, -98.7], hour: 18.7 }); await capture('tokyo-after');
  await view(beachView); await capture('beach-after');
  await view({ eye: [104, 5.6, 219], target: [87, .2, 246], hour: 16.5, fov: 52 }); await capture('beach-close-after');
  await view({ eye: [-16, 5.4, 277], target: [4, 1.15, 313], hour: 17.5, fov: 58 }); await capture('pier-after');

  report.lighting = await evaluate(`(()=>{const g=window.__game;const at=h=>{g.env.hour=h;g.env.apply();g.pipe.render(0,0);return {hour:h,sun:g.env.sun.intensity,hemi:g.env.hemi.intensity,exposure:g.pipe.renderer.toneMappingExposure,ibl:g.world.environmentIntensity,bloom:g.pipe.bloom.strength}};const a=at(12),b=at(12),night=at(21);return {day:a,stable:JSON.stringify(a)===JSON.stringify(b),night}})()`);
  assert.equal(report.lighting.stable, true);
  // Run the actual Player methods while photography freezes the outer loop.
  report.movement = await evaluate(`(()=>{const g=window.__game,p=g.player;const input={virt:null,axis:()=>[0,0],down:()=>false,hit:()=>false};p.mode='foot';p.pos.set(-125,0,-100);p.vel.set(0,0,0);p.air=false;p.vy=0;p.scale=p.scaleTarget=1;p.sq=1;p.phase=0;const x=p.pos.x;input.virt={move:[1,0]};for(let i=0;i<60;i++)p.update(1/60,input,0);const walk=p.pos.x-x;input.virt={move:[0,0],jump:true};p.update(1/60,input,0);const jump=p.air&&p.vy>0;input.virt={move:[0,0]};for(let i=0;i<12;i++)p.update(1/60,input,0);input.virt.jump=true;p.update(1/60,input,0);const doubleJump=p.jumps===2&&p.vy>0;delete input.virt.jump;for(let i=0;i<180;i++)p.update(1/60,input,0);const landed=!p.air&&Math.abs(p.pos.y-p.groundAt(p.pos.x,p.pos.z))<.01;p.bike.position.copy(p.pos);p.bike.rotation.set(0,Math.PI/2,0);const canMount=p.canMount();p.mount();const mounted=p.mode==='bike';const start=p.pos.clone();input.virt=null;input.axis=()=>[0,1];for(let i=0;i<100;i++)p.update(1/60,input,0);const ride=p.pos.distanceTo(start),speed=p.speed;p.dismount();return {walk,jump,doubleJump,landed,canMount,mounted,ride,speed,dismounted:p.mode==='foot',finite:[...p.pos.toArray(),...p.model.position.toArray(),...p.model.scale.toArray()].every(Number.isFinite)}})()`);
  assert.ok(report.movement.walk > 4); for (const key of ['jump','doubleJump','landed','canMount','mounted','dismounted','finite']) assert.equal(report.movement[key], true, key);
  assert.ok(report.movement.ride > 12); console.log('MOVEMENT_PASS ' + JSON.stringify(report.movement));
  await evaluate(`(()=>{const g=window.__game;g.__artStyle.remove();g.togglePhoto(false);document.getElementById('challenge-open').click()})()`);
  report.challengeBook = await evaluate(`({open:document.getElementById('challenge-book').open,rows:document.querySelectorAll('#challenge-list button').length})`);
  assert.equal(report.challengeBook.open, true); assert.equal(report.challengeBook.rows, 8);
  await evaluate(`document.querySelector('[data-coffee-route="avenue"]').click()`);
  report.coffee = await evaluate(`(()=>{const g=window.__game,r=g.coffeeRace;return {phase:g.phase,volume:r?.volume,route:r?.route.name,points:r?.points,rivals:r?.rivals?.length,drive:!!g.player.coffeeDrive,heroStillInstalled:!!g.player.model.userData.heroRenewal}})()`);
  assert.equal(report.coffee.phase, 'coffeeRace'); assert.ok(report.coffee.volume >= 98); assert.equal(report.coffee.drive, true); assert.equal(report.coffee.heroStillInstalled, true);

  await send('Page.navigate', { url: url + '?dev=1&visualRenewal=0' }); await ready();
  assert.equal(await evaluate('Boolean(window.__game.visualRenewal)'), false);
  report.physicsUnchanged = (await fingerprint()) === dressedPhysics;
  assert.equal(report.physicsUnchanged, true, 'Art must not change seeded props, colliders, ramps, quest data or route heights');
  await photo(); await hero('foot', -110, -100); await view(heroView); await capture('hero-before');
  await evaluate(`window.__game.player.root.visible=false;window.__game.player.bike.visible=false`);
  await view(streetView); await capture('street-before'); await view(beachView); await capture('beach-before');
  report.errors = errors; assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(out, 'browser-check.json'), JSON.stringify(report, null, 2));
  console.log('BROWSER_CHECK_PASS ' + JSON.stringify({ physicsUnchanged: report.physicsUnchanged, movement: report.movement, coffee: report.coffee, errors }));
}
main().catch(error => { console.error(error); report.errors = errors; report.failure = String(error); fs.writeFileSync(path.join(out, 'browser-check-failed.json'), JSON.stringify(report, null, 2)); process.exitCode = 1; }).finally(async () => {
  if (socket?.readyState === WebSocket.OPEN) { try { await send('Browser.close'); } catch {} socket.close(); }
  browser.kill();
});
