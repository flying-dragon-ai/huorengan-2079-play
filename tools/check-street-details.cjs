// Real-browser offline smoke test + same-camera A/B captures. Requires local Microsoft Edge.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const out = path.resolve(root, 'artifacts/street-details');
const edge = process.env.HUORENGAN_EDGE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'huorengan-street-browser-'));
fs.mkdirSync(out, { recursive: true });
const browser = spawn(edge, ['--headless=new', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', '--disable-background-networking', '--allow-file-access-from-files',
  '--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--remote-debugging-port=0', '--window-size=1440,900', '--user-data-dir=' + profile, 'about:blank'], { stdio: 'ignore' });
let socket, seq = 0;
const pending = new Map(), errors = [], report = {};
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, message, timeout = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeout) { const value = await fn(); if (value) return value; await delay(150); }
  throw new Error(message);
}
function send(method, params = {}) {
  return new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
}
async function evaluate(expression) {
  const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
  return response.result?.value;
}
async function frames(n = 4) {
  await evaluate(`new Promise(resolve => { let n=${n}; function step(){ if(--n<=0)resolve(true);else requestAnimationFrame(step); } requestAnimationFrame(step); })`);
}
async function capture(name) {
  await frames(5);
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const file = path.join(out, name + '.png'); fs.writeFileSync(file, Buffer.from(data, 'base64'));
  console.log('SCREENSHOT ' + file); return file;
}
async function ready() {
  await until(() => evaluate('Boolean(window.__game?.views && window.__game?.player && window.__game?.state !== "loading")'), 'Offline game did not initialize');
}
async function fingerprint() {
  return evaluate(`(()=>{ const g=window.__game,i=g.island; return JSON.stringify({boxes:i.col.boxes,props:i.props.map(p=>({home:p.home,radius:p.radius,mass:p.mass})),ramps:i.ramps,quests:g.districts.list.map(d=>({id:d.id,at:d.quest.at,time:d.quest.time,goal:d.quest.goal})),heights:[[50,164],[50,203],[145,205],[150,80]].map(([x,z])=>i.heightAt(x,z))}); })()`);
}
async function main() {
  const portFile = path.join(profile, 'DevToolsActivePort');
  const port = await until(() => {
    try {
      const value = fs.readFileSync(portFile, 'utf8').split(/\r?\n/)[0];
      return /^\d+$/.test(value) ? value : false;
    } catch (error) {
      // Edge briefly holds this file exclusively while publishing its debugger port on Windows.
      if (error.code === 'ENOENT' || error.code === 'EBUSY') return false;
      throw error;
    }
  }, 'Edge did not publish its debugger port');
  const targets = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
  const target = targets.find(t => t.type === 'page');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id) { const p = pending.get(message.id); pending.delete(message.id); if (p) message.error ? p.reject(new Error(JSON.stringify(message.error))) : p.resolve(message.result); }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') errors.push(message.params.entry);
  };
  await send('Runtime.enable'); await send('Page.enable'); await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  const url = pathToFileURL(path.join(root, 'index.html')).href;
  await send('Page.navigate', { url: url + '?dev=1' }); await ready();
  const dressedPhysics = await fingerprint();
  report.details = await evaluate(`(()=>{const g=window.__game,s=g.island.root.getObjectByName('street-details-v1');return {state:g.state,stats:s?.userData.stats,decorations:s?.userData.decorations,questCount:g.districts.list.length,meshCount:s?.children.length};})()`);
  assert.ok(report.details.stats?.curbBlocks > 1000); assert.ok(report.details.stats.batches <= 14);
  assert.equal(report.details.questCount, 8);
  console.log('LIVE_STREET_DETAILS ' + JSON.stringify(report.details));
  await evaluate(`(()=>{const g=window.__game;g.startView('shanghai');g.orbit.enableDamping=false;g.photoTime=0;g.env.hour=17.5;g.env.apply();g.pipe.camera.position.set(-128,6.2,-97.2);g.orbit.target.set(-104,1.0,-100);g.orbit.update(); const css=document.createElement('style');css.textContent='body> :not(canvas):not(script):not(style){visibility:hidden!important}';document.head.append(css);g.__streetCaptureStyle=css;g.updatePhoto=function(){this.orbit.update();this.pipe.render(0,0);};})()`);
  await delay(1200); await frames(8);
  await evaluate(`window.__game.island.root.getObjectByName('street-details-v1').visible=false`);
  report.before = await capture('street-before');
  await evaluate(`window.__game.island.root.getObjectByName('street-details-v1').visible=true`);
  report.after = await capture('street-after');
  for (const shot of [
    { name: 'tokyo-after', eye: [75, 5.7, -98], target: [106, .9, -98.7], hour: 18.7 },
    { name: 'seafront-after', eye: [126, 6.5, 212], target: [98, .5, 210], hour: 17.5 },
  ]) {
    await evaluate(`(()=>{const g=window.__game;g.env.hour=${shot.hour};g.env.apply();g.pipe.camera.position.set(${shot.eye});g.orbit.target.set(${shot.target});g.orbit.update();})()`);
    await capture(shot.name);
  }
  await evaluate(`(()=>{const g=window.__game;g.__streetCaptureStyle.remove();g.togglePhoto(false);document.getElementById('challenge-open').click();})()`);
  report.challengeBook = await evaluate(`({open:document.getElementById('challenge-book').open,rows:document.querySelectorAll('#challenge-list button').length})`);
  assert.equal(report.challengeBook.open, true); assert.equal(report.challengeBook.rows, 8);
  await evaluate(`document.querySelector('[data-coffee-route="avenue"]').click()`);
  report.coffee = await evaluate(`(()=>{const g=window.__game;return {phase:g.phase,volume:g.coffeeRace.volume,route:g.coffeeRace.route.name,points:g.coffeeRace.points,rivals:g.coffeeRace.rivals?.length,drive:!!g.player.coffeeDrive};})()`);
  assert.equal(report.coffee.phase, 'coffeeRace'); assert.equal(report.coffee.volume, 100);
  assert.equal(report.coffee.points.length, 3); assert.equal(report.coffee.drive, true);
  await send('Page.navigate', { url: url + '?dev=1&streetDetails=0' }); await ready();
  assert.equal(await evaluate(`Boolean(window.__game.island.root.getObjectByName('street-details-v1'))`), false);
  report.physicsUnchanged = (await fingerprint()) === dressedPhysics;
  assert.equal(report.physicsUnchanged, true, 'Street details must not alter seeded props, colliders, ramps, quest data or route heights');
  report.errors = errors; assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(out, 'browser-check.json'), JSON.stringify(report, null, 2));
  console.log('BROWSER_CHECK_PASS ' + JSON.stringify({ stats: report.details.stats, physicsUnchanged: report.physicsUnchanged, coffee: report.coffee, errors }));
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (socket?.readyState === WebSocket.OPEN) { try { await send('Browser.close'); } catch {} socket.close(); }
  browser.kill();
});
